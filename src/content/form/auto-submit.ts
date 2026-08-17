import { FormMode, MessageType, SourceItem } from '../../common/messages';
import { log, warn } from '../../common/logger';
import { listRenderedButtonLabels, waitForButton } from './button-finder';
import { collectValidationErrors, FormSnapshot, waitForFormSettled } from './form-state';
import { diffAgainstSource, formatDifferences } from './diff';
import { delay } from './wait';

/** 各ボタンの出現を待つ最大時間 (ms) */
const BUTTON_TIMEOUT_MS = 30000;
/** フォームの内容がこの時間だけ変化しなければ入力完了とみなす (ms) */
const FORM_STABLE_MS = 5000;
/** 入力完了を待つ最大時間 (ms)。画像のアップロードを待つため長めにとる */
const FORM_SETTLE_TIMEOUT_MS = 120000;
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

async function sendFailed(reason: string): Promise<void> {
  warn('自動処理に失敗しました:', reason);
  await chrome.runtime.sendMessage({ type: MessageType.FORM_FAILED, reason });
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
 * 保存・出品してよい状態かを判定する。
 *
 * - 再出品元の内容が分かる場合は、一致するまで保存しない。
 *   内容が欠けたまま保存されるのを防ぐのが目的なので、ここは厳密に見る。
 * - 分からない場合は、入力が落ち着いたかどうかだけで判断する。
 *
 * 進めない場合は理由を返す。
 */
function checkReadyToSubmit(
  snapshot: FormSnapshot,
  settled: boolean,
  expected: SourceItem | null
): string | null {
  if (expected) {
    const differences = diffAgainstSource(snapshot, expected);
    if (differences.length > 0) {
      return `再出品元と内容が一致しません（${formatDifferences(differences)}）`;
    }
    // 差分が無いなら、多少変化が続いていても内容は揃っている
    return null;
  }

  if (!settled) {
    return '入力が完了しませんでした（内容が欠けたまま保存しないため中止しました）';
  }
  return null;
}

/**
 * 出品フォームを自動操作する。モードによって押すボタンが異なる。
 *
 * - relist  (/item/new):            「下書きに保存する」
 * - publish (/drafts/{hash}/edit):  「確認する」→「出品する」
 *
 * 押す前にフォームの内容が落ち着くまで待ち、さらに再出品元と突き合わせる。
 * 完了判定はBackground側がタブのURL遷移で行うため、ここではボタンを
 * 押すところまでを担当する。失敗時はタブを開いたまま残す。
 */
export async function runAutoSubmit(mode: FormMode, expected: SourceItem | null): Promise<void> {
  try {
    const { settled, snapshot, waitedMs } = await waitForFormSettled({
      stableMs: FORM_STABLE_MS,
      timeoutMs: FORM_SETTLE_TIMEOUT_MS,
      requireImages: mode === 'relist',
    });
    log(
      `入力待ち終了: settled=${settled}, ${Math.round(waitedMs / 1000)}秒, ` +
        `画像${snapshot.imageCount}枚, 説明${snapshot.description.length}文字`
    );

    const blockedReason = checkReadyToSubmit(snapshot, settled, expected);
    if (blockedReason !== null) {
      await sendFailed(blockedReason);
      return;
    }

    await delay(CLICK_DELAY_MS);

    if (mode === 'relist') {
      await saveAsDraft();
    } else {
      await publish();
    }
  } catch (e) {
    await sendFailed(describeFailure(e instanceof Error ? e.message : String(e)));
  }
}
