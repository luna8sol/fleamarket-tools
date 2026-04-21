import { WAIT } from '../infra/constants';
import { findDraftItemById } from '../ui/list';
import { safeQuery } from '../../common/dom';
import { log, warn, debugMethodStart, debugMethodEnd } from '../infra/logger';
import { processItems, ItemProcessor } from './common-processor';
import { renderProgress } from '../ui/bulk-bar-ui';

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

  getDisplayName(): string {
    return '出品';
  }

  getItemLabel(id: string): string {
    const item = findDraftItemById(id);
    if (!item?.li) return '';
    return safeQuery<HTMLElement>('[data-testid="item-label"]', item.li)?.textContent?.trim() ?? '';
  }

  getWaitConfig(): { baseSeconds: number; minExtraSeconds: number; maxExtraSeconds: number } {
    return {
      baseSeconds: WAIT.BASE_SECONDS,
      minExtraSeconds: WAIT.EXTRA_MIN_SECONDS,
      maxExtraSeconds: WAIT.EXTRA_MAX_SECONDS
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
  await processItems(ids, processor, renderProgress);
}

