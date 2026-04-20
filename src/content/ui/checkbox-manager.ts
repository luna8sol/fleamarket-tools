import { CLASS_NAME, SELECTOR } from '../infra/constants';
import { safeQuery, safeGetAttr, safePrepend } from '../../common/dom';
import { warn, debugMethodStart, debugMethodEnd } from '../infra/logger';
import { selectionManager } from '../logic/selection-manager';
import { createOrderSpan } from './order';
import { getDraftItems, DraftItem } from './list';
import { updateDraftCount } from './bulk-bar-core';
import { updateOrderDisplay } from '../ui/order-display';

// チェックボックスのトグル処理済みフラグを管理する WeakMap
const toggleHandledMap = new WeakMap<HTMLInputElement, boolean>();

// 共通のチェックボックス生成関数（クリック抑止＋手動トグル）
function createBulkCheckboxElement(
  onChange: (this: HTMLInputElement, ev: Event) => void
): HTMLInputElement {
  const startTime = performance.now();
  debugMethodStart('createBulkCheckboxElement');

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = CLASS_NAME.BULK_CHECKBOX;
  checkbox.style.marginRight = '8px';
  checkbox.style.position = 'relative';
  checkbox.style.zIndex = '99999';
  checkbox.style.pointerEvents = 'auto';
  toggleHandledMap.set(checkbox, false);

  debugMethodStart('createBulkCheckboxElement.setupToggle');
  const toggleAndChange = (el: HTMLInputElement): void => {
    debugMethodStart('toggleAndChange', {
      currentChecked: el.checked
    });

    el.checked = !el.checked;
    const ev = new Event('change', { bubbles: false });
    el.dispatchEvent(ev);

    debugMethodEnd('toggleAndChange', {
      newChecked: el.checked
    });
  };
  debugMethodEnd('createBulkCheckboxElement.setupToggle');

  debugMethodStart('createBulkCheckboxElement.addPointerListeners');
  const onPointerDown = (e: Event): void => {
    debugMethodStart('onPointerDown', {
      eventType: e.type
    });

    e.stopImmediatePropagation();
    e.stopPropagation();
    e.preventDefault();
    if (!toggleHandledMap.get(checkbox)) {
      toggleHandledMap.set(checkbox, true);
      toggleAndChange(checkbox);
    }

    debugMethodEnd('onPointerDown');
  };
  checkbox.addEventListener('mousedown', onPointerDown, true);
  checkbox.addEventListener('touchstart', onPointerDown, true);

  const onPointerUp = (e: Event): void => {
    debugMethodStart('onPointerUp', {
      eventType: e.type
    });

    e.stopImmediatePropagation();
    e.stopPropagation();
    e.preventDefault();
    toggleHandledMap.set(checkbox, false);

    debugMethodEnd('onPointerUp');
  };
  checkbox.addEventListener('mouseup', onPointerUp, true);
  checkbox.addEventListener('touchend', onPointerUp, true);
  debugMethodEnd('createBulkCheckboxElement.addPointerListeners');

  // クリックは完全抑止（手動トグルで一貫）
  debugMethodStart('createBulkCheckboxElement.addClickHandler');
  checkbox.addEventListener(
    'click',
    (e) => {
      debugMethodStart('onClick', {
        eventType: e.type,
        prevented: true
      });

      e.stopImmediatePropagation();
      e.stopPropagation();
      e.preventDefault();

      debugMethodEnd('onClick');
      return false;
    },
    true
  );
  debugMethodEnd('createBulkCheckboxElement.addClickHandler');

  // changeでコールバック実行
  debugMethodStart('createBulkCheckboxElement.addChangeHandler');
  checkbox.addEventListener('change', function (this: HTMLInputElement, e: Event) {
    debugMethodStart('onChange', {
      checked: this.checked,
      itemId: this.dataset.itemId
    });

    e.stopPropagation();
    onChange.call(this, e);

    debugMethodEnd('onChange');
  });
  debugMethodEnd('createBulkCheckboxElement.addChangeHandler');

  const duration = Math.round(performance.now() - startTime);
  debugMethodEnd('createBulkCheckboxElement', {
    elementCreated: true,
    type: checkbox.type,
    className: checkbox.className
  }, duration);

  return checkbox;
}

