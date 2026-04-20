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

  const toggleAndChange = (el: HTMLInputElement): void => {
    el.checked = !el.checked;
    const ev = new Event('change', { bubbles: false });
    el.dispatchEvent(ev);
  };

  const onPointerDown = (e: Event): void => {
    e.stopImmediatePropagation();
    e.stopPropagation();
    e.preventDefault();
    if (!toggleHandledMap.get(checkbox)) {
      toggleHandledMap.set(checkbox, true);
      toggleAndChange(checkbox);
    }
  };
  checkbox.addEventListener('mousedown', onPointerDown, true);
  checkbox.addEventListener('touchstart', onPointerDown, true);

  const onPointerUp = (e: Event): void => {
    e.stopImmediatePropagation();
    e.stopPropagation();
    e.preventDefault();
    toggleHandledMap.set(checkbox, false);
  };
  checkbox.addEventListener('mouseup', onPointerUp, true);
  checkbox.addEventListener('touchend', onPointerUp, true);

  // クリックは完全抑止（手動トグルで一貫）
  checkbox.addEventListener(
    'click',
    (e) => {
      e.stopImmediatePropagation();
      e.stopPropagation();
      e.preventDefault();
      return false;
    },
    true
  );

  // changeでコールバック実行
  checkbox.addEventListener('change', function (this: HTMLInputElement, e: Event) {
    e.stopPropagation();
    onChange.call(this, e);
  });

  const duration = Math.round(performance.now() - startTime);
  debugMethodEnd('createBulkCheckboxElement', { elementCreated: true }, duration);

  return checkbox;
}

// 共通のID推定ヘルパー
function deriveItemIdFromLi(li: HTMLLIElement, type: 'drafts' | 'listings'): string | undefined {
  const aSel = type === 'listings' ? SELECTOR.ITEM_LINK : SELECTOR.DRAFT_ITEM;
  const aTag = safeQuery<HTMLAnchorElement>(aSel, li);
  return aTag ? safeGetAttr(aTag, 'href') ?? undefined : undefined;
}

// 統一実装（DRAFTS/LISTINGS共通）
function attachCheckboxInternal(
  li: HTMLLIElement,
  onChange: (id: string, checked: boolean) => void,
  options: { type: 'drafts' | 'listings'; itemId?: string; withOrder?: boolean }
): HTMLInputElement | null {
  const startTime = performance.now();
  debugMethodStart('attachCheckboxInternal', { liTagName: li?.tagName, options });

  if (!li) {
    debugMethodEnd('attachCheckboxInternal', { result: null, reason: 'li element is null' });
    return null;
  }

  // すでにチェックボックスが存在するか確認
  const existingCheckbox = safeQuery(`.${CLASS_NAME.BULK_CHECKBOX}`, li);
  if (existingCheckbox) {
    debugMethodEnd('attachCheckboxInternal', { result: 'existing checkbox', alreadyAttached: true });
    return existingCheckbox as HTMLInputElement;
  }

  // ID決定（優先: 引数 -> DOM推定）
  const resolvedId = options.itemId ?? deriveItemIdFromLi(li, options.type);
  if (!resolvedId) {
    warn('itemId could not be resolved for li:', li);
    debugMethodEnd('attachCheckboxInternal', { result: null, reason: 'could not resolve itemId' });
    return null;
  }

  const checkbox = createBulkCheckboxElement(function (this: HTMLInputElement) {
    const id = this.dataset.itemId || resolvedId;
    if (!id) {
      warn('itemId missing on change for li:', li);
      return;
    }
    onChange(id, this.checked);
  });

  // 統一: datasetに必ず設定
  checkbox.dataset.itemId = resolvedId;

  // オプション: 並び順表示もここで付与可能
  if (options.withOrder) {
    const orderSpan = createOrderSpan();
    const firstDiv = safeQuery<HTMLElement>('div', li);

    if (firstDiv) {
      safePrepend(firstDiv, orderSpan);
      safePrepend(firstDiv, checkbox);
    } else {
      li.insertBefore(orderSpan, li.firstChild);
      li.insertBefore(checkbox, li.firstChild);
    }
  } else {
    // 共通の挿入位置ポリシー（可能なら最初のdiv先頭、なければli先頭）
    const firstDiv = safeQuery<HTMLElement>('div', li);

    if (firstDiv && options.type === 'drafts') {
      safePrepend(firstDiv, checkbox);
    } else {
      li.insertBefore(checkbox, li.firstChild);
    }
  }

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
  debugMethodStart('addCheckboxAndOrderToLi', { itemId: item.id });

  const { li, id } = item;
  if (!li) {
    debugMethodEnd('addCheckboxAndOrderToLi', { result: 'aborted', reason: 'li element is null' });
    return;
  }

  const checkboxChangeHandler = (resolvedId: string, checked: boolean): void => {
    if (checked) {
      selectionManager.addSelection(resolvedId);
    } else {
      selectionManager.removeSelection(resolvedId);
    }

    const items = getDraftItems();
    updateOrderDisplay(items, selectionManager);
    updateOrder();
    updateDraftCount(selectionManager.getSelectionCount(), getDraftItems().length);
  };

  const result = attachCheckboxInternal(
    li,
    checkboxChangeHandler,
    { type: 'drafts', itemId: id, withOrder: true }
  );

  const duration = Math.round(performance.now() - startTime);
  debugMethodEnd('addCheckboxAndOrderToLi', { success: !!result, itemId: id }, duration);
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
  debugMethodStart('addCheckboxToLi', { liTagName: li?.tagName, options });

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
