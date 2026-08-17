import { FormMode, MessageType, SourceItem } from '../../common/messages';
import { sendToRuntime } from '../../common/send-message';
import { log, warn } from '../../common/logger';
import { CONFIG, LABEL } from './constants';
import { listRenderedButtonLabels, waitForButton } from './button-finder';
import {
  collectValidationErrors,
  describeFormImages,
  FormSnapshot,
  waitForFormSettled,
} from './form-state';
import { diffAgainstSource, formatDifferences } from './diff';
import { delay } from '../wait';

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

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * 失敗をBackgroundへ伝える。
 *
 * ここでの送信失敗はもう伝える先が無いため warn に落として握る
 * （unhandled rejection にすると、通知できなかったことすら残らない）。
 */
async function sendFailed(reason: string): Promise<void> {
  warn('自動処理に失敗しました:', reason);
  await sendToRuntime({ type: MessageType.FORM_FAILED, reason }).catch((e) =>
    warn('失敗の通知をBackgroundへ送れませんでした', e)
  );
}

/**
 * これからボタンを押すことをBackgroundへ伝える。**送れたことを確認してから押す。**
 *
 * クリック直後にページが遷移してContent Scriptが破棄されうるため、伝えるのは
 * 必ずクリックの前（この順序を入れ替えない）。
 *
 * 送れなかった場合はクリックせずに throw して、通信失敗を理由に失敗として扱う。
 * Backgroundが知らないまま押してしまうと、完了も失敗も観測されないまま
 * ウォッチドッグの時間切れを待つことになり、通信に失敗したことも分からない。
 */
async function sendSubmittedBeforeClick(label: string): Promise<void> {
  try {
    await sendToRuntime({ type: MessageType.FORM_SUBMITTED });
  } catch (e) {
    throw new Error(
      `Backgroundへ通知できなかったため「${label}」を押しませんでした（通信失敗: ${errorMessage(e)}）`
    );
  }
}

/**
 * relist: 新規出品ページ (/item/new) の内容を下書きとして保存する。
 *
 * ここでは出品まで行わない。フリマアシストが複製した内容を下書きに溜めておき、
 * 公開は「下書きの商品」(/draft) からの一括出品で行う運用にするため。
 */
async function saveAsDraft(): Promise<void> {
  const draftBtn = await waitForButton(LABEL.DRAFT_SAVE, { timeoutMs: CONFIG.BUTTON_TIMEOUT_MS });
  await delay(CONFIG.CLICK_DELAY_MS);

  // 「これから保存する」ことを先にBackgroundへ伝え、送れた場合だけクリックする
  await sendSubmittedBeforeClick(LABEL.DRAFT_SAVE);

  log(`「${LABEL.DRAFT_SAVE}」をクリック`);
  draftBtn.click();
}

/**
 * publish: 下書き編集ページ (/drafts/{hash}/edit) の内容を出品する。
 */
async function publish(): Promise<void> {
  // 実機では type="button"。preferSubmit を付けないこと。
  const confirmBtn = await waitForButton(LABEL.CONFIRM, { timeoutMs: CONFIG.BUTTON_TIMEOUT_MS });
  log(`「${LABEL.CONFIRM}」をクリック`);
  confirmBtn.click();

  // 「出品する」は確認画面に切り替わってから現れる（モーダルではなくURLも変わらない）。
  const submitBtn = await waitForButton(LABEL.PUBLISH, {
    timeoutMs: CONFIG.BUTTON_TIMEOUT_MS,
    preferSubmit: true,
  });
  await delay(CONFIG.CLICK_DELAY_MS);

  // 「これから出品する」ことを先にBackgroundへ伝え、送れた場合だけクリックする
  await sendSubmittedBeforeClick(LABEL.PUBLISH);

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
      // 画像がズレている場合は、数え方が実際と合っていない可能性もあるため
      // URLの形まで添える
      const images = differences.some((d) => d.field === '画像枚数')
        ? ` / フォームの画像: ${describeFormImages()}`
        : '';
      return `再出品元と内容が一致しません（${formatDifferences(differences)}）${images}`;
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
      stableMs: CONFIG.FORM_STABLE_MS,
      timeoutMs: CONFIG.FORM_SETTLE_TIMEOUT_MS,
      requireImages: mode === 'relist',
      // 元の内容が分かっているなら、変化が止まるのを待つのではなく
      // 元と一致するまで待つ（画像のアップロードの合間で打ち切らないため）
      matchesSource: expected
        ? (form: FormSnapshot): boolean => diffAgainstSource(form, expected).length === 0
        : null,
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

    await delay(CONFIG.CLICK_DELAY_MS);

    if (mode === 'relist') {
      await saveAsDraft();
    } else {
      await publish();
    }
  } catch (e) {
    await sendFailed(describeFailure(errorMessage(e)));
  }
}
