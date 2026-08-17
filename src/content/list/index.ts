import {
  ExtensionMessage,
  MessageType,
  QueueMode,
  QueueProgress,
  StartQueueMessage,
} from '../../common/messages';
import { log, setDebugMode, warn } from '../../common/logger';
import { detectCurrentPage, PageType } from './infra/page-detector';
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
  const startLabel = mode === 'relist' ? '選択した商品を再出品' : '選択した下書きをまとめて出品';

  // /sell ではフリマアシストの再出品ボタンが必須
  const items = collectItems(pageType);
  log(`ページタイプ: ${pageType}, 商品数: ${items.length}`);

  // チェックボックスを付与
  addCheckboxes(items, (item, checked) => {
    if (checked) {
      selectionManager.add({ id: item.id, title: item.title });
    } else {
      selectionManager.remove(item.id);
    }
    updateCount(selectionManager.getCount());
  });

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
        setCheckboxesEnabled(false);
        showToast(`${selected.length}件の処理を開始しました`, 'info');
      },
      onStop: () => {
        void chrome.runtime.sendMessage({ type: MessageType.STOP_QUEUE });
        setCheckboxesEnabled(true);
        showToast('処理を停止しました', 'warning');
      },
    }
  );

  // ページ再読込時に、実行中のキューの表示を復元する
  void restoreProgress(mode);

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
async function restoreProgress(mode: QueueMode): Promise<void> {
  try {
    const progress = (await chrome.runtime.sendMessage({
      type: MessageType.GET_PROGRESS,
    })) as QueueProgress | undefined;

    // 別モードのキュー（例: /sell で /draft のキュー）の進捗は表示しない
    if (!progress || progress.total === 0 || progress.mode !== mode) return;

    updateProgress(progress);
    if (progress.running) {
      setCheckboxesEnabled(false);
    }
  } catch (e) {
    warn('進捗の取得に失敗しました', e);
  }
}

main();
