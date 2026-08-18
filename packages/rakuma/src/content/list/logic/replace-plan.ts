import { QueueItem, ReplaceRecord } from '../../../common/messages';
import { isReplaceDone, loadReplaceRecords } from '../../../common/replace-store';
import { fnv1a32 } from '../../../common/text-fingerprint';
import { CONFIG } from '../infra/constants';
import {
  createReplacePlanner,
  DescriptionEntry,
  ReplacePlan as CoreReplacePlan,
} from '@fleamarket/core/replace-plan';

/**
 * 説明文の一括置換の入力データの読み込みと、実行計画の組み立て。
 *
 * 確定版（置き換え後）と原本（取得時点）の 2 ファイルを `[{ id, name, desc }]` の形で受け取り、
 * **どの商品を処理し、どの商品を処理しないか**をここで決める。
 * 計画に載らなかった商品は 1 件も開かない。
 *
 * 読み込み・検証・振り分けの骨格は共有部品 `@fleamarket/core/replace-plan` にある。
 * ここでは、この拡張の商品ID（32 桁の 16 進に小文字化）とその文言、本文の同一判定に使う
 * 8 桁 16 進表記の FNV-1a、上限文字数、処理記録、CR を含む確定版の除外、
 * 対象の形（`QueueItem`）を注入する。
 */

/** 入力ファイルの 1 件（`id` はラクマの商品ID。32 桁の 16 進） */
export type { DescriptionEntry, ReplaceExclusion } from '@fleamarket/core/replace-plan';

/** 実行計画（処理対象はキューに積む形） */
export type ReplacePlan = CoreReplacePlan<QueueItem, ReplaceRecord>;

/** ラクマの商品ID（/sell のリンク item.fril.jp/{hash} の hash 部分） */
const ITEM_ID_RE = /^[0-9a-f]{32}$/;

const planner = createReplacePlanner<QueueItem, ReplaceRecord>({
  normalizeId: (raw) => {
    const id = raw.trim().toLowerCase();
    return ITEM_ID_RE.test(id) ? id : null;
  },
  invalidIdMessage: (label, position, raw) =>
    `${label}: ${position} 件目の商品ID "${raw}" がラクマの商品ID（32桁の16進）ではありません`,
  maxLength: CONFIG.REPLACE_MAX_DESCRIPTION_LENGTH,
  hash: fnv1a32,
  loadRecords: loadReplaceRecords,
  isDone: isReplaceDone,
  // 確定版が CR を含むと照合が永久に通らないので、開く前に外す
  excludeReason: (entry) =>
    entry.desc.includes('\r') ? '確定版の改行が LF ではありません（CR を含む）' : null,
  toTarget: (entry, original) => ({
    id: entry.id,
    title: entry.name,
    replace: { original: original.desc, final: entry.desc },
  }),
});

/**
 * JSON テキストを説明文の一覧として読み込む。
 *
 * 形が合わない・商品IDが不正・商品IDが重複している場合は例外を投げる。
 * 一部だけ読めた状態で先へ進めない（件数がずれたまま実行すると、
 * 確認ダイアログの件数と実際の対象が食い違う）。
 */
export function parseDescriptionEntries(text: string, label: string): DescriptionEntry[] {
  return planner.parseDescriptionEntries(text, label);
}

/**
 * 実行計画を組み立てる。確定版の各商品について次の順で振り分ける。
 *
 * 1. 原本に同じ商品IDが無い → 対象外（照合の基準が無いので開かない）
 * 2. 確定版が上限文字数を超える → 対象外（説明欄に maxLength が無く、切れたまま保存されうる）
 * 3. 確定版が CR を含む → 対象外（照合が永久に通らない）
 * 4. 記録上すでに適用済みで、かつ記録の確定版が**今回の確定版と同じ本文** → 今回は処理しない
 * 5. それ以外 → 処理対象
 *
 * 4 で本文の一致まで見るのは、確定版を改訂して 2 回目以降を流すため。
 * 商品IDだけで除外すると、改訂した本文が 1 件も適用されない。
 */
export function buildReplacePlan(
  finals: DescriptionEntry[],
  originals: DescriptionEntry[]
): Promise<ReplacePlan> {
  return planner.buildReplacePlan(finals, originals);
}
