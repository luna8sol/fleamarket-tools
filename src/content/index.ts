// content scriptのエントリーポイント
import { appInitializer } from './logic/app-initializer';
import { setDebugMode } from './infra/logger';

// アプリケーション起動
appInitializer.initialize();

// メッセージリスナーを追加
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'updateDebugMode') {
    setDebugMode(message.debugMode);
    return true;
  }
});
