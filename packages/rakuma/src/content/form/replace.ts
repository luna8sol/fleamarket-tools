import { MessageType, QueueItem } from '../../common/messages';
import { sendToRuntime } from '../../common/send-message';
import { log, warn } from '../../common/logger';
import { fingerprint, sameFingerprint, TextFingerprint } from '../../common/text-fingerprint';
import { CONFIG, FIELD, LABEL } from './constants';
import { findButtonByText, listRenderedButtonLabels, waitForButton } from './button-finder';
import { collectValidationErrors } from './form-state';
import { waitFor } from './wait';
import { delay } from '../wait';

/**
 * replace: 出品中商品の編集ページ (/item/{hash}/edit) の説明欄だけを確定版へ置き換えて保存する。
 *
 * **保存に至るまでに 4 段の照合を通す。** どれか 1 つでも通らなければ保存しない。
 *
 * 1. 編集ページの商品名がデータの商品名と一致する（取り違え防止）
 * 2. 開いた時点の説明欄が**原本**と一致する（取得後に変わっていない）
 *    - 確定版と一致していれば「適用済み」として保存せずに終える
 * 3. 書き込んだあとの説明欄が**確定版**と一致する（React の状態に反映された）
 * 4. 書き込んだあとも商品名が変わっていない（説明欄以外に触っていない）
 *
 * 押すのは「確認する」→「更新する」だけ。同じページにある「下書きに保存する」には触れない
 * （出品中の商品が下書きへ落ちる可能性がある）。「出品する」「削除」も押さない。
 * 保存後の本文の照合は Background が商品ページ (item.fril.jp) で行う。
 *
 * 説明欄や確定ボタンが見つからないのは商品固有の事情ではなくラクマ側の変更を
 * 疑うべき状況なので、fatal を付けて Background に残りを止めさせる。
 */

/** 保存せずに終える理由の種別 */
interface NotSaved {
  outcome: 'skipped' | 'failed';
  reason: string;
  fatal?: boolean;
}

function findDescription(): HTMLTextAreaElement | null {
  return document.querySelector<HTMLTextAreaElement>(FIELD.DESCRIPTION);
}

function findItemName(): HTMLInputElement | null {
  return document.querySelector<HTMLInputElement>(FIELD.ITEM_NAME);
}

