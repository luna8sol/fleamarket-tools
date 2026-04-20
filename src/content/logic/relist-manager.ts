import { CONFIG, SELECTOR } from '../infra/constants';
import { log, warn } from '../infra/logger';
import { renderProcessingSpan } from '../ui/bulk-bar-ui';
import { findLiByItemId, getRelistButton, getItemName } from '../logic/dom-utils';
import { processItems, ItemProcessor } from './common-processor';

/**
 * 再出品処理を担当するモジュール
 * - 再出品ボタンのクリック
 * - 処理状況の管理
 */
export class RelistManager {
  /**
   * 商品の一括再出品を実行
   * @param ids 再出品する商品ID配列（選択順）
   * @returns 処理結果のPromise
   */
  async executeRelist(ids: string[]): Promise<boolean> {
    try {
      // 商品リスト要素のチェック
      const itemListElement = document.querySelector<HTMLUListElement>(SELECTOR.ITEMS_LIST);
      if (!itemListElement) {
        warn('商品リストが見つかりません');
        alert('商品リストが見つかりません。ページを再読み込みしてください。');
        return false;
      }

      // 処理開始
      renderProcessingSpan('処理中...');

      // 商品リスト要素を含むコンテキストオブジェクトを作成
      const context = { itemListElement };

      // 再出品処理のプロセッサー実装
      const relistProcessor: ItemProcessor = {
        // コンテキストを利用して処理を実行
        processItem: (id: string) => relistSingleItem(context.itemListElement, id),

        getProcessName(): string {
          return 'RelistManager';
        },

        getWaitConfig(): { baseSeconds: number; minExtraSeconds: number; maxExtraSeconds: number } {
          return {
            // ミリ秒→秒に変換
            baseSeconds: CONFIG.RELIST_WAIT_BASE / 1000,
            minExtraSeconds: 0,
            maxExtraSeconds: CONFIG.RELIST_WAIT_RANDOM / 1000
          };
        }
      };

      // 共通処理を使用して再出品を実行
      const result = await processItems(ids, relistProcessor);

      // 処理終了の表示を消す
      renderProcessingSpan('');

      return result;
    } catch (error) {
      warn('再出品処理でエラー:', error);
      renderProcessingSpan('');
      return false;
    }
  }
}

/**
 * 単一の商品を再出品する
 * @param itemListElement 商品リスト要素
 * @param id 再出品する商品ID
 * @returns 処理が成功したかどうか
 */
async function relistSingleItem(itemListElement: HTMLUListElement, id: string): Promise<boolean> {
  const li = findLiByItemId(itemListElement, id);
  if (!li) {
    warn(`商品 ${id} の要素が見つかりません`);
    return false;
  }

  const relistButton = getRelistButton(li);
  if (!relistButton) {
    warn(`商品 ${id} の再出品ボタンが見つかりません`);
    return false;
  }

  const itemName = getItemName(li) || `ID: ${id}`;
  log(`再出品処理: ${id} - ${itemName}`);

  // 再出品ボタンをクリック
  try {
    relistButton.click();
    log(`再出品ボタンをクリック: ${id} - ${itemName}`);
    return true;
  } catch (error) {
    warn(`再出品ボタンのクリックに失敗: ${id} - ${itemName}`, error);
    return false;
  }
}

export const relistManager = new RelistManager();
