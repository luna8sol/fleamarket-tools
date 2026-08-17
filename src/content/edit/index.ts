import { CheckAutoTabResponse, MessageType } from '../../common/messages';
import { debug, log, setDebugMode } from '../../common/logger';
import { runAutoSubmit } from './auto-submit';

/**
 * 下書き編集ページ（/drafts/{hash}/edit）用Content Scriptのエントリポイント。
 *
 * 安全のため、Backgroundに「このタブは一括処理が開いた自動処理対象か」を
 * 必ず確認し、自動処理対象の場合のみ自動出品を実行する。
 * ユーザーが手動で開いた編集ページでは何もしない。
 */
async function main(): Promise<void> {
  setDebugMode(true);

  // 編集ページ以外（/drafts/ 配下の他ページ）では何もしない
  if (!/^\/drafts\/[^/]+\/edit/.test(window.location.pathname)) {
    return;
  }

  const response = (await chrome.runtime.sendMessage({
    type: MessageType.CHECK_AUTO_TAB,
  })) as CheckAutoTabResponse | undefined;

  if (!response?.isAutoTab) {
    debug('手動で開かれた編集ページのため何もしません');
    return;
  }

  log('自動処理対象の編集タブとして起動');
  await runAutoSubmit();
}

void main();
