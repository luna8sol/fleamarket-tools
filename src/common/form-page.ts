/**
 * 出品フォームページのURL判定。
 * Background と Content Script の双方から参照する。
 *
 * 出品フォームは3種類あり、キューのモードと1対1で対応する:
 * - publish: 下書き編集ページ     https://fril.jp/drafts/{hash}/edit
 * - relist:  新規出品ページ       https://fril.jp/item/new
 *   （フリマアシストの再出品ボタンは商品ページを経由してここへ遷移する）
 * - replace: 出品中商品の編集ページ https://fril.jp/item/{hash}/edit
 *
 * 3 つとも同じフォーム部品で「下書きに保存する」「確認する」を持つため、
 * ページの中身ではなく URL（＝モード）で押すボタンを決める。
 */

import { FormMode, QueueMode } from './messages';
import { QUEUE_MODE_TRAITS } from './queue-mode-traits';

/** ラクマ本体のオリジン。商品ページの item.fril.jp とは別ホストである点に注意 */
const FRIL_ORIGIN = 'https://fril.jp';

/**
 * 下書き編集ページのパス。
 *
 * /drafts 配下のページ種別判定は src/content/list/infra/page-detector.ts の
 * detectCurrentPage も参照すること。あちらは /drafts 配下を一律 UNKNOWN に落とし、
 * 一覧側のContent Scriptの担当から外している。
 */
const DRAFT_EDIT_PATH = /^\/drafts\/[^/]+\/edit(?:\/|$)/;
/** 新規出品ページのパス */
const ITEM_NEW_PATH = /^\/item\/new(?:\/|$)/;
/** 出品中商品の編集ページのパス（商品IDは16進のhash） */
const ITEM_EDIT_PATH = /^\/item\/[0-9a-f]+\/edit(?:\/|$)/;

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
  if (ITEM_EDIT_PATH.test(parsed.pathname)) return 'replace';
  return null;
}

/** 出品中商品の編集ページの URL */
export function itemEditUrl(itemId: string): string {
  return `${FRIL_ORIGIN}/item/${itemId}/edit`;
}

/**
 * URLが指定モードの出品フォームページかどうか
 */
export function isFormPageUrl(mode: QueueMode, url: string): boolean {
  // 出品フォームを持たないモード（delete）には一致しようがない
  if (!QUEUE_MODE_TRAITS[mode].usesFormPage) return false;
  return detectFormPageMode(url) === mode;
}
