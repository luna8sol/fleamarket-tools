import { FormMode, QueueItem, QueueMode } from '../../common/messages';
import { PageType, PageTypeValue } from './infra/page-detector';
import { findRelistButton } from './logic/item-collector';
import { getCurrentPage } from './logic/pager';
import { sendStartQueue, sendStopQueue } from './logic/queue-client';
import { selectionManager } from './logic/selection-manager';
import { CONFIG } from './infra/constants';
import { BulkBarHandlers } from './ui/bulk-bar';
import { uncheckAll } from './ui/checkbox-manager';
import { confirmAction } from './ui/confirm-dialog';
import { showToast } from './ui/notification';
import { showReplacePanel } from './ui/replace-panel';
import { renderSelection } from './item-sync';
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
 * 削除してよいかを利用者に確認する。
 *
 * ラクマ側の確認ダイアログ（data-confirm）は自動化の都合で抑止するため、
 * その代わりにここで必ず確認を取る。件数だけでなく処理順の商品名も出す。
 */
function confirmDelete(pageType: PageTypeValue, items: QueueItem[]): Promise<boolean> {
  const target = pageType === PageType.SELL ? '出品中の商品' : '下書き';
  const minSeconds = CONFIG.DELETE_DELAY_MS / 1000;
  const maxSeconds = (CONFIG.DELETE_DELAY_MS + CONFIG.DELETE_RANDOM_MS) / 1000;
  return confirmAction({
    tone: 'danger',
    icon: 'trash',
    title: `${target}を${items.length}件削除します`,
    message: '選んだ順に 1 件ずつ削除します。処理中のタブは閉じずにそのままにしてください。',
    facts: [
      { label: '削除する件数', value: `${items.length}件`, emphasis: true },
      { label: '1件ごとの間隔', value: `${minSeconds}〜${maxSeconds}秒` },
    ],
    items: items.map((item) => item.title),
    note: '削除すると元に戻せません。',
    confirmLabel: `${items.length}件を削除`,
  });
}

/**
 * 選択をすべて外す。ラクマ側には何もしないので確認は取らない（選び直せば戻る）。
 */
function clearSelection(): void {
  const count = selectionManager.getCount();
  if (count === 0) return;
  uncheckAll();
  // 行ごとに change を発火させず、選択状態をまとめて消してから 1 回だけ描き直す
  selectionManager.clear();
  renderSelection();
  showToast(`${count}件の選択を解除しました`, 'info');
}

/**
 * 開始・削除・停止・選択の解除（と、使えるページでは説明文の一括置換）のハンドラを作る。
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
      // 削除は取り消せないので、確認で承諾されたときだけ始める。
      // 削除のたびに1ページ目へ戻されるため、対象が居るページを確認前に覚えておく。
      const page = getCurrentPage();
      void confirmDelete(pageType, selected).then((ok) => {
        if (ok) void startQueue('delete', selected, page);
      });
    },

    onClear: clearSelection,

    onStop: stopQueue,

    onReplace: supportsReplace ? openReplacePanel : undefined,
  };
}
