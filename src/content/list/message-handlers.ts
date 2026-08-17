import {
  AckResponse,
  ClickDeleteMessage,
  ClickRelistMessage,
  ClickResponse,
  ExtensionMessage,
  MessageType,
  QueueProgressMessage,
} from '../../common/messages';
import { log, warn } from '../../common/logger';
import { CONFIG } from './infra/constants';
import { PageTypeValue } from './infra/page-detector';
import { clickDeleteLink, findDeleteLink } from './logic/delete-clicker';
import { locateDeleteLink } from './logic/delete-locator';
import { findRelistButton } from './logic/item-collector';
import { getTotalItemCount } from './logic/pager';
import { sendListReady } from './logic/queue-client';
import { queueState } from './logic/queue-state';
import { updateProgress } from './ui/bulk-bar';
import { setCheckboxesEnabled } from './ui/checkbox-manager';
import { showToast } from './ui/notification';
import { delay } from '../wait';

/**
 * Backgroundから届くメッセージの処理。
 *
 * 各ハンドラの戻り値は「非同期に応答するため、メッセージチャネルを
 * 開いたままにするかどうか」を表す。
 */

type ClickSendResponse = (response: ClickResponse) => void;
type AckSendResponse = (response: AckResponse) => void;

/**
 * フリマアシストの再出品ボタンをクリックする。
 */
function handleClickRelist(message: ClickRelistMessage, sendResponse: ClickSendResponse): boolean {
  const btn = findRelistButton(message.item.id);
  if (btn) {
    log(`再出品ボタンをクリック: ${message.item.title}`);
    btn.click();
    sendResponse({ clicked: true });
  } else {
    warn(`再出品ボタンが見つかりません: ${message.item.title}`);
    sendResponse({ clicked: false });
  }
  return false;
}

/**
 * 指定商品の削除リンクを探してクリックする。
 *
 * 商品を探すためにページを移動することがあるので応答は非同期になる。
 */
function handleClickDelete(
  pageType: PageTypeValue,
  message: ClickDeleteMessage,
  sendResponse: ClickSendResponse
): boolean {
  void (async (): Promise<void> => {
    if (!(await locateDeleteLink(pageType, message.item.id, message.page ?? null))) {
      warn(`削除リンクが見つかりません: ${message.item.title}`);
      sendResponse({ clicked: false });
      return;
    }
    // 見つかったことと現在の件数を先に返す。クリックするとページ遷移が
    // 始まり、応答を返せなくなるため。
    sendResponse({ clicked: true, totalCount: getTotalItemCount() });

    await delay(CONFIG.DELETE_DELAY_MS + Math.floor(Math.random() * CONFIG.DELETE_RANDOM_MS));

    // 待っている間に一覧が再描画されて要素が差し替わっている可能性があるため、
    // クリック直前に取り直す
    const link = findDeleteLink(pageType, message.item.id);
    if (!link) {
      warn(`削除リンクが消えていました: ${message.item.title}`);
      // Backgroundは一覧の再読み込みを待っているので、現状を伝えて失敗扱いにさせる
      sendListReady(pageType);
      return;
    }
    log(`削除リンクをクリック: ${message.item.title}`);
    clickDeleteLink(link);
  })();
  return true;
}

/**
 * キューの進捗を一括操作バーへ反映する。
 */
function handleQueueProgress(
  message: QueueProgressMessage,
  sendResponse: AckSendResponse
): boolean {
  updateProgress(message.progress);
  queueState.setQueueRunning(message.progress.running);
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
  return false;
}

/**
 * Backgroundからのメッセージを受け取るリスナーを登録する。
 */
export function registerMessageHandlers(pageType: PageTypeValue): void {
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

      case MessageType.QUEUE_PROGRESS:
        keepChannelOpen = handleQueueProgress(message, sendResponse);
        break;

      default:
        sendResponse({ ok: true });
        break;
    }
    return keepChannelOpen ? true : undefined;
  });
}
