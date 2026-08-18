import {
  ExtStorageKey,
  getExtStorage,
  setExtStorage,
  removeExtStorage,
} from '../common/ext-storage';
import { buildExtensionPageTokenCss } from '../common/theme-tokens';
import { ensureStyleSheet } from '@fleamarket/core/style';

/**
 * options page（options.html）のエントリーポイント。
 *
 * - Claude APIキーの入力・保存・削除を担当します。
 * - APIキーは chrome.storage.local に保存し、実際の API 呼び出しは background からのみ行います。
 * - このスクリプトは options.html の head で同期的に読み込み、描画前にトークン（CSS 変数）を
 *   `<style>` として差し込みます。DOM の組み立ては DOMContentLoaded で行います。
 */

ensureStyleSheet({ id: 'mdp-page-tokens', css: buildExtensionPageTokenCss });

/**
 * ステータス表示を更新する。
 *
 * @param message 表示するメッセージ
 * @param type 表示種別（成功/失敗）
 */
function showStatus(message: string, type: 'success' | 'error'): void {
  const status = document.getElementById('status');
  if (!status) return;

  status.textContent = message;
  status.className = `status ${type}`;
}

/**
 * 見出し横の「設定済み / 未設定」を更新する。
 *
 * @param hasKey 保存済みのキーがあるか
 */
function showKeyState(hasKey: boolean): void {
  const state = document.getElementById('key-state');
  if (!state) return;

  state.textContent = hasKey ? '設定済み' : '未設定';
  state.dataset.tone = hasKey ? 'success' : 'warning';
}

/**
 * APIキー入力欄の初期化とイベント登録を行う。
 */
async function initializeApiKeyField(): Promise<void> {
  const input = document.getElementById('api-key') as HTMLInputElement | null;
  const showToggle = document.getElementById('toggle-api-key');
  const saveButton = document.getElementById('save');
  const clearButton = document.getElementById('clear');

  if (!input || !showToggle || !saveButton || !clearButton) {
    showStatus('設定画面の初期化に失敗しました。', 'error');
    return;
  }

  // 保存済みのAPIキーを反映
  input.value = await getExtStorage<string>(ExtStorageKey.CLAUDE_API_KEY, '');
  showKeyState(input.value !== '');

  showToggle.addEventListener('click', () => {
    const visible = showToggle.getAttribute('aria-pressed') !== 'true';
    const label = visible ? 'APIキーを隠す' : 'APIキーを表示する';
    input.type = visible ? 'text' : 'password';
    showToggle.setAttribute('aria-pressed', visible ? 'true' : 'false');
    showToggle.setAttribute('aria-label', label);
    showToggle.title = label;
  });

  // Enter でも保存できるようにする（貼り付けてそのまま確定する操作が多いため）
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveButton.click();
  });

  saveButton.addEventListener('click', () => {
    void (async (): Promise<void> => {
      const apiKey = input.value.trim();
      if (apiKey === '') {
        showStatus('APIキーを入力してください。', 'error');
        return;
      }

      const saved = await setExtStorage(ExtStorageKey.CLAUDE_API_KEY, apiKey);
      if (saved) showKeyState(true);
      showStatus(
        saved ? 'APIキーを保存しました。' : 'APIキーの保存に失敗しました。',
        saved ? 'success' : 'error'
      );
    })();
  });

  clearButton.addEventListener('click', () => {
    void (async (): Promise<void> => {
      const removed = await removeExtStorage(ExtStorageKey.CLAUDE_API_KEY);
      if (removed) {
        input.value = '';
        showKeyState(false);
      }
      showStatus(
        removed ? 'APIキーを削除しました。' : 'APIキーの削除に失敗しました。',
        removed ? 'success' : 'error'
      );
    })();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  void initializeApiKeyField();
});
