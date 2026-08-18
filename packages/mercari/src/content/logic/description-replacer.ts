import { safeQueryAll, safeQueryFirst, setReactInputValue } from '../../common/dom';
import { fnv1a32, sleep } from '../../common/utils';
import { CONFIG, EDIT_SELECTOR, ITEM_PAGE_SELECTOR, SELL_FORM_SELECTOR } from '../infra/constants';
import { debug, debugMethodEnd, debugMethodStart, log, warn } from '../infra/logger';
import {
  DescriptionReplaceOutcome,
  DescriptionReplaceRecord,
  DescriptionReplaceTarget,
} from '../infra/types';
import { toItemId } from './dom-utils';
import { openHiddenFrame, readableDocument, waitForFrameDocument } from './hidden-frame';
import { isSellFormReady, readSellFormField } from './sell-form';
import { normalizeFieldValue } from './value-normalizer';
import {
  createFingerprint,
  sameFingerprint,
  TextFingerprint,
} from '@fleamarket/core/text-fingerprint';
import { normalizeLineBreaks } from '@fleamarket/core/text-hash';

/**
 * 出品中商品の説明文を 1 件、確定版へ置き換えて保存する。
 *
 * 一覧ページから離れずに、商品の編集ページ（`/sell/edit/{itemId}`）を同一オリジンの
 * 隠し iframe で開き、説明欄だけを書き換えて「変更する」を押します。
 *
 * **保存に至るまでに 4 段の照合を通します。** どれか 1 つでも通らなければ保存しません。
 *
 * 1. 編集ページの商品名がデータの商品名と一致する（取り違え防止）
 * 2. 開いた時点の説明欄が**原本**と一致する（取得後に変わっていない）
 * 3. 書き込んだあとの説明欄が**確定版**と一致する（React の状態に反映された）
 * 4. 書き込んだあとも商品名が変わっていない（説明欄以外に触っていない）
 *
 * 保存後は商品ページ（`/item/{itemId}`）へ遷移するので、そこに表示された本文も
 * 確定版と照合し、一致して初めて `applied` とします。
 *
 * **`[data-testid="delete-button"]`（この商品を削除する）には一切触れません。**
 * 確定ボタンも data-testid だけで決めず、文言が「変更する」であることを確認して押します。
 */

/**
 * 1 件の処理結果
 *
 * `record` が null で `halt` も無いときは、利用者の中断要求で保存前に打ち切ったことを表します。
 */
export interface ReplaceStepResult {
  /** 記録する結果。保存前に中断したときは null */
  record: DescriptionReplaceRecord | null;
  /**
   * 全体を止めるべき理由（ページ構造が想定と違うなど）
   *
   * 説明欄や確定ボタンが見つからないのは、この商品固有の事情ではなく
   * メルカリ側の変更を疑うべき状況なので、残りの商品を開かずに止めます。
   */
  halt?: string;
}

/**
 * 文字列の文字数と FNV-1a ハッシュの組を取る。照合はこの両方で行う
 *
 * 組と比較は共有部品 `@fleamarket/core/text-fingerprint`。ハッシュは保存済みの記録と
 * 照合する値なので、この拡張の 10 進表記（`fnv1a32`）をそのまま注入する。
 */
const fingerprint = createFingerprint(fnv1a32);

/**
 * 編集ページの説明欄を探す
 *
 * iframe 内の要素は別レルムのため `instanceof HTMLTextAreaElement` では判定できず、
 * tagName で判定します。
 *
 * @param doc 対象の Document
 * @returns 説明欄。見つからなければ null
 */
function findDescriptionTextarea(doc: Document): HTMLTextAreaElement | null {
  const element = safeQueryFirst<HTMLTextAreaElement>(EDIT_SELECTOR.DESCRIPTION, doc);
  return element && element.tagName === 'TEXTAREA' ? element : null;
}

