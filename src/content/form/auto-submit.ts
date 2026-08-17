import { MessageType, QueueMode } from '../../common/messages';
import { log, warn } from '../../common/logger';
import { listRenderedButtonLabels, waitForButton } from './button-finder';
import { collectValidationErrors, waitForFormFilled } from './form-state';
import { delay } from './wait';

/** 各ボタンの出現を待つ最大時間 (ms) */
const BUTTON_TIMEOUT_MS = 30000;
/** フォームに値が入るのを待つ最大時間 (ms) */
const FORM_FILL_TIMEOUT_MS = 20000;
/** 値が入ってからボタンを押すまでの待機時間 (ms) — 入力完了を待つ */
const FORM_SETTLE_MS = 2000;
/** ボタンクリック間の待機時間 (ms) — 人間的な間を空ける */
const CLICK_DELAY_MS = 1500;

/** ボタンのラベル */
const LABEL = {
  DRAFT_SAVE: '下書きに保存する',
  CONFIRM: '確認する',
  PUBLISH: '出品する',
};

/**
 * 失敗理由に画面の状況を添える。
 * バリデーションエラーがあればそれを、なければ表示中のボタンを列挙する
 * （ボタンのラベルが想定と違った場合に気づけるようにする）。
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
 * relist: 新規出品ページ (/item/new) の内容を下書きとして保存する。
 *
 * ここでは出品まで行わない。フリマアシストが複製した内容を下書きに溜めておき、
 * 公開は「下書きの商品」(/draft) からの一括出品で行う運用にするため。
 */
async function saveAsDraft(): Promise<void> {
  const draftBtn = await waitForButton(LABEL.DRAFT_SAVE, { timeoutMs: BUTTON_TIMEOUT_MS });
  await delay(CLICK_DELAY_MS);

  // クリック直後にページが遷移してContent Scriptが破棄されうるため、
  // 「これから保存する」ことを先にBackgroundへ伝えておく
  await chrome.runtime.sendMessage({ type: MessageType.FORM_SUBMITTED });

  log(`「${LABEL.DRAFT_SAVE}」をクリック`);
  draftBtn.click();
}

/**
 * publish: 下書き編集ページ (/drafts/{hash}/edit) の内容を出品する。
 */
async function publish(): Promise<void> {
  // 実機では type="button"。preferSubmit を付けないこと。
  const confirmBtn = await waitForButton(LABEL.CONFIRM, { timeoutMs: BUTTON_TIMEOUT_MS });
  log(`「${LABEL.CONFIRM}」をクリック`);
  confirmBtn.click();

  // 「出品する」は確認画面に切り替わってから現れる（モーダルではなくURLも変わらない）。
  const submitBtn = await waitForButton(LABEL.PUBLISH, {
    timeoutMs: BUTTON_TIMEOUT_MS,
    preferSubmit: true,
  });
  await delay(CLICK_DELAY_MS);

  await chrome.runtime.sendMessage({ type: MessageType.FORM_SUBMITTED });

  log(`「${LABEL.PUBLISH}」をクリック`);
  submitBtn.click();
}

/**
 * 出品フォームを自動操作する。モードによって押すボタンが異なる。
 *
 * - relist  (/item/new):            「下書きに保存する」
 * - publish (/drafts/{hash}/edit):  「確認する」→「出品する」
 *
 * 完了判定はBackground側がタブのURL遷移で行うため、ここではボタンを
 * 押すところまでを担当する。ボタンが見つからない・バリデーションエラーで
 * 進めない場合はタイムアウトし、FORM_FAILEDを送信してタブは開いたまま残す
 * （ユーザーが状況確認できるように）。
 */
export async function runAutoSubmit(mode: QueueMode): Promise<void> {
  try {
    // フォームに値が流し込まれるのを待つ（空のまま保存・送信しないため）
    const filled = await waitForFormFilled(FORM_FILL_TIMEOUT_MS);
    if (!filled) {
      warn('フォームへの入力を確認できませんでしたが、処理を続行します');
    }
    await delay(FORM_SETTLE_MS);

    if (mode === 'relist') {
      await saveAsDraft();
    } else {
      await publish();
    }
  } catch (e) {
    const reason = describeFailure(e instanceof Error ? e.message : String(e));
    warn('自動処理に失敗しました:', reason);
    await chrome.runtime.sendMessage({ type: MessageType.FORM_FAILED, reason });
  }
}
