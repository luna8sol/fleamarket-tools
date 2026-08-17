import {
  ExtensionMessage,
  MessageType,
  QueueMode,
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
  const startLabel =
    mode === 'relist' ? '選択した商品を再出品' : '選択した下書きをまとめて出品';

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
        if (mode === 'relist' && !findRelistButton(selected[0].id)) {
          showToast('フリマアシストの再出品ボタンが見つかりません', 'error');
          return;
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
        break;
      }

      default:
        break;
    }
    return undefined;
  });
}

main();