/**
 * 編集ページの確定ボタン「変更する」を探す
 *
 * **data-testid だけで決め打ちしません。** 表示テキストが「変更する」であることも
 * 確認します。同じページには削除ボタンや一時停止ボタンも並ぶため、取り違えると
 * 意図と違う操作になります。
 *
 * @param doc 対象の Document
 * @returns 確定ボタン。見つからなければ null
 */
function findEditSaveButton(doc: Document): HTMLButtonElement | null {
  for (const selector of SELL_FORM_SELECTOR.EDIT_SAVE_BUTTON) {
    const found = safeQueryAll<HTMLButtonElement>(selector, doc).find(
      (element) =>
        element.tagName === 'BUTTON' &&
        element.innerText.replace(/\s+/g, '') === SELL_FORM_SELECTOR.EDIT_SAVE_TEXT
    );
    if (found) return found;
  }
  return null;
}

/**
 * 商品ページの説明文の表示要素を探す
 * @param doc 対象の Document
 * @returns 説明文の要素。見つからなければ null
 */
function findItemDescription(doc: Document): HTMLElement | null {
  return safeQueryFirst<HTMLElement>(ITEM_PAGE_SELECTOR.DESCRIPTION, doc);
}

/**
 * 編集ページが読み書きできる状態かを判定する
 *
 * 商品名が入り、説明欄と確定ボタンが描画されていることを条件にします。
 * 原本が空でない商品なら、説明欄にも値が入るまで待ちます（商品名だけ先に入り、
 * 説明欄が空のまま読むと「原本と不一致」と誤判定するため）。
 *
 * @param doc 対象の Document
 * @param expectEmptyDescription 原本の説明が空文字か
 * @returns 準備完了なら true
 */
function isEditPageReady(doc: Document, expectEmptyDescription: boolean): boolean {
  if (!isSellFormReady(doc)) return false;

  const textarea = findDescriptionTextarea(doc);
  if (!textarea) return false;
  if (!expectEmptyDescription && textarea.value === '') return false;

  return findEditSaveButton(doc) !== null;
}

/**
 * 編集ページの準備完了を待てなかった原因を切り分ける
 *
 * 商品名は描画されているのに説明欄や確定ボタンが無いなら、この商品固有の事情ではなく
 * メルカリ側の構造変更を疑うべき状況なので、全体を止める理由を返します。
 * 商品名すら入っていないなら読み込みの遅れ・失敗（この商品だけの可能性がある）として
 * 止めずに次へ進ませます。
 *
 * @param frame 対象の iframe
 * @returns 全体を止めるべき理由。この商品だけの失敗として扱うなら undefined
 */
function diagnoseEditPageTimeout(frame: HTMLIFrameElement): string | undefined {
  const doc = readableDocument(frame);
  if (!doc || !isSellFormReady(doc)) return undefined;

  const missing: string[] = [];
  if (!findDescriptionTextarea(doc)) missing.push('説明欄');
  if (!findEditSaveButton(doc)) missing.push(`「${SELL_FORM_SELECTOR.EDIT_SAVE_TEXT}」ボタン`);

  // 両方あるのに準備完了にならないのは説明欄が空のままの場合。この商品固有として扱う
  if (missing.length === 0) return undefined;

  return `編集ページに${missing.join('と')}が見つかりません。メルカリ側の構造が変わった可能性があるため止めました`;
}

/**
 * 商品 1 件の説明文を確定版へ置き換える
 *
 * @param target 確定版と原本の組
 * @param shouldAbort 利用者が中断を求めているか。保存ボタンを押す前まで各段階で確認する
 * @returns 処理結果
 */
