import { MessageType } from '../../common/messages';
import { log, warn } from '../../common/logger';
import { waitForButton } from './button-finder';

/** 各ボタンの出現を待つ最大時間 (ms) */
const BUTTON_TIMEOUT_MS = 30000;
/** 出品完了（下書き一覧への遷移）を待つ最大時間 (ms) */
const NAVIGATION_TIMEOUT_MS = 30000;
/** ボタンクリック間の待機時間 (ms) — 人間的な間を空ける */
const CLICK_DELAY_MS = 1500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/**
 * 編集ページのURL（/drafts/{hash}/edit）から離れたことを検知する。
 * 出品完了後は下書き一覧へ遷移するため、これを完了とみなす。
 * SPA遷移の可能性があるためURLをポーリングで監視する。
 */
function waitForLeaveEditPage(timeoutMs: number): Promise<void> {
  const editPathPattern = /^\/drafts\/[^/]+\/edit/;

  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    const check = (): void => {
      if (!editPathPattern.test(window.location.pathname)) {
        resolve();
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error(`出品完了（画面遷移）が${timeoutMs}ms以内に確認できませんでした`));
        return;
      }
      window.setTimeout(check, 500);
    };

    check();
  });
}

/**
 * 下書き編集ページで「確認する」→「出品する」を自動クリックし、
 * 出品完了（下書き一覧への遷移）を検知してBackgroundへ通知する。
 *
 * バリデーションエラー等で進めない場合はタイムアウトし、
 * EDIT_FAILEDを送信してタブは開いたまま残す（ユーザーが状況確認できるように）。
 */
export async function runAutoSubmit(): Promise<void> {
  try {
    // フォーム描画を待ってから「確認する」をクリック
    const confirmBtn = await waitForButton('確認する', { timeoutMs: BUTTON_TIMEOUT_MS });
    await delay(CLICK_DELAY_MS);
    log('「確認する」をクリック');
    confirmBtn.click();

    // 確認モーダルの「出品する」（type="submit"）をクリック
    const submitBtn = await waitForButton('出品する', {
      timeoutMs: BUTTON_TIMEOUT_MS,
      submitOnly: true,
    });
    await delay(CLICK_DELAY_MS);
    log('「出品する」をクリック');
    submitBtn.click();

    // 下書き一覧への遷移 = 出品完了
    await waitForLeaveEditPage(NAVIGATION_TIMEOUT_MS);
    log('出品完了を検知');

    await chrome.runtime.sendMessage({ type: MessageType.EDIT_COMPLETED });
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    warn('自動出品に失敗しました:', reason);
    await chrome.runtime.sendMessage({ type: MessageType.EDIT_FAILED, reason });
  }
}
