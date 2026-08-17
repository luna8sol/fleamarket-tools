import { CheckAutoTabResponse, MessageType, SourceItem } from '../../common/messages';
import { sendToRuntime } from '../../common/send-message';
import { detectFormPageMode } from '../../common/form-page';
import { debug, log, setDebugMode, warn } from '../../common/logger';
import { CONFIG } from './constants';
import { runAutoSubmit } from './auto-submit';
import { runReplace } from './replace';
import { delay } from '../wait';

/**
 * 出品フォームページ用Content Scriptのエントリポイント。
 * 対象は下書き編集ページ (/drafts/{hash}/edit)・新規出品ページ (/item/new)・
 * 出品中商品の編集ページ (/item/{hash}/edit)。
 *
 * 安全のため、Backgroundに「このタブは一括処理が開いた自動処理対象か」を
 * 必ず確認し、自動処理対象の場合のみ自動出品を実行する。
 * ユーザーが手動で開いた出品ページでは何もしない。
 */

/**
 * Content Scriptの状態を <html data-rbl-form="..."> に残す。
 *
 * Content ScriptとService Workerのconsoleログは拡張の外からは読めず、
 * 「注入されていないのか」「自動処理対象と判定されなかったのか」を
 * 切り分ける手段がないため、状態をDOMに出しておく。
 * 画面の表示には影響しない。
 */
function markState(state: 'checking' | 'auto' | 'manual'): void {
  document.documentElement.dataset.rblForm = state;
}

/**
 * Backgroundへ自動処理対象か問い合わせる。
 *
 * Backgroundがこのタブを処理対象として確定するのと、このページの
 * Content Scriptが起動するのは別々のイベントで順序が保証されないため、
 * 数回リトライする。手動で開いたページでは全回falseになるだけで害はない。
 *
 * 自動処理対象の場合、応答には再出品元の内容（差分チェック用）が含まれる。
 */
async function checkAutoTab(): Promise<CheckAutoTabResponse | null> {
  for (let i = 0; i < CONFIG.CHECK_ATTEMPTS; i++) {
    try {
      const response = await sendToRuntime({ type: MessageType.CHECK_AUTO_TAB });
      if (response?.isAutoTab) return response;
    } catch (e) {
      warn('Backgroundへの問い合わせに失敗しました', e);
      return null;
    }
    if (i < CONFIG.CHECK_ATTEMPTS - 1) {
      await delay(CONFIG.CHECK_RETRY_MS);
    }
  }
  return null;
}

async function main(): Promise<void> {
  setDebugMode(true);

  // 出品フォーム以外（/drafts/ 配下の他ページ等）では何もしない
  const mode = detectFormPageMode(window.location.href);
  if (mode === null) {
    return;
  }

  markState('checking');

  const response = await checkAutoTab();
  if (response === null) {
    markState('manual');
    debug('手動で開かれた出品ページのため何もしません');
    return;
  }

  markState('auto');

  if (mode === 'replace') {
    // 押すボタンはページの中身ではなくモードで決める。編集ページにも
    // 「下書きに保存する」があるが、replace では「確認する」→「更新する」しか押さない
    const item = response.replaceItem ?? null;
    if (!item?.replace) {
      warn('replace の対象商品が Background から返らなかったため何もしません');
      await sendToRuntime({
        type: MessageType.FORM_FAILED,
        reason: '処理対象の本文を受け取れませんでした',
      }).catch((e) => warn('失敗の通知をBackgroundへ送れませんでした', e));
      return;
    }
    log(`自動処理対象の編集ページとして起動: mode=replace, ${item.title}`);
    await runReplace(item);
    return;
  }

  const expected: SourceItem | null = response.expected ?? null;
  log(
    `自動処理対象の出品フォームとして起動: mode=${mode}, ` +
      `再出品元の情報=${expected ? 'あり' : 'なし'}`
  );
  await runAutoSubmit(mode, expected);
}

void main();