export async function replaceItemDescription(
  target: DescriptionReplaceTarget,
  shouldAbort: () => boolean
): Promise<ReplaceStepResult> {
  const startTime = performance.now();
  const { entry, original } = target;
  const expected = fingerprint(entry.desc);

  debugMethodStart('replaceItemDescription', { id: entry.id, name: entry.name });

  /** 結果の記録を組み立てる */
  const record = (
    outcome: DescriptionReplaceOutcome,
    saved: boolean,
    reason?: string,
    current: TextFingerprint | null = null,
    live?: TextFingerprint | null
  ): DescriptionReplaceRecord => ({
    id: entry.id,
    name: entry.name,
    outcome,
    reason,
    saved,
    currentLength: current?.length ?? null,
    currentHash: current?.hash ?? null,
    expectedLength: expected.length,
    expectedHash: expected.hash,
    liveLength: live === undefined ? undefined : (live?.length ?? null),
    liveHash: live === undefined ? undefined : (live?.hash ?? null),
    at: new Date().toISOString(),
  });

  /** 保存せずに終える（スキップ・失敗） */
  const notSaved = (
    outcome: 'skipped' | 'failed',
    reason: string,
    current: TextFingerprint | null = null,
    halt?: string
  ): ReplaceStepResult => {
    warn(`説明文を置き換えませんでした: ${entry.id} - ${reason}`);
    return { record: record(outcome, false, reason, current), halt };
  };

  /** 利用者の中断要求で保存前に打ち切る */
  const aborted = (): ReplaceStepResult => {
    log(`中断要求のため保存せずに打ち切りました: ${entry.id}`);
    return { record: null };
  };

  const itemId = toItemId(entry.id);
  if (!itemId) {
    return notSaved('failed', `商品IDを解釈できません: "${entry.id}"`);
  }

  // 計画の段階でも弾いているが、保存に向かう最後の砦としてここでも確認する
  if (entry.desc.length > CONFIG.DESCRIPTION_REPLACE_MAX_LENGTH) {
    return notSaved(
      'failed',
      `確定版が ${entry.desc.length} 字で上限 ${CONFIG.DESCRIPTION_REPLACE_MAX_LENGTH} 字を超えています`
    );
  }

  if (shouldAbort()) return aborted();

  const editUrl = `${window.location.origin}/sell/edit/${encodeURIComponent(itemId)}`;
  const frame = openHiddenFrame(editUrl);

  try {
    // 親タブが裏に回っていてもデータ取得が保留されないよう、表示状態を固定しながら待つ
    const doc = await waitForFrameDocument(
      frame,
      (candidate) => isEditPageReady(candidate, original.desc === ''),
      CONFIG.DESCRIPTION_REPLACE_PAGE_TIMEOUT_MS,
      { forceVisible: true }
    );
    if (!doc) {
      const halt = diagnoseEditPageTimeout(frame);
      return notSaved(
        'failed',
        halt ?? `編集ページの読み込みがタイムアウトしました: ${editUrl}`,
        null,
        halt
      );
    }

    // 1. 取り違え防止。開いたページが本当に書き換える相手かを商品名で確認する
    const expectedName = normalizeFieldValue('name', entry.name);
    const actualName = readSellFormField('name', doc);
    if (actualName === null) {
      return notSaved('failed', '編集ページの商品名を読み取れませんでした');
    }
    if (actualName !== expectedName) {
      return notSaved(
        'skipped',
        `別商品の可能性があります（編集ページ: "${actualName}" / データ: "${expectedName}"）`
      );
    }

    const textarea = findDescriptionTextarea(doc);
    if (!textarea) {
      // 準備完了の判定を通っているので通常は来ない。来たらメルカリ側の変更を疑う
      const reason = '説明欄が見つかりませんでした';
      return notSaved('failed', reason, null, reason);
    }

    // 2. 開いた時点の本文を確認する
    const currentText = textarea.value;
    const current = fingerprint(currentText);

    if (sameFingerprint(current, expected)) {
      log(`すでに確定版です: ${itemId} - ${entry.name}`);
      return { record: record('already', false, undefined, current) };
    }

    const originalFingerprint = fingerprint(original.desc);
    if (!sameFingerprint(current, originalFingerprint)) {
      return notSaved(
        'skipped',
        `取得時点の原本と一致しません（現在 ${current.length}字 / 原本 ${originalFingerprint.length}字）。取得後に変更された可能性があります`,
        current
      );
    }

    if (shouldAbort()) return aborted();

    // 3. 確定版を書き込み、React の状態に反映されたことを読み直して確かめる
    if (!setReactInputValue(textarea, entry.desc)) {
      return notSaved('failed', '説明欄への書き込みに失敗しました', current);
    }
    await sleep(CONFIG.DESCRIPTION_REPLACE_INPUT_SETTLE_MS / 1000);

    const applied = fingerprint(textarea.value);
    if (!sameFingerprint(applied, expected)) {
      // 保存しないので、iframe を破棄すれば書き込みは残らない
      return notSaved(
        'failed',
        `書き込み後の値が確定版と一致しません（${applied.length}字 / 期待 ${expected.length}字）。保存していません`,
        current
      );
    }

    // 4. 説明欄以外に影響していないことを、商品名を読み直して確かめる
    if (readSellFormField('name', doc) !== expectedName) {
      return notSaved('failed', '書き込み後に商品名が変わっていたため保存していません', current);
    }

    // 書き込みでフォームが再描画されている可能性があるため、直前に取り直す
    const saveButton = findEditSaveButton(doc);
    if (!saveButton) {
      const reason = `「${SELL_FORM_SELECTOR.EDIT_SAVE_TEXT}」ボタンが見つからないため保存していません`;
      return notSaved('failed', reason, current, reason);
    }
    if (saveButton.disabled) {
      return notSaved('failed', '確定ボタンが無効状態のため保存していません', current);
    }

    // ここが保存前の最後の止め時。押したあとは中断しない（途中の状態で放置しないため）
    if (shouldAbort()) return aborted();

    log(`説明文を保存します: ${itemId} - ${entry.name}`, {
      before: current.length,
      after: expected.length,
    });
    saveButton.click();

    // 保存に成功すると商品ページへ遷移する。そこに出た本文で最終照合する
    const itemPath = `/item/${itemId}`;
    const itemDoc = await waitForFrameDocument(
      frame,
      (candidate) =>
        candidate.location.pathname === itemPath &&
        (findItemDescription(candidate)?.innerText ?? '') !== '',
      CONFIG.DESCRIPTION_REPLACE_SAVE_TIMEOUT_MS,
      { forceVisible: true }
    );

    if (!itemDoc) {
      const reason = '保存後の商品ページを確認できませんでした（保存されたかどうか不明）';
      warn(`${reason}: ${itemId}`);
      return { record: record('unverified', true, reason, current, null) };
    }

    // メルカリはブラウザから保存した本文の改行を CRLF で持つ（2026-09-22 実地確認。手作業で
    // 保存した商品も同じ）。textarea.value は LF に正規化されるが商品ページの innerText は
    // そのまま \r\n を返すので、改行コードだけ揃えてから照合する。文字自体は一切変えない
    const liveElement = findItemDescription(itemDoc);
    const live = fingerprint(normalizeLineBreaks(liveElement?.innerText ?? ''));
    if (!sameFingerprint(live, expected)) {
      const reason = `商品ページの説明文が確定版と一致しません（${live.length}字 / 期待 ${expected.length}字）`;
      warn(`${reason}: ${itemId}`);
      return { record: record('unverified', true, reason, current, live) };
    }

    const duration = Math.round(performance.now() - startTime);
    log(`説明文を置き換えました: ${itemId} - ${entry.name}`);
    debugMethodEnd('replaceItemDescription', { itemId, outcome: 'applied' }, duration);
    return { record: record('applied', true, undefined, current, live) };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    debugMethodEnd('replaceItemDescription', { itemId, outcome: 'failed', error: reason });
    // 確定ボタンを押したあとの例外は「保存されたか不明」になるが、ここへ来る経路は
    // 押す前の処理が大半。押したあとは waitForFrameDocument が例外を投げない
    return notSaved('failed', reason);
  } finally {
    // 成功しても失敗しても iframe は必ず片付ける
    frame.remove();
    debug('隠しiframeを閉じました', { itemId });
  }
}
