import { WAIT } from '../infra/constants';
import { sleep, randomInt } from '../../common/utils';
import { findDraftItemById, getDraftItems, getDraftList } from '../ui/list';
import { safeQuery } from '../../common/dom';
import { log, warn, debug, debugMethodStart, debugMethodEnd } from '../infra/logger';
import { selectionManager } from './selection-manager';
// import { renderCheckboxes } from '../ui/checkbox-manager';
import { addCheckboxToLi } from '../ui/checkbox-manager';
import { updateOrderDisplay } from '../ui/order-display';
import { updateDraftCount } from '../ui/bulk-bar-core';
import { processItems, ItemProcessor } from './common-processor';

/**
 * 指定idの下書きli要素を探し、出品ボタンをクリックする。
 *
 * - 見つからない場合は警告を表示します。
 * - ページ構造変更時の堅牢性も考慮。
 *
 * @param id 下書き商品のid
 * @returns 出品クリック成功時true、失敗時false
 */
async function publishDraftItem(id: string): Promise<boolean> {
  const startTime = performance.now();
  debugMethodStart('publishDraftItem', { id });

  const item = findDraftItemById(id);
  debugMethodStart('publishDraftItem.findItem', {
    id,
    found: !!item,
    hasLiElement: item && !!item.li
  });

  // 商品名取得（itemがnullの場合は空文字）
  let itemName = '';
  if (item && item.li) {
    const labelElem = safeQuery<HTMLElement>('[data-testid="item-label"]', item.li);
    itemName = labelElem ? labelElem.textContent?.trim() ?? '' : '';
    debugMethodStart('publishDraftItem.getItemName', {
      labelFound: !!labelElem,
      itemName
    });
  }

  if (!item) {
    warn(`li not found for id: ${id} 商品名: ${itemName}`);
    alert(`下書き商品の要素が見つかりません (id: ${id}) 商品名: ${itemName}。ページ構造が変更された可能性があります。`);

    debugMethodEnd('publishDraftItem', {
      success: false,
      reason: 'item not found',
      id,
      itemName
    });
    return false;
  }

  const submitBtn = safeQuery<HTMLButtonElement>('button[id="submit-draft"]', item.li);
  debugMethodStart('publishDraftItem.findSubmitButton', {
    buttonFound: !!submitBtn,
    isButtonElement: submitBtn instanceof HTMLButtonElement
  });

  debug('submitBtn:', submitBtn, 'item:', item, 'id:', id, '商品名:', itemName);

  if (submitBtn instanceof HTMLButtonElement) {
    debug('submitBtn type:', submitBtn.type, 'form:', submitBtn.form);
    if (submitBtn.form) {
      debug('submitBtn.form:', submitBtn.form, 'form action:', submitBtn.form.action, 'method:', submitBtn.form.method);
    }
    debug('before click, submitBtn.disabled:', submitBtn.disabled, 'hidden:', submitBtn.hidden, 'display:', submitBtn.style.display);

    debugMethodStart('publishDraftItem.prepareClickEvent', {
      buttonDisabled: submitBtn.disabled,
      hasForm: !!submitBtn.form
    });

    submitBtn.addEventListener('click', (e) => {
      debugMethodStart('submitBtn.clickHandler', { eventType: e.type });
      debug('submitBtn click event fired', e);
      debugMethodEnd('submitBtn.clickHandler');
    }, { once: true });

    debugMethodStart('publishDraftItem.performClick');
    submitBtn.click();
    log(`出品ボタンをクリック: ${id} 商品名: ${itemName}`);
    debug('after click, submitBtn.disabled:', submitBtn.disabled, 'hidden:', submitBtn.hidden, 'display:', submitBtn.style.display);
    debugMethodEnd('publishDraftItem.performClick', {
      buttonDisabledAfterClick: submitBtn.disabled
    });

    const duration = Math.round(performance.now() - startTime);
    debugMethodEnd('publishDraftItem', {
      success: true,
      id,
      itemName,
      executionTimeMs: duration
    }, duration);
    return true;

  } else {
    warn(`出品ボタンが見つかりません: ${id} 商品名: ${itemName}`);
    alert(`出品ボタンが見つかりません (id: ${id}) 商品名: ${itemName}。ページ構造が変更された可能性があります。`);

    debugMethodEnd('publishDraftItem', {
      success: false,
      reason: 'submit button not found',
      id,
      itemName
    });
    return false;
  }
}

/**
 * 下書き出品処理のプロセッサー実装
 */
class DraftPublishProcessor implements ItemProcessor {
  processItem(id: string): Promise<boolean> {
    return publishDraftItem(id);
  }

