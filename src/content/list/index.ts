import { FormMode, QueueProgress } from '../../common/messages';
import { setDebugMode, warn } from '../../common/logger';
import { detectCurrentPage, LIST_PAGE_TRAITS, PageType } from './infra/page-detector';
import { observeListChanges } from './infra/list-observer';
import { requestProgress } from './logic/queue-client';
import { renderBulkBar, updateProgress } from './ui/bulk-bar';
import { renderReplaceProgress } from './ui/replace-panel';
import { listRunState } from './run-state';
import { createBulkBarHandlers, openReplacePanel } from './bulk-bar-handlers';
import { createItemSync } from './item-sync';
import { registerMessageHandlers } from './message-handlers';

/**
 * 一覧ページ（/sell・/draft）用Content Scriptのエントリポイント。
 */

function main(): void {
  setDebugMode(true);

  const pageType = detectCurrentPage();
  if (pageType === PageType.UNKNOWN) {
    return;
  }

  const { primaryMode, startLabel, startIcon, pageLabel, supportsReplace } =
    LIST_PAGE_TRAITS[pageType];

  // 一括操作バーを描画
  renderBulkBar(
    { startLabel, startIcon, pageLabel },
    createBulkBarHandlers(pageType, primaryMode, supportsReplace)
  );

  const syncItems = createItemSync(pageType);
  syncItems();
  observeListChanges(syncItems);

  // ページ再読込時に、実行中のキューの表示を復元する
  void restoreProgress(primaryMode, supportsReplace).then((progress) => {
    if (progress?.running) {
      listRunState.setQueueRunning(true);
    }
    // 説明文の一括置換の進捗はパネル側にも出す（件数の内訳と停止理由）
    if (progress?.mode === 'replace' && supportsReplace) {
      openReplacePanel();
      renderReplaceProgress(progress);
    }
  });

  // Backgroundからのメッセージを処理
  registerMessageHandlers(pageType);
}

/**
 * Backgroundから現在の進捗を取得してバーへ反映する。
 * Service Workerはキューの待機中も状態を保持しているため、
 * 一覧ページを再読込しても処理中であることが分かるようにする。
 */
async function restoreProgress(
  primaryMode: FormMode,
  supportsReplace: boolean
): Promise<QueueProgress | null> {
  try {
    const progress = await requestProgress();

    if (!progress || progress.total === 0) return null;
    // 別ページのキュー（例: /sell で /draft のキュー）の進捗は表示しない。
    // 削除はどちらのページでも使えるため常に表示する。
    // 説明文の一括置換（replace）は、それを使えるページ（/sell）でだけ表示する。
    const belongsHere =
      progress.mode === primaryMode ||
      progress.mode === 'delete' ||
      (progress.mode === 'replace' && supportsReplace);
    if (!belongsHere) return null;

    updateProgress(progress);
    return progress;
  } catch (e) {
    warn('進捗の取得に失敗しました', e);
    return null;
  }
}

main();
