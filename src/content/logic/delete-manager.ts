import { CONFIG, SELECTOR } from '../infra/constants';
import { log, warn } from '../infra/logger';
import { renderProcessingSpan, renderProgress } from '../ui/bulk-bar-ui';
import { findLiByItemId, getItemName } from './dom-utils';
import { deleteItem } from './item-deleter';
import { processItems, ItemProcessor } from './common-processor';

/**
 * 出品中商品の一括削除。
 *
 * 選択順に1件ずつ、商品の編集ページを隠しiframeで開いて削除します。
 * **1件失敗しても止めません。** 残りを処理し、失敗した件数を最後に知らせます。
 * 途中で止めると「どこまで消えたのか」が分からなくなるためです。
 */
export class DeleteManager {
  /**
   * 選択された商品を順に削除する
   *
   * @param ids 削除対象の商品ID（一覧ページが持つ形式）
   * @returns 全件の処理を終えたか
   */
  async executeDelete(ids: string[]): Promise<boolean> {
    try {
      const itemListElement = document.querySelector<HTMLUListElement>(SELECTOR.ITEMS_LIST);
      if (!itemListElement) {
        warn('商品リストが見つかりません');
        return false;
      }

      renderProcessingSpan('準備中...');

      const context = { itemListElement };

      const deleteProcessor: ItemProcessor = {
        processItem: (id: string) => deleteSingleItem(context.itemListElement, id),

        getProcessName(): string {
          return 'DeleteManager';
        },

        getDisplayName(): string {
          return '削除';
        },

        getItemLabel(id: string): string {
          const li = findLiByItemId(context.itemListElement, id);
          return li ? getItemName(li) : '';
        },

        getWaitConfig(): { baseSeconds: number; minExtraSeconds: number; maxExtraSeconds: number } {
          return {
            baseSeconds: CONFIG.DELETE_WAIT_BASE_MS / 1000,
            minExtraSeconds: 0,
            maxExtraSeconds: CONFIG.DELETE_WAIT_RANDOM_MS / 1000,
          };
        },
      };

      return await processItems(ids, deleteProcessor, renderProgress);
    } catch (error) {
      warn('一括削除でエラー:', error);
      renderProcessingSpan('');
      return false;
    }
  }
}

/**
 * 単一の商品を削除する
 *
 * 一覧の行から商品名を取り出し、編集ページ側の商品名と一致することを
 * 確認したうえで削除します（{@link ./item-deleter} 側で照合）。
 *
 * @param itemListElement 商品リスト要素
 * @param id 削除する商品ID
 * @returns 削除できたか
 */
async function deleteSingleItem(itemListElement: HTMLUListElement, id: string): Promise<boolean> {
  const li = findLiByItemId(itemListElement, id);
  if (!li) {
    warn(`商品 ${id} の要素が見つかりません`);
    return false;
  }

  const itemName = getItemName(li);
  log(`削除処理: ${id} - ${itemName}`);

  const result = await deleteItem(id, itemName);
  if (!result.deleted) {
    warn(`削除に失敗: ${id} - ${result.reason ?? '理由不明'}`);
    return false;
  }

  return true;
}

// シングルトンインスタンス
export const deleteManager = new DeleteManager();
