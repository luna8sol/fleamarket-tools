import {
  ExtensionMessage,
  FormMode,
  MessageType,
  QueueMode,
  QueueProgress,
} from '../../common/messages';
import { log, setDebugMode, warn } from '../../common/logger';
import { detectCurrentPage, PageType } from './infra/page-detector';
import { observeListChanges } from './infra/list-observer';
import { collectItems, findRelistButton } from './logic/item-collector';
import { getCurrentPage } from './logic/pager';
import {
  sendListReady,
  sendStartQueue,
  sendStopQueue,
  requestProgress,
} from './logic/queue-client';
import { selectionManager } from './logic/selection-manager';
import { addCheckboxes, setCheckboxesEnabled } from './ui/checkbox-manager';
import { renderBulkBar, updateCount, updateProgress } from './ui/bulk-bar';
import { showToast } from './ui/notification';
import { handleClickDelete, handleClickRelist } from './message-handlers';

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

  /** キュー実行中は、後から現れたチェックボックスも無効にしておく */
  let queueRunning = false;
  /** LIST_READY はページ読み込みごとに1回だけ送る */
  let listReadySent = false;

  const handleCheckboxChange = (item: { id: string; title: string }, checked: boolean): void => {
    if (checked) {
      selectionManager.add({ id: item.id, title: item.title });
    } else {
      selectionManager.remove(item.id);
    }
    updateCount(selectionManager.getCount());
  };

  /**
   * 一覧の商品にチェックボックスを付け直す。
   *
   * 商品リストはクライアント描画のためContent Script起動時にはまだ存在しない。
   * DOMが変化するたびに呼び、増えた分だけ付与する。
   */
  const syncItems = (): void => {
    const items = collectItems(pageType);
    const added = addCheckboxes(items, handleCheckboxChange);
    if (added > 0) {
      log(`チェックボックスを${added}件追加しました（一覧の商品数: ${items.length}）`);
    }

    if (items.length === 0) {
      // 再描画の途中で一時的に0件になることがあるため、この時点では何もしない
      updateCount(selectionManager.getCount());
      return;
    }

    // ページ送りで一覧から消えた商品の選択は破棄する
    selectionManager.retain(new Set(items.map((item) => item.id)));
    updateCount(selectionManager.getCount());
    if (queueRunning) {
      setCheckboxesEnabled(false);
    }

    // 削除キューの成否判定に使うため、描画が終わったことをBackgroundへ伝える
    if (!listReadySent) {
      listReadySent = true;
      sendListReady(pageType);
    }
  };

  const startQueue = (
    mode: QueueMode,
    items: { id: string; title: string }[],
    listPage?: number
  ): void => {
    sendStartQueue(mode, items, listPage);
    queueRunning = true;
    setCheckboxesEnabled(false);
    showToast(`${items.length}件の処理を開始しました`, 'info');
  };

  // 一括操作バーを描画
  renderBulkBar(
    { startLabel },
    {
      onStart: () => {
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

      onDelete: () => {
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

      onStop: () => {
        sendStopQueue();
        queueRunning = false;
        setCheckboxesEnabled(true);
        showToast('処理を停止しました', 'warning');
      },
    }
  );

  syncItems();
  observeListChanges(syncItems);

  // ページ再読込時に、実行中のキューの表示を復元する
  void restoreProgress(primaryMode).then((progress) => {
    if (progress?.running) {
      queueRunning = true;
      setCheckboxesEnabled(false);
    }
  });

  // Backgroundからのメッセージを処理
  chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
    /** 非同期に応答する場合のみ、メッセージチャネルを開いたままにする */
    let keepChannelOpen = false;

    switch (message.type) {
      case MessageType.CLICK_RELIST:
        keepChannelOpen = handleClickRelist(message, sendResponse);
        break;

      case MessageType.CLICK_DELETE:
        keepChannelOpen = handleClickDelete(pageType, message, sendResponse);
        break;

      case MessageType.QUEUE_PROGRESS: {
        updateProgress(message.progress);
        queueRunning = message.progress.running;
        if (!message.progress.running) {
          setCheckboxesEnabled(true);
          if (message.progress.total > 0 && message.progress.done >= message.progress.total) {
            const failed = message.progress.failed.length;
            if (failed > 0) {
              showToast(`完了（失敗${failed}件あり）`, 'warning');
            } else {
              showToast('すべての処理が完了しました', 'success');
            }
          }
        }
        sendResponse({ ok: true });
        break;
      }

      default:
        sendResponse({ ok: true });
        break;
    }
    return keepChannelOpen ? true : undefined;
  });
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
