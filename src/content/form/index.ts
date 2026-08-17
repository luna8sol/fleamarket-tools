import { CheckAutoTabResponse, MessageType } from '../../common/messages';
import { detectFormPageMode } from '../../common/form-page';
import { debug, log, setDebugMode, warn } from '../../common/logger';
import { runAutoSubmit } from './auto-submit';
import { delay } from './wait';

/**
 * 出品フォームページ用Content Scriptのエントリポイント。
 * 対象は下書き編集ページ (/drafts/{hash}/edit) と新規出品ページ (/item/new)。
 *
 * 安全のため、Backgroundに「このタブは一括処理が開いた自動処理対象か」を
 * 必ず確認し、自動処理対象の場合のみ自動出品を実行する。
 * ユーザーが手動で開いた出品ページでは何もしない。
 */

/** 自動処理対象かの問い合わせ回数 */
const CHECK_ATTEMPTS = 3;
/** 問い合わせのリトライ間隔 (ms) */
const CHECK_RETRY_MS = 700;

/**
 * Backgroundへ自動処理対象か問い合わせる。
 *
 * Backgroundがこのタブを処理対象として確定するのと、このページの
 * Content Scriptが起動するのは別々のイベントで順序が保証されないため、
 * 数回リトライする。手動で開いたページでは全回falseになるだけで害はない。
 */
async function isAutoTab(): Promise<boolean> {
  for (let i = 0; i < CHECK_ATTEMPTS; i++) {
    try {
      const response = (await chrome.runtime.sendMessage({
        type: MessageType.CHECK_AUTO_TAB,
      })) as CheckAutoTabResponse | undefined;
      if (response?.isAutoTab) return true;
    } catch (e) {
      warn('Backgroundへの問い合わせに失敗しました', e);
      return false;
    }
    if (i < CHECK_ATTEMPTS - 1) {
      await delay(CHECK_RETRY_MS);
    }
  }
  return false;
}

async function main(): Promise<void> {
  setDebugMode(true);

  // 出品フォーム以外（/drafts/ 配下の他ページ等）では何もしない
  if (detectFormPageMode(window.location.href) === null) {
    return;
  }

  if (!(await isAutoTab())) {
    debug('手動で開かれた出品ページのため何もしません');
    return;
  }

  log('自動処理対象の出品フォームとして起動');
  await runAutoSubmit();
}

void main();
