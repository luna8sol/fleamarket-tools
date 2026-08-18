import { fnv1a32 } from '../../common/utils';
import { CONFIG } from '../infra/constants';
import { isReplaceDone, loadReplaceRecords } from '../infra/description-replace-store';
import { debug } from '../infra/logger';
import {
  DescriptionEntry,
  DescriptionReplacePlan,
  DescriptionReplaceRecord,
  DescriptionReplaceTarget,
} from '../infra/types';
import { toItemId } from './dom-utils';
import { createReplacePlanner } from '@fleamarket/core/replace-plan';

/**
 * 説明文の一括置換の入力データの読み込みと、実行計画の組み立て。
 *
 * 確定版（置き換え後）と原本（取得時点）の 2 ファイルを `[{ id, name, desc }]` の形で受け取り、
 * **どの商品を処理し、どの商品を処理しないか**をここで決めます。
 * 計画に載らなかった商品は 1 件も開きません。
 *
 * 読み込み・検証・振り分けの骨格は共有部品 `@fleamarket/core/replace-plan` にあります。
 * ここでは、この拡張の商品ID（`m` + 数字。`toItemId`）とその文言、本文の同一判定に使う
 * 10 進表記の FNV-1a、上限文字数、処理記録、対象の形（確定版と原本の組）、debug ログを注入します。
 */
const planner = createReplacePlanner<DescriptionReplaceTarget, DescriptionReplaceRecord>({
  normalizeId: toItemId,
  invalidIdMessage: (label, position, raw) =>
    `${label}: ${position} 件目の商品ID "${raw}" を解釈できません`,
  maxLength: CONFIG.DESCRIPTION_REPLACE_MAX_LENGTH,
  hash: fnv1a32,
  loadRecords: loadReplaceRecords,
  isDone: isReplaceDone,
  toTarget: (entry, original) => ({ entry, original }),
  onParsed: (label, count) => debug(`${label}を読み込みました`, { count }),
  onPlanned: (plan) =>
    debug('説明文の一括置換の計画を組み立てました', {
      total: plan.total,
      targets: plan.targets.length,
      alreadyDone: plan.alreadyDone.length,
      excluded: plan.excluded.length,
    }),
});

/**
 * JSON テキストを説明文の一覧として読み込む
 *
 * 形が合わない・商品IDが不正・商品IDが重複している場合は例外を投げます。
 * **一部だけ読めた状態で先へ進めない**ためです（件数がずれたまま実行すると、
 * 確認ダイアログの件数と実際の対象が食い違う）。
 *
 * @param text ファイルの中身（JSON）
 * @param label エラーメッセージに添えるファイルの呼び名（例: 確定版）
 * @returns 読み込んだ一覧（商品IDは `m` + 数字 に正規化済み）
 */
export function parseDescriptionEntries(text: string, label: string): DescriptionEntry[] {
  return planner.parseDescriptionEntries(text, label);
}

/**
 * 実行計画を組み立てる
 *
 * 確定版の各商品について、次の順で振り分けます。
 *
 * 1. 原本に同じ商品IDが無い → 対象外（照合の基準が無いので開かない）
 * 2. 確定版が上限文字数を超える → 対象外（textarea に maxlength が無く、切れたまま保存されうる）
 * 3. 記録上すでに適用済みで、かつ記録の確定版が**今回の確定版と同じ本文** → 今回は処理しない
 * 4. それ以外 → 処理対象
 *
 * 3 で本文の一致まで見るのは、確定版を改訂して 2 回目以降を流すため。商品IDだけで
 * 除外すると、改訂した本文が 1 件も適用されない。
 *
 * @param fixed 確定版の一覧
 * @param originals 原本の一覧
 * @returns 実行計画
 */
export function buildReplacePlan(
  fixed: DescriptionEntry[],
  originals: DescriptionEntry[]
): Promise<DescriptionReplacePlan> {
  return planner.buildReplacePlan(fixed, originals);
}
