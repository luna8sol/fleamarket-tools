// 出品・下書き編集ページ用 content script のエントリーポイント
import { CONFIG } from './infra/constants';
import { detectCurrentPage, isSellFormPage } from './infra/page-detector';
import { loadUserSettings } from './infra/user-settings';
import { LogLevel, setLogLevel, setDebugMode, debug, warn } from './infra/logger';
import { debounce } from './infra/debounce';
import { renderDescriptionPanel } from './ui/description-panel';
import { MESSAGE_ACTION, UpdateDebugModeRequest } from '../common/messaging';

/**
 * ユーザー設定を読み込み、ログレベルを適用する。
 */
async function applyUserSettings(): Promise<void> {
  try {
    const settings = await loadUserSettings();
    setLogLevel(settings.debugMode ? LogLevel.DEBUG : LogLevel.LOG);
  } catch (e) {
    warn('設定の読み込み中にエラーが発生しました', e);
  }
}

/**
 * 説明欄が描画されるまで待ってAI説明文生成パネルを表示する。
 *
 * - 打ち切ったときは警告を残す。メルカリ側のDOMが変わって説明欄を見つけられなくなった場合、
 *   黙って何も表示されないと原因が追えないため。
 *
 * @param retryCount 現在の試行回数
 */
function renderWhenReady(retryCount = 0): void {
  if (!isSellFormPage() || renderDescriptionPanel()) {
    return;
  }

  if (retryCount >= CONFIG.EDIT_PANEL_MAX_RETRY_COUNT) {
    warn(`説明欄が ${CONFIG.EDIT_PANEL_MAX_RETRY_COUNT} 回の試行後も見つかりませんでした`);
    return;
  }

  window.setTimeout(() => renderWhenReady(retryCount + 1), CONFIG.EDIT_PANEL_RETRY_INTERVAL_MS);
}

/**
 * DOM変更を監視し、SPA遷移やフォーム再描画のあとでもパネルを復活させる。
 *
 * - メルカリの出品フォームはSPAでページ遷移するため、監視はページが閉じるまで続ける必要がある。
 *   そのため明示的な disconnect は行わない。
 */
function observeFormChanges(): void {
  const render = debounce(() => {
    if (isSellFormPage()) {
      renderDescriptionPanel();
    }
  }, CONFIG.DEBOUNCE_INTERVAL_MS);

  new MutationObserver(render).observe(document.body, { childList: true, subtree: true });
  debug('編集フォームの監視を開始しました');
}

debug('編集ページ用スクリプトを初期化します', { pageType: detectCurrentPage() });

void applyUserSettings();

// /sell（出品トップ）から /sell/create へのSPA遷移でもパネルを出せるよう、
// 読み込み時のページ種別で分岐せず常に監視を始める。表示可否は都度 isSellFormPage() で判定する。
renderWhenReady();
observeFormChanges();

// popup からのデバッグモード変更通知を受け取る
chrome.runtime.onMessage.addListener((message: UpdateDebugModeRequest) => {
  if (message?.action === MESSAGE_ACTION.UPDATE_DEBUG_MODE) {
    setDebugMode(message.debugMode);
    return true;
  }
  return undefined;
});
