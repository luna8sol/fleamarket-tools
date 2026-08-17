import {
  CheckAutoTabResponse,
  ExtensionMessage,
  MessageType,
} from '../common/messages';
import { log } from '../common/logger';
import { queueManager } from './queue-manager';

/**
 * Background Service Worker のエントリポイント。
 * メッセージ・タブイベント・アラームを QueueManager へ配線する。
 */

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, sendResponse): boolean | undefined => {
    switch (message.type) {
      case MessageType.START_QUEUE: {
        const listTabId = sender.tab?.id;
        if (listTabId !== undefined) {
          queueManager.start(message.mode, message.items, listTabId);
        }
        return undefined;
      }

      case MessageType.STOP_QUEUE:
        queueManager.stop();
        return undefined;

      case MessageType.GET_PROGRESS:
        sendResponse(queueManager.getProgress());
        return undefined;

      case MessageType.CHECK_AUTO_TAB: {
        const tabId = sender.tab?.id;
        const response: CheckAutoTabResponse = {
          isAutoTab: tabId !== undefined && queueManager.isAutoTab(tabId),
        };
        sendResponse(response);
        return undefined;
      }

      case MessageType.EDIT_COMPLETED: {
        const tabId = sender.tab?.id;
        if (tabId !== undefined) {
          queueManager.handleEditCompleted(tabId);
        }
        return undefined;
      }

      case MessageType.EDIT_FAILED: {
        const tabId = sender.tab?.id;
        if (tabId !== undefined) {
          queueManager.handleEditFailed(tabId, message.reason);
        }
        return undefined;
      }

      default:
        return undefined;
    }
  }
);

chrome.tabs.onCreated.addListener((tab) => {
  queueManager.handleTabCreated(tab);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  queueManager.handleTabRemoved(tabId);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  queueManager.handleAlarm(alarm.name);
});

log('background service worker started');