  getProcessName(): string {
    return 'DraftPublisher';
  }

  getWaitConfig(): { baseSeconds: number; minExtraSeconds: number; maxExtraSeconds: number } {
    return {
      baseSeconds: WAIT.BASE_SECONDS,
      minExtraSeconds: WAIT.EXTRA_MIN,
      maxExtraSeconds: WAIT.EXTRA_MAX
    };
  }
}

/**
 * 複数idの下書き商品を順番に出品し、各出品間でランダム待機を挟む。
 *
 * - 1件ずつpublishDraftItemを呼び、各出品間でランダムな待機を入れます。
 *
 * @param ids 出品対象のid配列
 * @returns Promise<void>
 */
export async function publishAllDrafts(ids: string[]): Promise<void> {
  const processor = new DraftPublishProcessor();
  await processItems(ids, processor);
}

/**
 * draftListの存在チェック・UI挿入・イベント登録を統括するエントリ関数。
 *
 * - UI初期化時のエントリポイントです。
 * - draftListがなければ警告を表示し、既にバーが存在する場合は何もしません。
 * @example
 *   initializePublisherUI();
 */
export function initializePublisherUI(): void {
  const startTime = performance.now();
  debugMethodStart('initializePublisherUI');

  debugMethodStart('initializePublisherUI.getDraftList');
  const draftList = getDraftList();
  if (!(draftList instanceof HTMLUListElement)) {
    warn('draftList not found');
    alert('下書きリストが見つかりません。ページを再読み込みしてください。');
    debugMethodEnd('initializePublisherUI', {
      success: false,
      reason: 'draft list not found'
    });
    return;
  }
  debugMethodEnd('initializePublisherUI.getDraftList', {
    success: true,
    draftListTagName: draftList.tagName
  });

  debugMethodStart('initializePublisherUI.getDraftItems');
  const items = getDraftItems();
  log(`draftList found, li count: ${items.length}`);
  debugMethodEnd('initializePublisherUI.getDraftItems', {
    itemCount: items.length
  });

  const updateOrderFn = (): void => updateOrderDisplay(items, selectionManager);

  // ここで各liに共通のチェックボックスを付与（DRAFTSモード）
  // DraftItemのli→idマップを作成して渡せる場合は渡す
  debugMethodStart('initializePublisherUI.createItemMap');
  const liToId = new Map<HTMLElement, string>();
  items.forEach(it => liToId.set(it.li, it.id));
  debugMethodEnd('initializePublisherUI.createItemMap', {
    mapSize: liToId.size
  });

  debugMethodStart('initializePublisherUI.attachCheckboxes');
  const liElements = Array.from(draftList.querySelectorAll('li'));
  debugMethodStart('initializePublisherUI.processListItems', {
    liCount: liElements.length
  });

  liElements.forEach((li, index) => {
    const explicitId = liToId.get(li as HTMLElement); // 取れなければ内部推定に任せる
    debugMethodStart('initializePublisherUI.addCheckbox', {
      index,
      hasExplicitId: !!explicitId
    });

    addCheckboxToLi(
      li as HTMLLIElement,
      (id, checked) => {
        debugMethodStart('checkbox.onChange', {
          id,
          checked
        });

        if (checked) {
          selectionManager.addSelection(id);
        } else {
          selectionManager.removeSelection(id);
        }
        // 順番表示と件数表示を更新
        updateOrderFn();
        updateDraftCount(selectionManager.getSelectionCount(), items.length);

        debugMethodEnd('checkbox.onChange', {
          currentSelectionCount: selectionManager.getSelectionCount()
        });
      },
      { type: 'drafts', itemId: explicitId }
    );

    debugMethodEnd('initializePublisherUI.addCheckbox', {
      index,
      completed: true
    });
  });

  debugMethodEnd('initializePublisherUI.processListItems', {
    processedCount: liElements.length
  });
  debugMethodEnd('initializePublisherUI.attachCheckboxes', {
    completed: true
  });

  // 初回の順番表示
  debugMethodStart('initializePublisherUI.initialOrderDisplay');
  updateOrderDisplay(items, selectionManager);
  debugMethodEnd('initializePublisherUI.initialOrderDisplay');

  // 初期カウント表示
  debugMethodStart('initializePublisherUI.initialCountUpdate');
  updateDraftCount(selectionManager.getSelectionCount(), items.length);
  debugMethodEnd('initializePublisherUI.initialCountUpdate');

  const duration = Math.round(performance.now() - startTime);
  debugMethodEnd('initializePublisherUI', {
    success: true,
    itemsProcessed: items.length,
    uiInitialized: true,
    executionTimeMs: duration
  }, duration);
}
