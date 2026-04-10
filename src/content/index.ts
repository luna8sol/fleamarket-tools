// content scriptのエントリーポイント
import { observerManager } from './logic/observer-manager';
import { appInitializer } from './logic/app-initializer';
import { setDebugMode } from './infra/logger';

// アプリケーション起動
appInitializer.initialize();

// 監視開始
observerManager.startObserving();

// メッセージリスナーを追加
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'updateDebugMode') {
    setDebugMode(message.debugMode);
    return true;
  }
});