// 共通のID推定ヘルパー
function deriveItemIdFromLi(li: HTMLLIElement, type: 'drafts' | 'listings'): string | undefined {
  debugMethodStart('deriveItemIdFromLi', {
    liTagName: li.tagName,
    type
  });

  const aSel = type === 'listings' ? SELECTOR.ITEM_LINK : SELECTOR.DRAFT_ITEM;
  const aTag = safeQuery<HTMLAnchorElement>(aSel, li);
  const id = aTag ? safeGetAttr(aTag, 'href') ?? undefined : undefined;

  debugMethodEnd('deriveItemIdFromLi', {
    found: !!id,
    id,
    selector: aSel,
    tagFound: !!aTag
  });

  return id;
}

// 統一実装（DRAFTS/LISTINGS共通）
function attachCheckboxInternal(
  li: HTMLLIElement,
  onChange: (id: string, checked: boolean) => void,
  options: { type: 'drafts' | 'listings'; itemId?: string; withOrder?: boolean }
): HTMLInputElement | null {
  const startTime = performance.now();
  debugMethodStart('attachCheckboxInternal', {
    liTagName: li?.tagName,
    options
  });

  if (!li) {
    debugMethodEnd('attachCheckboxInternal', {
      result: null,
      reason: 'li element is null'
    });
    return null;
  }

  // すでにチェックボックスが存在するか確認
  const existingCheckbox = safeQuery(`.${CLASS_NAME.BULK_CHECKBOX}`, li);
  if (existingCheckbox) {
    debugMethodEnd('attachCheckboxInternal', {
      result: 'existing checkbox',
      alreadyAttached: true
    });
    return existingCheckbox as HTMLInputElement;
  }

  // ID決定（優先: 引数 -> DOM推定）
  debugMethodStart('attachCheckboxInternal.resolveId', {
    providedId: options.itemId,
    type: options.type
  });

  const resolvedId = options.itemId ?? deriveItemIdFromLi(li, options.type);
  if (!resolvedId) {
    warn('itemId could not be resolved for li:', li);
    debugMethodEnd('attachCheckboxInternal', {
      result: null,
      reason: 'could not resolve itemId'
    });
    return null;
  }

  debugMethodEnd('attachCheckboxInternal.resolveId', {
    resolvedId
  });

  debugMethodStart('attachCheckboxInternal.createCheckbox');
  const checkbox = createBulkCheckboxElement(function (this: HTMLInputElement) {
    const id = this.dataset.itemId || resolvedId;
    if (!id) {
      warn('itemId missing on change for li:', li);
      return;
    }
    onChange(id, this.checked);
  });
  debugMethodEnd('attachCheckboxInternal.createCheckbox', {
    checkboxCreated: !!checkbox
  });

  // 統一: datasetに必ず設定
  checkbox.dataset.itemId = resolvedId;

  debugMethodStart('attachCheckboxInternal.attachToDOM', {
    withOrder: options.withOrder
  });

  // オプション: 並び順表示もここで付与可能
  if (options.withOrder) {
    const orderSpan = createOrderSpan();
    const firstDiv = safeQuery<HTMLElement>('div', li);

    debugMethodStart('attachCheckboxInternal.attachWithOrder', {
      hasFirstDiv: !!firstDiv
    });

    if (firstDiv) {
      safePrepend(firstDiv, orderSpan);
      safePrepend(firstDiv, checkbox);
    } else {
      li.insertBefore(orderSpan, li.firstChild);
      li.insertBefore(checkbox, li.firstChild);
    }

    debugMethodEnd('attachCheckboxInternal.attachWithOrder', {
      attached: true,
      target: firstDiv ? 'firstDiv' : 'li'
    });
  } else {
    // 共通の挿入位置ポリシー（可能なら最初のdiv先頭、なければli先頭）
    const firstDiv = safeQuery<HTMLElement>('div', li);

    debugMethodStart('attachCheckboxInternal.attachStandard', {
      hasFirstDiv: !!firstDiv,
      isDraftsType: options.type === 'drafts'
    });

    if (firstDiv && options.type === 'drafts') {
      safePrepend(firstDiv, checkbox);
    } else {
      li.insertBefore(checkbox, li.firstChild);
    }

    debugMethodEnd('attachCheckboxInternal.attachStandard', {
      attached: true,
      target: (firstDiv && options.type === 'drafts') ? 'firstDiv' : 'li'
    });
  }

  debugMethodEnd('attachCheckboxInternal.attachToDOM', {
    success: true,
    type: options.type,
    itemId: resolvedId
  });

  const duration = Math.round(performance.now() - startTime);
  debugMethodEnd('attachCheckboxInternal', {
    success: true,
    itemId: resolvedId,
    type: options.type,
    withOrder: options.withOrder
  }, duration);

  return checkbox;
}

