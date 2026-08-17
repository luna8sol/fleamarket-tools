import { FormMode, QueueItem, QueueMode } from '../../common/messages';
import { PageType, PageTypeValue } from './infra/page-detector';
import { findRelistButton } from './logic/item-collector';
import { getCurrentPage } from './logic/pager';
import { sendStartQueue, sendStopQueue } from './logic/queue-client';
import { selectionManager } from './logic/selection-manager';
import { BulkBarHandlers } from './ui/bulk-bar';
import { showToast } from './ui/notification';
import { listRunState } from './run-state';

/**
 * 一括操作バーのボタンを押したときの処理。
 */

function startQueue(mode: QueueMode, items: QueueItem[], listPage?: number): void {
  sendStartQueue(mode, items, listPage);
  listRunState.setQueueRunning(true);
  showToast(`${items.length}件の処理を開始しました`, 'info');
}

/**
 * 開始・削除・停止のハンドラを作る。
 */
export function createBulkBarHandlers(
  pageType: PageTypeValue,
  primaryMode: FormMode
): BulkBarHandlers {
  return {
    onStart: (): void => {
      const selected = selectionManager.getOrderedItems();
      if (selected.length === 0) {
        showToast('商品を選択してください', 'warning');
        return;
      }
      // NOTE: フリマアシストのボタンは読み込み後に非同期で注入される。
      // 開始前に全件そろっているか確認し、不足していれば件数を伝える。
      if (primaryMode === 'relist') {
        const missing = selected.filter((item) => !findRelistButton(item.id)).length;
        if (missing > 0) {
          showToast(
            `フリマアシストの再出品ボタンが${missing}件見つかりません（読み込み完了後に再試行してください）`,
            'error'
          );
          return;
        }
      }
      startQueue(primaryMode, selected);
    },

    onDelete: (): void => {
      const selected = selectionManager.getOrderedItems();
      if (selected.length === 0) {
        showToast('商品を選択してください', 'warning');
        return;
      }
      // 削除は取り消せない。ラクマ側の確認ダイアログは自動化の都合で
      // 抑止するため、その代わりにここで必ず確認を取る。
      const target = pageType === PageType.SELL ? '出品中の商品' : '下書き';
      const ok = window.confirm(
        `${target}を${selected.length}件削除します。\n削除すると元に戻せません。実行しますか？`
      );
      if (!ok) return;
      // 削除のたびに1ページ目へ戻されるため、対象が居るページを覚えておく
      startQueue('delete', selected, getCurrentPage());
    },

    onStop: (): void => {
      sendStopQueue();
      listRunState.setQueueRunning(false);
      showToast('処理を停止しました', 'warning');
    },
  };
}
