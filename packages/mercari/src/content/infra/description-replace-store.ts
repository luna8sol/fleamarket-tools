import { ExtStorageKey, getExtStorage, setExtStorage } from '../../common/ext-storage';
import { debug, warn } from './logger';
import { DescriptionReplaceOutcome, DescriptionReplaceRecord } from './types';

/**
 * 説明文の一括置換の処理記録。
 *
 * 商品IDごとに最新の結果 1 件を `chrome.storage.local` に持ちます。
 * 中断して再開したとき、記録上すでに適用済み（`applied` / `already`）の商品を
 * 対象から外すために使います。
 *
 * **記録が無くても二重に保存されることはありません。** 1 件ずつ開いた時点の本文を
 * 確定版・原本と照合してから書くので、記録はあくまで「開く手間を省く」ためのものです。
 */

/** 記録上「処理済み」として次の実行から外す結果種別 */
const DONE_OUTCOMES: readonly DescriptionReplaceOutcome[] = ['applied', 'already'];

/** ストレージに入りうる結果種別（読み出し時の検証に使う） */
const KNOWN_OUTCOMES: readonly DescriptionReplaceOutcome[] = [
  'applied',
  'already',
  'skipped',
  'failed',
  'unverified',
];

/**
 * ストレージから読んだ値が処理記録の形をしているかを確かめる
 *
 * `chrome.storage.local` の中身は型どおりとは限らないため、必要な項目だけ確認します。
 *
 * @param value 検証対象
 * @returns 処理記録として扱えれば true
 */
function isReplaceRecord(value: unknown): value is DescriptionReplaceRecord {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.outcome === 'string' &&
    KNOWN_OUTCOMES.includes(candidate.outcome as DescriptionReplaceOutcome) &&
    typeof candidate.saved === 'boolean' &&
    typeof candidate.at === 'string'
  );
}

/**
 * 記録上、次の実行から外してよい結果か
 *
 * @param record 処理記録
 * @returns 適用済みとして扱うなら true
 */
export function isReplaceDone(record: DescriptionReplaceRecord): boolean {
  return DONE_OUTCOMES.includes(record.outcome);
}

/**
 * すべての処理記録を読み込む
 *
 * 形の合わないエントリは捨てて警告を残します。
 *
 * @returns 商品IDをキーにした処理記録
 */
export async function loadReplaceRecords(): Promise<Record<string, DescriptionReplaceRecord>> {
  const stored = await getExtStorage<unknown>(ExtStorageKey.DESCRIPTION_REPLACE_RECORDS, {});
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) {
    if (stored !== undefined && stored !== null) {
      warn('説明文の一括置換の記録が想定外の形だったため無視します');
    }
    return {};
  }

  const records: Record<string, DescriptionReplaceRecord> = {};
  let dropped = 0;

  for (const [id, value] of Object.entries(stored as Record<string, unknown>)) {
    if (isReplaceRecord(value) && value.id === id) {
      records[id] = value;
    } else {
      dropped++;
    }
  }

  if (dropped > 0) {
    warn(`説明文の一括置換の記録のうち ${dropped} 件が壊れていたため無視します`);
  }

  return records;
}

/**
 * 1 件の処理記録を保存する（同じ商品IDの古い記録は置き換える）
 *
 * @param record 保存する処理記録
 * @returns 保存に成功したか
 */
export async function saveReplaceRecord(record: DescriptionReplaceRecord): Promise<boolean> {
  const records = await loadReplaceRecords();
  records[record.id] = record;

  const saved = await setExtStorage(ExtStorageKey.DESCRIPTION_REPLACE_RECORDS, records);
  debug('説明文の一括置換の記録を保存', { id: record.id, outcome: record.outcome, saved });
  return saved;
}
