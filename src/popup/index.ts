import { loadUserSettings, saveUserSettings } from '../content/infra/user-settings';
import { loadAutoSaveSettings, saveAutoSaveSettings } from '../content/infra/auto-save-settings';
import { AutoSaveSettings } from '../content/infra/types';

/** 「保存しました」を出しておく時間 */
const SAVED_INDICATOR_MS = 1600;

let savedTimer = 0;

/**
 * 設定を保存した結果を見出しの横で短く知らせる
 *
 * 切り替えるだけで保存される（保存ボタンが無い）ので、反映されたことを目で確かめられるようにする。
 * **失敗したときに「保存しました」と出さない。** 失敗は消さずに残す。
 *
 * @param saved 保存できたか
 */
function flashSaved(saved: boolean): void {
  const indicator = document.getElementById('saved-indicator');
  if (!indicator) return;

  const label = indicator.querySelector('span');
  if (label) label.textContent = saved ? '保存しました' : '保存できませんでした';
  indicator.dataset.tone = saved ? 'success' : 'error';
  indicator.dataset.visible = 'true';
  window.clearTimeout(savedTimer);
  if (!saved) return;

  savedTimer = window.setTimeout(() => {
    indicator.dataset.visible = 'false';
  }, SAVED_INDICATOR_MS);
}

// ページ読み込み時に実行
document.addEventListener('DOMContentLoaded', () => {
  void initializeDebugToggle();
  void initializeAutoSaveToggles();
  initializeFooter();
});

/**
 * フッター（設定画面への導線・バージョン表示）の初期化
 */
function initializeFooter(): void {
  document.getElementById('open-options')?.addEventListener('click', () => {
    void chrome.runtime.openOptionsPage();
  });

  const version = document.getElementById('version');
  if (version) {
    version.textContent = `v${chrome.runtime.getManifest().version}`;
  }
}

/**
 * デバッグモード切り替えの初期化
 */
async function initializeDebugToggle(): Promise<void> {
  const debugToggle = document.getElementById('debug-mode') as HTMLInputElement;
  if (!debugToggle) return;

  // 現在の設定を読み込み
  const settings = await loadUserSettings();

  // チェックボックスの状態を設定に合わせる
  debugToggle.checked = settings.debugMode;

  // 変更イベントのリスナーを追加
  debugToggle.addEventListener('change', () => {
    // 設定を更新して保存
    settings.debugMode = debugToggle.checked;
    void saveUserSettings(settings).then(flashSaved);

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

/**
 * 再出品後の自動保存トグルの初期化
 *
 * 設定は chrome.storage.local に保存するため、出品フォームのタブからも
 * 同じ値を参照できます。
 */
async function initializeAutoSaveToggles(): Promise<void> {
  const enabledToggle = document.getElementById('auto-save-enabled') as HTMLInputElement | null;
  const dryRunToggle = document.getElementById('auto-save-dry-run') as HTMLInputElement | null;
  if (!enabledToggle || !dryRunToggle) return;

  const settings = await loadAutoSaveSettings();
  enabledToggle.checked = settings.autoSaveAfterRelist;
  dryRunToggle.checked = settings.autoSaveDryRun;
  dryRunToggle.disabled = !settings.autoSaveAfterRelist;

  /** 画面の状態を設定へ書き戻す */
  const persist = async (): Promise<void> => {
    const next: AutoSaveSettings = {
      autoSaveAfterRelist: enabledToggle.checked,
      autoSaveDryRun: dryRunToggle.checked
    };
    dryRunToggle.disabled = !next.autoSaveAfterRelist;
    flashSaved(await saveAutoSaveSettings(next));
  };

  enabledToggle.addEventListener('change', () => void persist());
  dryRunToggle.addEventListener('change', () => void persist());
}
