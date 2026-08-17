import { FormMode, QueueItem, QueueMode } from '../../common/messages';
import { PageType, PageTypeValue } from './infra/page-detector';
import { findRelistButton } from './logic/item-collector';
import { getCurrentPage } from './logic/pager';
import { sendStartQueue, sendStopQueue } from './logic/queue-client';
import { selectionManager } from './logic/selection-manager';
import { BulkBarHandlers } from './ui/bulk-bar';
import { showToast } from './ui/notification';
import { showReplacePanel } from './ui/replace-panel';
import { listRunState } from './run-state';

/**
 * 一括操作バーのボタンを押したときの処理。
 */

/**
 * Background に開始を依頼し、受け付けられたときだけ実行中表示にする。
 *
 * 別タブで実行中のときなど、依頼が断られることがある。応答を待たずに
 * 実行中にすると、選んだ商品が処理されない理由がユーザーに分からない。
 */
async function startQueue(
  mode: QueueMode,
  items: QueueItem[],
  listPage?: number,
  waitBaseMs?: number
): Promise<void> {
  const response = await sendStartQueue(mode, items, listPage, waitBaseMs);
  if (!response.started) {
    showToast(response.reason ?? '処理を開始できませんでした', 'error');
    return;
  }
  listRunState.setQueueRunning(true);
  showToast(`${items.length}件の処理を開始しました`, 'info');
}

function stopQueue(): void {
  sendStopQueue();
  listRunState.setQueueRunning(false);
  showToast('処理を停止しました', 'warning');
}

/**
 * 説明文の一括置換パネルを開く（/sell のみ）。
 * パネルは開くだけで保存には向かわない。パネル側で確認を取ったあと、
 * 計画の対象だけをキューに積む。
 */
export function openReplacePanel(): void {
  showReplacePanel({
    onStart: (plan, waitBaseSeconds): void => {
      void startQueue('replace', plan.targets, undefined, waitBaseSeconds * 1000);
    },
    onStop: stopQueue,
  });
}

/**
 * 開始・削除・停止（と、使えるページでは説明文の一括置換）のハンドラを作る。
 */
export function createBulkBarHandlers(
  pageType: PageTypeValue,
  primaryMode: FormMode,
  supportsReplace: boolean
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
      void startQueue(primaryMode, selected);
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
      void startQueue('delete', selected, getCurrentPage());
    },

    onStop: stopQueue,

    onReplace: supportsReplace ? openReplacePanel : undefined,
  };
}
