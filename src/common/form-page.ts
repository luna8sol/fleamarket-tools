/**
 * 出品フォームページのURL判定。
 * Background と Content Script の双方から参照する。
 *
 * 出品フォームは2種類あり、キューのモードと1対1で対応する:
 * - publish: 下書き編集ページ https://fril.jp/drafts/{hash}/edit
 * - relist:  新規出品ページ   https://fril.jp/item/new
 *   （フリマアシストの再出品ボタンは商品ページを経由してここへ遷移する）
 */

import { FormMode, QueueMode } from './messages';

/** ラクマ本体のオリジン。商品ページの item.fril.jp とは別ホストである点に注意 */
const FRIL_ORIGIN = 'https://fril.jp';

/** 下書き編集ページのパス */
const DRAFT_EDIT_PATH = /^\/drafts\/[^/]+\/edit(?:\/|$)/;
/** 新規出品ページのパス */
const ITEM_NEW_PATH = /^\/item\/new(?:\/|$)/;

/**
 * URLがどちらの出品フォームページかを判定する。
 * 出品フォームでなければ null を返す。
 */
export function detectFormPageMode(url: string): FormMode | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.origin !== FRIL_ORIGIN) return null;

  if (DRAFT_EDIT_PATH.test(parsed.pathname)) return 'publish';
  if (ITEM_NEW_PATH.test(parsed.pathname)) return 'relist';
  return null;
}

/**
 * URLが指定モードの出品フォームページかどうか
 */
export function isFormPageUrl(mode: QueueMode, url: string): boolean {
  // deleteモードは出品フォームを使わない
  if (mode === 'delete') return false;
  return detectFormPageMode(url) === mode;
}
