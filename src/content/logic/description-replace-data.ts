import { CONFIG } from '../infra/constants';
import { isReplaceDone, loadReplaceRecords } from '../infra/description-replace-store';
import { debug } from '../infra/logger';
import {
  DescriptionEntry,
  DescriptionReplaceExclusion,
  DescriptionReplacePlan,
  DescriptionReplaceRecord,
  DescriptionReplaceTarget,
} from '../infra/types';
import { toItemId } from './dom-utils';

/**
 * 説明文の一括置換の入力データの読み込みと、実行計画の組み立て。
 *
 * 確定版（置き換え後）と原本（取得時点）の 2 ファイルを `[{ id, name, desc }]` の形で受け取り、
 * **どの商品を処理し、どの商品を処理しないか**をここで決めます。
 * 計画に載らなかった商品は 1 件も開きません。
 */

/**
 * 1 要素が `{ id, name, desc }` の形かを確かめる
 *
 * @param value 検証対象
 * @returns 形が合えば true
 */
function isDescriptionEntry(value: unknown): value is DescriptionEntry {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.desc === 'string'
  );
}

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
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${label}: JSON として読み取れませんでした`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`${label}: 配列ではありません（[{ id, name, desc }] の形が必要です）`);
  }

  const entries: DescriptionEntry[] = [];
  const seen = new Set<string>();

  parsed.forEach((value, index) => {
    if (!isDescriptionEntry(value)) {
      throw new Error(`${label}: ${index + 1} 件目が { id, name, desc } の形ではありません`);
    }

    const id = toItemId(value.id);
    if (!id) {
      throw new Error(`${label}: ${index + 1} 件目の商品ID "${value.id}" を解釈できません`);
    }
    if (seen.has(id)) {
      throw new Error(`${label}: 商品ID ${id} が重複しています`);
    }

    seen.add(id);
    entries.push({ id, name: value.name, desc: value.desc });
  });

  debug(`${label}を読み込みました`, { count: entries.length });
  return entries;
}

/**
 * 実行計画を組み立てる
 *
 * 確定版の各商品について、次の順で振り分けます。
 *
 * 1. 原本に同じ商品IDが無い → 対象外（照合の基準が無いので開かない）
 * 2. 確定版が上限文字数を超える → 対象外（textarea に maxlength が無く、切れたまま保存されうる）
 * 3. 記録上すでに適用済み → 今回は処理しない
 * 4. それ以外 → 処理対象
 *
 * @param fixed 確定版の一覧
 * @param originals 原本の一覧
 * @returns 実行計画
 */
export async function buildReplacePlan(
  fixed: DescriptionEntry[],
  originals: DescriptionEntry[]
): Promise<DescriptionReplacePlan> {
  const originalById = new Map(originals.map((entry) => [entry.id, entry]));
  const records = await loadReplaceRecords();

  const targets: DescriptionReplaceTarget[] = [];
  const alreadyDone: DescriptionReplaceRecord[] = [];
  const excluded: DescriptionReplaceExclusion[] = [];

  for (const entry of fixed) {
    const original = originalById.get(entry.id);
    if (!original) {
      excluded.push({ id: entry.id, name: entry.name, reason: '原本に同じ商品IDがありません' });
      continue;
    }

    if (entry.desc.length > CONFIG.DESCRIPTION_REPLACE_MAX_LENGTH) {
      excluded.push({
        id: entry.id,
        name: entry.name,
        reason: `確定版が ${entry.desc.length} 字で上限 ${CONFIG.DESCRIPTION_REPLACE_MAX_LENGTH} 字を超えています`,
      });
      continue;
    }

    const record = records[entry.id];
    if (record && isReplaceDone(record)) {
      alreadyDone.push(record);
      continue;
    }

    targets.push({ entry, original });
  }

  debug('説明文の一括置換の計画を組み立てました', {
    total: fixed.length,
    targets: targets.length,
    alreadyDone: alreadyDone.length,
    excluded: excluded.length,
  });

  return { total: fixed.length, targets, alreadyDone, excluded };
}
