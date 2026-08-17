import { QueueItem, ReplaceRecord } from '../../../common/messages';
import { isReplaceDone, loadReplaceRecords } from '../../../common/replace-store';
import { fingerprint } from '../../../common/text-fingerprint';
import { CONFIG } from '../infra/constants';

/**
 * 説明文の一括置換の入力データの読み込みと、実行計画の組み立て。
 *
 * 確定版（置き換え後）と原本（取得時点）の 2 ファイルを `[{ id, name, desc }]` の形で受け取り、
 * **どの商品を処理し、どの商品を処理しないか**をここで決める。
 * 計画に載らなかった商品は 1 件も開かない。
 */

/** 入力ファイルの 1 件 */
export interface DescriptionEntry {
  /** ラクマの商品ID（32 桁の 16 進） */
  id: string;
  name: string;
  desc: string;
}

/** 対象から外れた商品と、その理由 */
export interface ReplaceExclusion {
  id: string;
  name: string;
  reason: string;
}

/** 実行計画 */
export interface ReplacePlan {
  /** 確定版ファイルの件数 */
  total: number;
  /** これから処理する商品（キューに積む形） */
  targets: QueueItem[];
  /** 記録上すでに適用済みで、今回は処理しない商品 */
  alreadyDone: ReplaceRecord[];
  /** 原本が無い・上限文字数超えなどで処理できない商品 */
  excluded: ReplaceExclusion[];
}

/** ラクマの商品ID（/sell のリンク item.fril.jp/{hash} の hash 部分） */
const ITEM_ID_RE = /^[0-9a-f]{32}$/;

function isDescriptionEntry(value: unknown): value is DescriptionEntry {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return typeof c.id === 'string' && typeof c.name === 'string' && typeof c.desc === 'string';
}

/**
 * JSON テキストを説明文の一覧として読み込む。
 *
 * 形が合わない・商品IDが不正・商品IDが重複している場合は例外を投げる。
 * 一部だけ読めた状態で先へ進めない（件数がずれたまま実行すると、
 * 確認ダイアログの件数と実際の対象が食い違う）。
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
    const id = value.id.trim().toLowerCase();
    if (!ITEM_ID_RE.test(id)) {
      throw new Error(
        `${label}: ${index + 1} 件目の商品ID "${value.id}" がラクマの商品ID（32桁の16進）ではありません`
      );
    }
    if (seen.has(id)) {
      throw new Error(`${label}: 商品ID ${id} が重複しています`);
    }
    seen.add(id);
    entries.push({ id, name: value.name, desc: value.desc });
  });
  return entries;
}

/** 記録に残っている確定版と、今回の確定版が同じ本文か（文字数とハッシュの両方で比べる） */
function isSameFinalText(record: ReplaceRecord, entry: DescriptionEntry): boolean {
  const fp = fingerprint(entry.desc);
  return record.expectedLength === fp.length && record.expectedHash === fp.hash;
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
export async function buildReplacePlan(
  finals: DescriptionEntry[],
  originals: DescriptionEntry[]
): Promise<ReplacePlan> {
  const originalById = new Map(originals.map((entry) => [entry.id, entry]));
  const records = await loadReplaceRecords();

  const targets: QueueItem[] = [];
  const alreadyDone: ReplaceRecord[] = [];
  const excluded: ReplaceExclusion[] = [];

  for (const entry of finals) {
    const original = originalById.get(entry.id);
    if (!original) {
      excluded.push({ id: entry.id, name: entry.name, reason: '原本に同じ商品IDがありません' });
      continue;
    }
    if (entry.desc.length > CONFIG.REPLACE_MAX_DESCRIPTION_LENGTH) {
      excluded.push({
        id: entry.id,
        name: entry.name,
        reason: `確定版が ${entry.desc.length} 字で上限 ${CONFIG.REPLACE_MAX_DESCRIPTION_LENGTH} 字を超えています`,
      });
      continue;
    }
    if (entry.desc.includes('\r')) {
      excluded.push({
        id: entry.id,
        name: entry.name,
        reason: '確定版の改行が LF ではありません（CR を含む）',
      });
      continue;
    }
    const record = records[entry.id];
    if (record && isReplaceDone(record) && isSameFinalText(record, entry)) {
      alreadyDone.push(record);
      continue;
    }
    targets.push({
      id: entry.id,
      title: entry.name,
      replace: { original: original.desc, final: entry.desc },
    });
  }

  return { total: finals.length, targets, alreadyDone, excluded };
}
