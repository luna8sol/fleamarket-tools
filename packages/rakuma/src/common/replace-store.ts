import { ReplaceOutcome, ReplaceRecord } from './messages';
import { warn } from './logger';

/**
 * 説明文の一括置換の処理記録。
 *
 * 商品IDごとに最新の結果 1 件を `chrome.storage.local` に持つ
 * （`chrome.storage.session` ではなく local なのは、拡張の再読み込みや
 * ブラウザの再起動をまたいで「どこまで適用したか」を残すため）。
 *
 * 書くのは Background（結果が確定するのは Background 側なので）、
 * 読むのは一覧ページの Content Script（次回の計画と結果出力）。
 *
 * **記録が無くても二重に保存されることはない。** 編集ページを開いた時点の本文を
 * 確定版・原本と照合してから書くので、記録はあくまで「開く手間を省く」ためのもの。
 */

/** `chrome.storage.local` 上の保存キー */
const STORAGE_KEY = 'rakuma-bulk-lister:replace-records';

/** 記録上「処理済み」として次の実行から外す結果種別 */
const DONE_OUTCOMES: readonly ReplaceOutcome[] = ['applied', 'already'];

/** ストレージに入りうる結果種別（読み出し時の検証に使う） */
const KNOWN_OUTCOMES: readonly ReplaceOutcome[] = [
  'applied',
  'already',
  'skipped',
  'failed',
  'unverified',
];

function isReplaceRecord(value: unknown): value is ReplaceRecord {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.id === 'string' &&
    typeof c.name === 'string' &&
    typeof c.outcome === 'string' &&
    KNOWN_OUTCOMES.includes(c.outcome as ReplaceOutcome) &&
    typeof c.saved === 'boolean' &&
    typeof c.expectedLength === 'number' &&
    typeof c.expectedHash === 'string' &&
    typeof c.at === 'string'
  );
}

/**
 * 記録上、次の実行から外してよい結果か。
 *
 * 結果種別だけでは信用しない。applied は「保存後に商品ページから読んだ本文」が確定版と
 * 一致していること、already は「開いた時点の本文」が確定版と一致していることまで確かめる。
 * 記録の内部で辻褄が合っていない（完了処理の二重実行などで別の商品の照合結果が
 * 書かれた）ものを適用済み扱いにすると、その商品が永久に処理されなくなるため。
 */
export function isReplaceDone(record: ReplaceRecord): boolean {
  if (!DONE_OUTCOMES.includes(record.outcome)) return false;
  if (record.outcome === 'applied') {
    return record.liveLength === record.expectedLength && record.liveHash === record.expectedHash;
  }
  return (
    record.currentLength === record.expectedLength && record.currentHash === record.expectedHash
  );
}

/**
 * すべての処理記録を読み込む。形の合わないエントリは捨てて警告を残す。
 */
export async function loadReplaceRecords(): Promise<Record<string, ReplaceRecord>> {
  let stored: unknown;
  try {
    stored = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY];
  } catch (e) {
    warn('説明文の一括置換の記録を読み込めませんでした', e);
    return {};
  }
  if (stored === undefined || stored === null) return {};
  if (typeof stored !== 'object' || Array.isArray(stored)) {
    warn('説明文の一括置換の記録が想定外の形だったため無視します');
    return {};
  }

  const records: Record<string, ReplaceRecord> = {};
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
 * 1 件の処理記録を保存する（同じ商品IDの古い記録は置き換える）。
 * 保存できなくても処理は止めない（記録が無くても二重保存は起きない）。
 */
export async function saveReplaceRecord(record: ReplaceRecord): Promise<boolean> {
  try {
    const records = await loadReplaceRecords();
    records[record.id] = record;
    await chrome.storage.local.set({ [STORAGE_KEY]: records });
    return true;
  } catch (e) {
    warn('説明文の一括置換の記録を保存できませんでした', e);
    return false;
  }
}
