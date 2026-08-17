import {
  ExtensionMessage,
  MessageType,
  QueueMode,
  QueueProgress,
  StartQueueMessage,
} from '../../common/messages';
import { log, setDebugMode, warn } from '../../common/logger';
import { detectCurrentPage, PageType } from './infra/page-detector';
import { observeListChanges } from './infra/list-observer';
import { collectItems, findRelistButton } from './logic/item-collector';
import { selectionManager } from './logic/selection-manager';
import { addCheckboxes, setCheckboxesEnabled } from './ui/checkbox-manager';
import { renderBulkBar, updateCount, updateProgress } from './ui/bulk-bar';
import { showToast } from './ui/notification';

/**
 * 一覧ページ（/sell・/draft）用Content Scriptのエントリポイント。
 */
function main(): void {
  setDebugMode(true);

  const pageType = detectCurrentPage();
  if (pageType === PageType.UNKNOWN) {
    return;
  }

  const mode: QueueMode = pageType === PageType.SELL ? 'relist' : 'publish';
  const startLabel =
    mode === 'relist' ? '選択した商品を下書きに保存' : '選択した下書きをまとめて出品';

  /** キュー実行中は、後から現れたチェックボックスも無効にしておく */
  let queueRunning = false;

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

    // ページ送りで一覧から消えた商品の選択は破棄する。
    // 再描画の途中で一時的に0件になることがあるため、その場合は触らない。
    if (items.length > 0) {
      selectionManager.retain(new Set(items.map((item) => item.id)));
    }

    updateCount(selectionManager.getCount());
    if (queueRunning) {
      setCheckboxesEnabled(false);
    }
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
        if (mode === 'relist') {
          const missing = selected.filter((item) => !findRelistButton(item.id)).length;
          if (missing > 0) {
            showToast(
              `フリマアシストの再出品ボタンが${missing}件見つかりません（読み込み完了後に再試行してください）`,
              'error'
            );
            return;
          }
        }
        const message: StartQueueMessage = {
          type: MessageType.START_QUEUE,
          mode,
          items: selected,
        };
        void chrome.runtime.sendMessage(message);
        queueRunning = true;
        setCheckboxesEnabled(false);
        showToast(`${selected.length}件の処理を開始しました`, 'info');
      },
      onStop: () => {
        void chrome.runtime.sendMessage({ type: MessageType.STOP_QUEUE });
        queueRunning = false;
        setCheckboxesEnabled(true);
        showToast('処理を停止しました', 'warning');
      },
    }
  );

  syncItems();
  observeListChanges(syncItems);

  // ページ再読込時に、実行中のキューの表示を復元する
  void restoreProgress(mode).then((progress) => {
    if (progress?.running) {
      queueRunning = true;
      setCheckboxesEnabled(false);
    }
  });

  // Backgroundからのメッセージを処理
  chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
    switch (message.type) {
      case MessageType.CLICK_RELIST: {
        const btn = findRelistButton(message.item.id);
        if (btn) {
          log(`再出品ボタンをクリック: ${message.item.title}`);
          btn.click();
          sendResponse({ clicked: true });
        } else {
          warn(`再出品ボタンが見つかりません: ${message.item.title}`);
          sendResponse({ clicked: false });
        }
        break;
      }

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
    // すべての分岐で同期的に応答済みのため、チャネルは開いたままにしない
    return undefined;
  });
}

/**
 * Backgroundから現在の進捗を取得してバーへ反映する。
 * Service Workerはキューの待機中も状態を保持しているため、
 * 一覧ページを再読込しても処理中であることが分かるようにする。
 */
async function restoreProgress(mode: QueueMode): Promise<QueueProgress | null> {
  try {
    const progress = (await chrome.runtime.sendMessage({
      type: MessageType.GET_PROGRESS,
    })) as QueueProgress | undefined;

    // 別モードのキュー（例: /sell で /draft のキュー）の進捗は表示しない
    if (!progress || progress.total === 0 || progress.mode !== mode) return null;

    updateProgress(progress);
    return progress;
  } catch (e) {
    warn('進捗の取得に失敗しました', e);
    return null;
  }
}

main();
