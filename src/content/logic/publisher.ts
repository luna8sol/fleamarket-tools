import { WAIT } from '../infra/constants';
import { findDraftItemById, getDraftItems, getDraftList } from '../ui/list';
import { safeQuery } from '../../common/dom';
import { log, warn, debugMethodStart, debugMethodEnd } from '../infra/logger';
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

  // 商品名取得（itemがnullの場合は空文字）
  let itemName = '';
  if (item && item.li) {
    const labelElem = safeQuery<HTMLElement>('[data-testid="item-label"]', item.li);
    itemName = labelElem ? labelElem.textContent?.trim() ?? '' : '';
  }

  if (!item) {
    warn(`li not found for id: ${id} 商品名: ${itemName}`);
    alert(`下書き商品の要素が見つかりません (id: ${id}) 商品名: ${itemName}。ページ構造が変更された可能性があります。`);
    debugMethodEnd('publishDraftItem', { success: false, reason: 'item not found', id });
    return false;
  }

  const submitBtn = safeQuery<HTMLButtonElement>('button[id="submit-draft"]', item.li);

  if (submitBtn instanceof HTMLButtonElement) {
    submitBtn.click();
    log(`出品ボタンをクリック: ${id} 商品名: ${itemName}`);

    const duration = Math.round(performance.now() - startTime);
    debugMethodEnd('publishDraftItem', { success: true, id, itemName }, duration);
    return true;

  } else {
    warn(`出品ボタンが見つかりません: ${id} 商品名: ${itemName}`);
    alert(`出品ボタンが見つかりません (id: ${id}) 商品名: ${itemName}。ページ構造が変更された可能性があります。`);
    debugMethodEnd('publishDraftItem', { success: false, reason: 'submit button not found', id });
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

  const draftList = getDraftList();
  if (!(draftList instanceof HTMLUListElement)) {
    warn('draftList not found');
    alert('下書きリストが見つかりません。ページを再読み込みしてください。');
    debugMethodEnd('initializePublisherUI', { success: false, reason: 'draft list not found' });
    return;
  }

  const items = getDraftItems();
  log(`draftList found, li count: ${items.length}`);

  const updateOrderFn = (): void => updateOrderDisplay(items, selectionManager);

  // ここで各liに共通のチェックボックスを付与（DRAFTSモード）
  // DraftItemのli→idマップを作成して渡せる場合は渡す
  const liToId = new Map<HTMLElement, string>();
  items.forEach(it => liToId.set(it.li, it.id));

  const liElements = Array.from(draftList.querySelectorAll('li'));
  liElements.forEach((li) => {
    const explicitId = liToId.get(li as HTMLElement); // 取れなければ内部推定に任せる
    addCheckboxToLi(
      li as HTMLLIElement,
      (id, checked) => {
        if (checked) {
          selectionManager.addSelection(id);
        } else {
          selectionManager.removeSelection(id);
        }
        // 順番表示と件数表示を更新
        updateOrderFn();
        updateDraftCount(selectionManager.getSelectionCount(), items.length);
      },
      { type: 'drafts', itemId: explicitId }
    );
  });

  // 初回の順番表示
  updateOrderDisplay(items, selectionManager);
  // 初期カウント表示
  updateDraftCount(selectionManager.getSelectionCount(), items.length);

  const duration = Math.round(performance.now() - startTime);
  debugMethodEnd('initializePublisherUI', {
    success: true,
    itemsProcessed: items.length,
  }, duration);
}
