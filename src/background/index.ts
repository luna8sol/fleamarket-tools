import {
  AckResponse,
  CheckAutoTabResponse,
  ExtensionMessage,
  MessageType,
  MessageTypeValue,
  StartQueueResponse,
} from '../common/messages';
import { log, warn } from '../common/logger';
import { queueManager } from './queue-manager';

/**
 * Background Service Worker のエントリポイント。
 * メッセージ・タブイベント・アラームを QueueManager へ配線する。
 *
 * MV3のService Workerはいつでも破棄されうるため、すべてのハンドラは
 * queueManager.ensureLoaded() で永続化された状態を復元してから処理する。
 */

/** 応答内容を持たないメッセージへのACK */
const ACK: AckResponse = { ok: true };

/**
 * メッセージの送信元タブのIDを取り出す。
 *
 * 取り出せないのはContent Script以外（ポップアップ等）から送られた場合で、
 * タブに紐づく処理はできない。黙ってACKを返すと送信側は成功したと解釈するため、
 * ここで記録してから undefined を返す。
 */
function senderTabId(
  sender: chrome.runtime.MessageSender,
  type: MessageTypeValue
): number | undefined {
  const tabId = sender.tab?.id;
  if (tabId === undefined) {
    warn(`送信元のタブが特定できないため処理しませんでした: ${type}`);
  }
  return tabId;
}

/**
 * メッセージを処理し、送信側へ返す値を返す。
 *
 * NOTE: 状態復元のため応答は常に非同期になり、リスナーは常に true を返す
 *       （＝チャネルを開いたままにする）。このとき sendResponse を呼ばないと
 *       送信側の sendMessage の Promise が解決されないため、
 *       すべての分岐で必ず何かを返すこと。
 */
async function handleMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender
): Promise<unknown> {
  await queueManager.ensureLoaded();

  switch (message.type) {
    case MessageType.START_QUEUE: {
      const listTabId = senderTabId(sender, message.type);
      if (listTabId === undefined) {
        const response: StartQueueResponse = {
          started: false,
          reason: '送信元のタブを特定できないため開始できません',
        };
        return response;
      }
      return queueManager.start(message.mode, message.items, listTabId, message.listPage);
    }

    case MessageType.STOP_QUEUE:
      await queueManager.stop();
      return ACK;

    case MessageType.GET_PROGRESS:
      return queueManager.getProgress();

    case MessageType.CHECK_AUTO_TAB: {
      const tabId = senderTabId(sender, message.type);
      const isAutoTab = tabId !== undefined && queueManager.isAutoTab(tabId);
      const response: CheckAutoTabResponse = {
        isAutoTab,
        expected: isAutoTab && tabId !== undefined ? queueManager.getExpectedSource(tabId) : null,
      };
      return response;
    }

    case MessageType.LIST_READY: {
      const tabId = senderTabId(sender, message.type);
      if (tabId !== undefined) {
        await queueManager.handleListReady(tabId, message.ids, message.totalCount ?? null);
      }
      return ACK;
    }

    case MessageType.FORM_SUBMITTED: {
      const tabId = senderTabId(sender, message.type);
      if (tabId !== undefined) {
        await queueManager.handleFormSubmitted(tabId);
      }
      return ACK;
    }

    case MessageType.FORM_FAILED: {
      const tabId = senderTabId(sender, message.type);
      if (tabId !== undefined) {
        await queueManager.handleFormFailed(tabId, message.reason);
      }
      return ACK;
    }

    // ListBoundMessage（bg → list）。chrome.tabs.sendMessage で一覧タブへ送るもの
    // なのでここには届かないが、届いたときに黙って捨てないよう受けておく。
    // 引数を BackgroundBoundMessage に狭めるとこの分岐を書けなくなるため、
    // 受信側の型は ExtensionMessage のままにしている。
    case MessageType.CLICK_RELIST:
    case MessageType.CLICK_DELETE:
    case MessageType.QUEUE_PROGRESS:
      warn(`Background宛ではないメッセージを受け取りました: ${message.type}`);
      return ACK;

    default: {
      // 型の上では到達しない。到達したらハンドラの追加漏れなので、
      // 黙ってACKを返さず記録する（送信側の待ち合わせのためACK自体は返す）。
      const _exhaustive: never = message;
      warn('未対応のメッセージ種別です', _exhaustive);
      return ACK;
    }
  }
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((e) => {
      warn('メッセージの処理に失敗しました', e);
      sendResponse({ ok: false });
    });
  return true;
});

chrome.tabs.onCreated.addListener((tab) => {
  void queueManager.ensureLoaded().then(() => queueManager.handleTabCreated(tab));
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  void queueManager
    .ensureLoaded()
    .then(() => queueManager.handleTabUpdated(tabId, changeInfo, tab));
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void queueManager.ensureLoaded().then(() => queueManager.handleTabRemoved(tabId));
});

chrome.alarms.onAlarm.addListener((alarm) => {
  void queueManager.ensureLoaded().then(() => queueManager.handleAlarm(alarm.name));
});

log('background service worker started');