/** 商品名の照合は空白のゆらぎだけ吸収する */
function normalizeName(name: string): string {
  return name.replace(/[\s　]+/g, '');
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * 編集ページが読み書きできる状態か。
 * 値は SSR の HTML には無く、クライアント側で流し込まれるため、
 * 商品名と説明欄に値が入り、「確認する」が描画されるまで待つ。
 */
function isPageReady(expectEmptyDescription: boolean): boolean {
  const name = findItemName();
  if (!name || name.value.trim() === '') return false;
  const textarea = findDescription();
  if (!textarea) return false;
  if (!expectEmptyDescription && textarea.value === '') return false;
  return findButtonByText(LABEL.CONFIRM) !== null;
}

/**
 * 準備完了を待てなかった原因を切り分ける。
 * 商品名は入っているのに説明欄や「確認する」が無いなら構造変更を疑う（fatal）。
 */
function diagnoseNotReady(): NotSaved {
  const name = findItemName();
  if (!name || name.value.trim() === '') {
    return {
      outcome: 'failed',
      reason: `編集ページに商品名が入りませんでした（表示中のボタン: ${listRenderedButtonLabels().join(', ')}）`,
    };
  }
  const missing: string[] = [];
  if (!findDescription()) missing.push('説明欄');
  if (!findButtonByText(LABEL.CONFIRM)) missing.push(`「${LABEL.CONFIRM}」ボタン`);
  if (missing.length === 0) {
    return { outcome: 'failed', reason: '編集ページの説明欄に値が入りませんでした' };
  }
  return {
    outcome: 'failed',
    reason: `編集ページに${missing.join('と')}が見つかりません。ラクマ側の構造が変わった可能性があるため止めました`,
    fatal: true,
  };
}

/**
 * React 管理の入力欄に値を設定する。
 * `el.value` への直接代入では React の状態に反映されないため、
 * プロトタイプの value setter を呼んでから input / change イベントを発火させる
 * （2026-09-28 に実機で反映を確認）。
 */
function setReactValue(el: HTMLTextAreaElement, value: string): boolean {
  try {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (setter) {
      setter.call(el, value);
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  } catch (e) {
    warn('説明欄への書き込みに失敗しました', e);
    return false;
  }
}

/**
 * このタブがまだ自動処理対象かを Background に確かめる。
 * ユーザーが「停止」を押していたら、保存ボタンを押す前に打ち切るため。
 */
async function isStillAutoTab(): Promise<boolean> {
  try {
    const response = await sendToRuntime({ type: MessageType.CHECK_AUTO_TAB });
    return response?.isAutoTab === true;
  } catch {
    return false;
  }
}

/**
 * 保存しなかったことを Background へ伝える。
 * ここでの送信失敗はもう伝える先が無いため warn に落として握る。
 */
async function sendNotSaved(notSaved: NotSaved, current: TextFingerprint | null): Promise<void> {
  warn(`説明文を置き換えませんでした（${notSaved.outcome}）: ${notSaved.reason}`);
  await sendToRuntime({
    type: MessageType.FORM_FAILED,
    reason: notSaved.reason,
    outcome: notSaved.outcome,
    fatal: notSaved.fatal ?? false,
    currentLength: current?.length,
    currentHash: current?.hash,
  }).catch((e) => warn('失敗の通知をBackgroundへ送れませんでした', e));
}

/**
 * 保存に向かう前の処理。保存しない理由があればそれを返し、保存してよければ null を返す。
 * 「更新する」のクリックまで含む（クリック直後にページ遷移して Content Script が
 * 破棄されうるため、FORM_SUBMITTED を先に送り、送れた場合だけクリックする）。
 */
async function replaceAndSave(
  item: QueueItem,
  setCurrent: (value: TextFingerprint) => void
): Promise<NotSaved | null> {
  const { original, final } = item.replace ?? { original: '', final: '' };
  const expected = fingerprint(final);

  // 計画の段階でも弾いているが、保存に向かう最後の砦としてここでも確認する
  if (final.length > CONFIG.REPLACE_MAX_DESCRIPTION_LENGTH) {
    return {
      outcome: 'failed',
      reason: `確定版が ${final.length} 字で上限 ${CONFIG.REPLACE_MAX_DESCRIPTION_LENGTH} 字を超えています`,
    };
  }

  try {
    await waitFor(() => (isPageReady(original === '') ? true : null), {
      timeoutMs: CONFIG.REPLACE_PAGE_READY_TIMEOUT_MS,
      label: '編集ページの読み込み',
    });
  } catch {
    return diagnoseNotReady();
  }

  const nameInput = findItemName();
  const textarea = findDescription();
  if (!nameInput || !textarea) {
    return {
      outcome: 'failed',
      reason: '編集ページの商品名または説明欄が見つかりません',
      fatal: true,
    };
  }

  // 1. 取り違え防止。開いたページが本当に書き換える相手かを商品名で確認する
  const expectedName = normalizeName(item.title);
  const actualName = normalizeName(nameInput.value);
  if (actualName !== expectedName) {
    return {
      outcome: 'skipped',
      reason: `別商品の可能性があります（編集ページ: "${nameInput.value.trim()}" / データ: "${item.title}"）`,
    };
  }

  // 2. 開いた時点の本文を確認する
  const current = fingerprint(textarea.value);
  setCurrent(current);

  if (sameFingerprint(current, expected)) {
    log(`すでに確定版です: ${item.title}`);
    await sendToRuntime({
      type: MessageType.FORM_ALREADY_APPLIED,
      currentLength: current.length,
      currentHash: current.hash,
    });
    return null;
  }

  const originalFingerprint = fingerprint(original);
  if (!sameFingerprint(current, originalFingerprint)) {
    return {
      outcome: 'skipped',
      reason:
        `取得時点の原本と一致しません（現在 ${current.length}字 / 原本 ${originalFingerprint.length}字）。` +
        '取得後に変更された可能性があります',
    };
  }

  // 3. 確定版を書き込み、React の状態に反映されたことを読み直して確かめる
  if (!setReactValue(textarea, final)) {
    return { outcome: 'failed', reason: '説明欄への書き込みに失敗しました' };
  }
  await delay(CONFIG.REPLACE_INPUT_SETTLE_MS);

  const applied = fingerprint(findDescription()?.value ?? '');
  if (!sameFingerprint(applied, expected)) {
    return {
      outcome: 'failed',
      reason: `書き込み後の値が確定版と一致しません（${applied.length}字 / 期待 ${expected.length}字）。保存していません`,
    };
  }

  // 4. 説明欄以外に影響していないことを、商品名を読み直して確かめる
  if (normalizeName(findItemName()?.value ?? '') !== expectedName) {
    return { outcome: 'failed', reason: '書き込み後に商品名が変わっていたため保存していません' };
  }

  // 停止されていたら保存に向かわない
  if (!(await isStillAutoTab())) {
    return { outcome: 'failed', reason: '停止されたため保存していません' };
  }

  // 「確認する」→ 確認画面に切り替わる（URL は変わらない）。この時点ではまだ保存されない
  const confirmBtn = findButtonByText(LABEL.CONFIRM);
  if (!confirmBtn) {
    return {
      outcome: 'failed',
      reason: `「${LABEL.CONFIRM}」ボタンが見つからないため保存していません`,
      fatal: true,
    };
  }
  await delay(CONFIG.CLICK_DELAY_MS);
  log(`「${LABEL.CONFIRM}」をクリック`);
  confirmBtn.click();

  let updateBtn: HTMLButtonElement;
  try {
    updateBtn = await waitForButton(LABEL.UPDATE, {
      timeoutMs: CONFIG.BUTTON_TIMEOUT_MS,
      preferSubmit: true,
    });
  } catch {
    const errors = collectValidationErrors();
    if (errors.length > 0) {
      return {
        outcome: 'failed',
        reason: `確認画面へ進めませんでした / 入力エラー: ${errors.join(' ')}`,
      };
    }
    return {
      outcome: 'failed',
      reason:
        `「${LABEL.UPDATE}」ボタンが見つからないため保存していません` +
        `（表示中のボタン: ${listRenderedButtonLabels().join(', ')}）`,
      fatal: true,
    };
  }
  if (updateBtn.disabled) {
    return { outcome: 'failed', reason: `「${LABEL.UPDATE}」が無効状態のため保存していません` };
  }

  // ここが保存前の最後の止め時。押したあとは中断しない（途中の状態で放置しないため）
  await delay(CONFIG.CLICK_DELAY_MS);
  if (!(await isStillAutoTab())) {
    return { outcome: 'failed', reason: '停止されたため保存していません' };
  }

  // クリック直後にページが遷移して Content Script が破棄されうるため、先に伝える。
  // 送れたことを確認できなければ押さない（Background が知らないまま押すと、
  // 完了も失敗も観測されずウォッチドッグの時間切れを待つことになる）
  try {
    await sendToRuntime({
      type: MessageType.FORM_SUBMITTED,
      currentLength: current.length,
      currentHash: current.hash,
    });
  } catch (e) {
    return {
      outcome: 'failed',
      reason: `Backgroundへ通知できなかったため「${LABEL.UPDATE}」を押しませんでした（通信失敗: ${errorMessage(e)}）`,
    };
  }
  log(`「${LABEL.UPDATE}」をクリック: ${item.title}（${current.length} → ${expected.length} 字）`);
  updateBtn.click();
  return null;
}

/**
 * 説明文の置き換えを実行する。失敗時はタブを開いたまま残す。
 */
export async function runReplace(item: QueueItem): Promise<void> {
  let current: TextFingerprint | null = null;
  try {
    const notSaved = await replaceAndSave(item, (value) => {
      current = value;
    });
    if (notSaved) {
      await sendNotSaved(notSaved, current);
    }
  } catch (e) {
    await sendNotSaved({ outcome: 'failed', reason: errorMessage(e) }, current);
  }
}
