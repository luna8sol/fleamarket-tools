import { safeQueryAll, safeQueryFirst } from '../../common/dom';
import { waitFor } from '../../common/utils';
import { CONFIG, SELL_FORM_SELECTOR } from '../infra/constants';
import { debug, debugMethodEnd, debugMethodStart, log, warn } from '../infra/logger';
import { toItemId } from './dom-utils';
import { openHiddenFrame, readableDocument, waitForFrameDocument } from './hidden-frame';
import { readSellFormField } from './sell-form';
import { normalizeFieldValue } from './value-normalizer';

/**
 * 出品中商品の削除。
 *
 * 一覧ページから離れずに、商品の編集ページ（`/sell/edit/{itemId}`）を
 * 同一オリジンの隠しiframeで開いて削除します。
 *
 * **フリマアシストの削除ボタンは使いません。** あちらの確認はブラウザ標準の
 * `confirm()` で、別の実行ワールドから呼ばれるためこちらからは応答できません
 * （2026-09-21 実地確認）。メルカリ自身の削除は React のモーダルなので操作できます。
 *
 * **削除は取り消せません。** 開いたページの商品名が一覧で選んだ商品と
 * 一致しない場合は、削除せずに失敗として返します。
 */

/** 削除の結果 */
export interface DeleteResult {
  /** 削除できたか */
  deleted: boolean;
  /** 失敗した理由（成功時は undefined） */
  reason?: string;
}

/**
 * 失敗を記録して返す
 *
 * @param itemId 対象の商品ID
 * @param reason 失敗理由
 * @returns 失敗を表す結果
 */
function failed(itemId: string, reason: string): DeleteResult {
  warn(`削除できませんでした: ${itemId} - ${reason}`);
  return { deleted: false, reason };
}

/**
 * 編集ページが開いて削除ボタンが現れたかを判定
 *
 * @param doc 対象の Document
 * @returns 削除ボタンがあれば true
 */
function isEditPageReady(doc: Document): boolean {
  return safeQueryFirst(SELL_FORM_SELECTOR.DELETE_BUTTON, doc) !== null;
}

/**
 * 削除確認ダイアログの確定ボタンを探す
 *
 * **data-testid だけで決め打ちしません。** 表示テキストが「削除する」であることも
 * 確認します。別の用途のダイアログが同じ data-testid を使っていた場合に、
 * 意図しないボタンを押さないためです。
 *
 * @param doc 対象の Document
 * @returns 見つかった確定ボタン。無ければ null
 */
function findDeleteConfirmButton(doc: Document): HTMLElement | null {
  for (const selector of SELL_FORM_SELECTOR.DELETE_CONFIRM_BUTTON) {
    const found = safeQueryAll<HTMLElement>(selector, doc).find(
      (element) => element.innerText.replace(/\s+/g, '') === SELL_FORM_SELECTOR.DELETE_CONFIRM_TEXT
    );
    if (found) return found;
  }

  return null;
}

/**
 * 出品中商品を1件削除する
 *
 * @param rawItemId 一覧ページが持つ商品ID（`/item/m123...` 形式でも可）
 * @param expectedName 一覧ページで選んだ商品の商品名（照合用）
 * @returns 削除の結果
 */
export async function deleteItem(rawItemId: string, expectedName: string): Promise<DeleteResult> {
  const startTime = performance.now();
  debugMethodStart('deleteItem', { rawItemId, expectedName });

  const itemId = toItemId(rawItemId);
  if (!itemId) {
    return failed(rawItemId, `商品IDを解釈できません: "${rawItemId}"`);
  }

  if (expectedName.trim() === '') {
    // 照合できない以上、消してよい相手かを確認できない
    return failed(itemId, '一覧から商品名を読み取れないため、照合できません');
  }

  const editUrl = `${window.location.origin}/sell/edit/${encodeURIComponent(itemId)}`;
  const frame = openHiddenFrame(editUrl);

  try {
    const doc = await waitForFrameDocument(frame, isEditPageReady, CONFIG.DELETE_PAGE_TIMEOUT_MS);
    if (!doc) {
      return failed(itemId, `編集ページを開けませんでした: ${editUrl}`);
    }

    // 取り違え防止。開いたページが本当に消す相手かを確認する
    const actualName = readSellFormField('name', doc);
    const expected = normalizeFieldValue('name', expectedName);
    if (actualName === null) {
      return failed(itemId, '編集ページの商品名を読み取れませんでした');
    }
    if (actualName !== expected) {
      return failed(
        itemId,
        `別商品の可能性があります（編集ページ: "${actualName}" / 一覧: "${expected}"）`
      );
    }

    const deleteButton = safeQueryFirst<HTMLElement>(SELL_FORM_SELECTOR.DELETE_BUTTON, doc);
    if (!deleteButton) {
      return failed(itemId, '削除ボタンが見つかりませんでした');
    }

    deleteButton.click();

    const confirmButton = await waitFor(
      () => findDeleteConfirmButton(doc),
      CONFIG.DELETE_DIALOG_TIMEOUT_MS,
      CONFIG.SELL_FORM_POLL_INTERVAL_MS
    );

    if (!confirmButton) {
      return failed(
        itemId,
        `削除確認ダイアログの「${SELL_FORM_SELECTOR.DELETE_CONFIRM_TEXT}」が見つかりませんでした`
      );
    }

    debug('削除を確定します', { itemId, expected });
    confirmButton.click();

    // 削除されると編集ページから離れる。離れたことをもって成功とみなす
    const left = await waitFor(
      () => {
        const current = readableDocument(frame);
        return current !== null && !current.location.pathname.includes(`/sell/edit/${itemId}`);
      },
      CONFIG.DELETE_RESULT_TIMEOUT_MS,
      CONFIG.SELL_FORM_POLL_INTERVAL_MS
    );

    if (!left) {
      return failed(itemId, '削除後のページ遷移を確認できませんでした');
    }

    const duration = Math.round(performance.now() - startTime);
    log(`削除しました: ${itemId} - ${expectedName}`);
    debugMethodEnd('deleteItem', { itemId, deleted: true }, duration);
    return { deleted: true };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    debugMethodEnd('deleteItem', { itemId, deleted: false, error: reason });
    return failed(itemId, reason);
  } finally {
    // 成功しても失敗しても iframe は必ず片付ける
    frame.remove();
  }
}
