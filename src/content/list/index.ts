import { FormMode, QueueProgress } from '../../common/messages';
import { setDebugMode, warn } from '../../common/logger';
import { detectCurrentPage, PageType } from './infra/page-detector';
import { observeListChanges } from './infra/list-observer';
import { requestProgress } from './logic/queue-client';
import { queueState } from './logic/queue-state';
import { renderBulkBar, updateProgress } from './ui/bulk-bar';
import { setCheckboxesEnabled } from './ui/checkbox-manager';
import { createBulkBarHandlers } from './bulk-bar-handlers';
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

  /** このページの主モード。削除はどちらのページでも使えるため別扱い */
  const primaryMode: FormMode = pageType === PageType.SELL ? 'relist' : 'publish';
  const startLabel =
    primaryMode === 'relist' ? '選択した商品を下書きに保存' : '選択した下書きをまとめて出品';

  // 一括操作バーを描画
  renderBulkBar({ startLabel }, createBulkBarHandlers(pageType, primaryMode));

  const syncItems = createItemSync(pageType);
  syncItems();
  observeListChanges(syncItems);

  // ページ再読込時に、実行中のキューの表示を復元する
  void restoreProgress(primaryMode).then((progress) => {
    if (progress?.running) {
      queueState.setQueueRunning(true);
      setCheckboxesEnabled(false);
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
async function restoreProgress(primaryMode: FormMode): Promise<QueueProgress | null> {
  try {
    const progress = await requestProgress();

    if (!progress || progress.total === 0) return null;
    // 別ページのキュー（例: /sell で /draft のキュー）の進捗は表示しない。
    // 削除はどちらのページでも使えるため常に表示する。
    if (progress.mode !== primaryMode && progress.mode !== 'delete') return null;

    updateProgress(progress);
    return progress;
  } catch (e) {
    warn('進捗の取得に失敗しました', e);
    return null;
  }
}

main();
