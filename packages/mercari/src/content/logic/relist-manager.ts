import { CONFIG, SELECTOR } from '../infra/constants';
import { log, warn } from '../infra/logger';
import { loadAutoSaveSettings } from '../infra/auto-save-settings';
import { enqueueSnapshot } from '../infra/relist-queue';
import { renderProcessingSpan, renderProgress } from '../ui/bulk-bar-ui';
import { findLiByItemId, getRelistButton, getItemName } from '../logic/dom-utils';
import { captureItemSnapshot } from './item-snapshot';
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
        return false;
      }

      // 処理開始。実際の進捗は processItems からの通知で上書きされる
      renderProcessingSpan('準備中...');

      // 商品リスト要素を含むコンテキストオブジェクトを作成
      const context = { itemListElement };

      // 再出品処理のプロセッサー実装
      const relistProcessor: ItemProcessor = {
        // コンテキストを利用して処理を実行
        processItem: (id: string) => relistSingleItem(context.itemListElement, id),

        getProcessName(): string {
          return 'RelistManager';
        },

        getDisplayName(): string {
          return '再出品';
        },

        getItemLabel(id: string): string {
          const li = findLiByItemId(context.itemListElement, id);
          return li ? getItemName(li) : '';
        },

        getWaitConfig(): { baseSeconds: number; minExtraSeconds: number; maxExtraSeconds: number } {
          return {
            // ミリ秒→秒に変換
            baseSeconds: CONFIG.RELIST_WAIT_BASE_MS / 1000,
            minExtraSeconds: 0,
            maxExtraSeconds: CONFIG.RELIST_WAIT_RANDOM_MS / 1000
          };
        }
      };

      // 共通処理を使用して再出品を実行
      const result = await processItems(ids, relistProcessor, renderProgress);

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
 *
 * 再出品ボタンを押すと別タブで出品フォームが開くため、クリックの前に
 * 元商品のスナップショットをキューへ積みます。出品フォーム側はこれを
 * 取り出して、コピー内容が元商品と一致しているかを検証します。
 *
 * 自動保存が無効なら取得しません。スナップショットは隠しiframeで編集フォームを
 * 描画して読むため1件あたり数秒かかり、使われないまま件数分の待ち時間と
 * メルカリへのアクセスが積み上がるためです。
 *
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

  // 比較の基準となる元商品の状態を、出品フォームが開く前に記録する
  if ((await loadAutoSaveSettings()).autoSaveAfterRelist) {
    const snapshot = await captureItemSnapshot(id, itemName);
    await enqueueSnapshot(snapshot);
  }

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