/**
 * 指定したDraftItemにチェックボックスと順番表示用spanを追加（DRAFTS向け）
 * 統一実装に委譲
 */
export function addCheckboxAndOrderToLi(item: DraftItem, updateOrder: () => void): void {
  const startTime = performance.now();
  debugMethodStart('addCheckboxAndOrderToLi', {
    itemId: item.id
  });

  const { li, id } = item;
  if (!li) {
    debugMethodEnd('addCheckboxAndOrderToLi', {
      result: 'aborted',
      reason: 'li element is null'
    });
    return;
  }

  debugMethodStart('addCheckboxAndOrderToLi.setupCallback');
  const checkboxChangeHandler = (resolvedId: string, checked: boolean): void => {
    debugMethodStart('checkboxChangeHandler', {
      resolvedId,
      checked
    });

    if (checked) {
      selectionManager.addSelection(resolvedId);
    } else {
      selectionManager.removeSelection(resolvedId);
    }

    debugMethodStart('checkboxChangeHandler.updateUI');
    const items = getDraftItems();
    updateOrderDisplay(items, selectionManager);

    updateOrder();
    updateDraftCount(selectionManager.getSelectionCount(), getDraftItems().length);
    debugMethodEnd('checkboxChangeHandler.updateUI', {
      selectionCount: selectionManager.getSelectionCount(),
      totalItems: getDraftItems().length
    });

    debugMethodEnd('checkboxChangeHandler');
  };
  debugMethodEnd('addCheckboxAndOrderToLi.setupCallback');

  debugMethodStart('addCheckboxAndOrderToLi.attachCheckbox');
  const result = attachCheckboxInternal(
    li,
    checkboxChangeHandler,
    { type: 'drafts', itemId: id, withOrder: true }
  );
  debugMethodEnd('addCheckboxAndOrderToLi.attachCheckbox', {
    success: !!result
  });

  const duration = Math.round(performance.now() - startTime);
  debugMethodEnd('addCheckboxAndOrderToLi', {
    success: !!result,
    itemId: id
  }, duration);
}

/**
 * li要素にチェックボックスを追加（DRAFTS/LISTINGS共通）
 * 統一実装に委譲
 */
export function addCheckboxToLi(
  li: HTMLLIElement,
  onChange: (id: string, checked: boolean) => void,
  options?: { type?: 'drafts' | 'listings'; itemId?: string }
): HTMLInputElement | null {
  const startTime = performance.now();
  debugMethodStart('addCheckboxToLi', {
    liTagName: li?.tagName,
    options
  });

  const result = attachCheckboxInternal(
    li,
    onChange,
    { type: options?.type ?? 'listings', itemId: options?.itemId, withOrder: false }
  );

  const duration = Math.round(performance.now() - startTime);
  debugMethodEnd('addCheckboxToLi', {
    success: !!result,
    type: options?.type ?? 'listings',
    itemId: options?.itemId
  }, duration);

  return result;
}

