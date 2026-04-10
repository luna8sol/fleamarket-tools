import { StorageKey, loadFromStorage, saveToStorage } from '../content/infra/storage';
import { UserSettings } from '../content/infra/types';
import { DEFAULT_USER_SETTINGS } from '../content/infra/constants';

/**
 * popup.htmlの「開始」ボタンにクリックイベントを登録し、
 * 拡張機能の動作確認用アラートを表示する。
 */
document.getElementById('start')?.addEventListener('click', () => {
  alert('拡張機能が動作しました！');
});

// ページ読み込み時に実行
document.addEventListener('DOMContentLoaded', () => {
  initializeDebugToggle();
  // 他の初期化処理...
});

/**
 * デバッグモード切り替えの初期化
 */
function initializeDebugToggle(): void {
  const debugToggle = document.getElementById('debug-mode') as HTMLInputElement;
  if (!debugToggle) return;

  // 現在の設定を読み込み
  const settings = loadFromStorage<UserSettings>(StorageKey.USER_SETTINGS, DEFAULT_USER_SETTINGS);

  // チェックボックスの状態を設定に合わせる
  debugToggle.checked = settings.debugMode;

  // 変更イベントのリスナーを追加
  debugToggle.addEventListener('change', () => {
    // 設定を更新して保存
    settings.debugMode = debugToggle.checked;
    saveToStorage(StorageKey.USER_SETTINGS, settings);

    // デバッグモードの変更をコンテンツスクリプトに通知
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'updateDebugMode',
          debugMode: debugToggle.checked
        });
      }
    });
  });
}
