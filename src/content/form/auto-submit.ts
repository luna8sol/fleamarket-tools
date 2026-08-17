import { MessageType } from '../../common/messages';
import { log, warn } from '../../common/logger';
import { listRenderedButtonLabels, waitForButton } from './button-finder';
import { collectValidationErrors, waitForFormFilled } from './form-state';
import { delay } from './wait';

/** 各ボタンの出現を待つ最大時間 (ms) */
const BUTTON_TIMEOUT_MS = 30000;
/** フォームに値が入るのを待つ最大時間 (ms) */
const FORM_FILL_TIMEOUT_MS = 20000;
/** 値が入ってから「確認する」を押すまでの待機時間 (ms) — 入力完了を待つ */
const FORM_SETTLE_MS = 2000;
/** ボタンクリック間の待機時間 (ms) — 人間的な間を空ける */
const CLICK_DELAY_MS = 1500;

/**
 * 失敗理由に画面の状況を添える。
 * バリデーションエラーがあればそれを、なければ表示中のボタンを列挙する
 * （「出品する」のラベルが想定と違った場合に気づけるようにする）。
 */
function describeFailure(reason: string): string {
  const errors = collectValidationErrors();
  if (errors.length > 0) {
    return `${reason} / 入力エラー: ${errors.join(' ')}`;
  }
  const labels = listRenderedButtonLabels();
  if (labels.length > 0) {
    return `${reason} / 表示中のボタン: ${labels.join(', ')}`;
  }
  return reason;
}

/**
 * 出品フォーム（/drafts/{hash}/edit または /item/new）で
 * 「確認する」→「出品する」を自動クリックする。
 *
 * 出品完了の判定はBackground側がタブのURL遷移で行うため、
 * ここでは「出品する」を押すところまでを担当する。
 * ボタンが見つからない・バリデーションエラーで進めない場合はタイムアウトし、
 * FORM_FAILEDを送信してタブは開いたまま残す（ユーザーが状況確認できるように）。
 */
export async function runAutoSubmit(): Promise<void> {
  try {
    // フォームに値が流し込まれるのを待つ（空のまま送信しないため）
    const filled = await waitForFormFilled(FORM_FILL_TIMEOUT_MS);
    if (!filled) {
      warn('フォームへの入力を確認できませんでしたが、処理を続行します');
    }
    await delay(FORM_SETTLE_MS);

    // 実機では type="button"。submitOnly を条件にしないこと。
    const confirmBtn = await waitForButton('確認する', { timeoutMs: BUTTON_TIMEOUT_MS });
    log('「確認する」をクリック');
    confirmBtn.click();

    // 「出品する」は確認画面に切り替わってから現れる（モーダルではなくURLも変わらない）。
    const submitBtn = await waitForButton('出品する', {
      timeoutMs: BUTTON_TIMEOUT_MS,
      preferSubmit: true,
    });
    await delay(CLICK_DELAY_MS);

    // クリック直後にページが遷移してContent Scriptが破棄されうるため、
    // 「これから送信する」ことを先にBackgroundへ伝えておく
    await chrome.runtime.sendMessage({ type: MessageType.FORM_SUBMITTED });

    log('「出品する」をクリック');
    submitBtn.click();
  } catch (e) {
    const reason = describeFailure(e instanceof Error ? e.message : String(e));
    warn('自動出品に失敗しました:', reason);
    await chrome.runtime.sendMessage({ type: MessageType.FORM_FAILED, reason });
  }
}
