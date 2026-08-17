import { CheckAutoTabResponse, ExtensionMessage, MessageType } from '../common/messages';
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
const ACK = { ok: true } as const;

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
      const listTabId = sender.tab?.id;
      if (listTabId !== undefined) {
        await queueManager.start(message.mode, message.items, listTabId);
      }
      return ACK;
    }

    case MessageType.STOP_QUEUE:
      await queueManager.stop();
      return ACK;

    case MessageType.GET_PROGRESS:
      return queueManager.getProgress();

    case MessageType.CHECK_AUTO_TAB: {
      const tabId = sender.tab?.id;
      const response: CheckAutoTabResponse = {
        isAutoTab: tabId !== undefined && queueManager.isAutoTab(tabId),
      };
      return response;
    }

    case MessageType.LIST_READY: {
      const tabId = sender.tab?.id;
      if (tabId !== undefined) {
        await queueManager.handleListReady(tabId, message.ids);
      }
      return ACK;
    }

    case MessageType.FORM_SUBMITTED: {
      const tabId = sender.tab?.id;
      if (tabId !== undefined) {
        await queueManager.handleFormSubmitted(tabId);
      }
      return ACK;
    }

    case MessageType.FORM_FAILED: {
      const tabId = sender.tab?.id;
      if (tabId !== undefined) {
        await queueManager.handleFormFailed(tabId, message.reason);
      }
      return ACK;
    }

    default:
      return ACK;
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
