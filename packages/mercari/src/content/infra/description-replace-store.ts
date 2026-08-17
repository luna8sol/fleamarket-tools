import { ExtStorageKey, getExtStorage, setExtStorage } from '../../common/ext-storage';
import { debug, warn } from './logger';
import { DescriptionReplaceRecord } from './types';
import { createReplaceStore } from '@fleamarket/core/replace-store';

/**
 * 説明文の一括置換の処理記録。
 *
 * 商品IDごとに最新の結果 1 件を `chrome.storage.local` に持ちます。
 * 中断して再開したとき、記録上すでに適用済み（`applied` / `already`）の商品を
 * 対象から外すために使います。
 *
 * **記録が無くても二重に保存されることはありません。** 1 件ずつ開いた時点の本文を
 * 確定版・原本と照合してから書くので、記録はあくまで「開く手間を省く」ためのものです。
 *
 * 読み込み・検証・書き戻しの骨格は共有部品 `@fleamarket/core/replace-store` にあります。
 * ここでは、この拡張のストレージキー（`ExtStorageKey.DESCRIPTION_REPLACE_RECORDS`。読み書きの
 * 失敗時のログは ext-storage 側）と、保存後の debug ログを注入します。処理済みの判定は
 * 結果種別（`applied` / `already`）だけで行います。
 */
const store = createReplaceStore<DescriptionReplaceRecord>({
  read: () => getExtStorage<unknown>(ExtStorageKey.DESCRIPTION_REPLACE_RECORDS, {}),
  write: (records) => setExtStorage(ExtStorageKey.DESCRIPTION_REPLACE_RECORDS, records),
  warn: (message) => warn(message),
  afterSave: (record, saved) =>
    debug('説明文の一括置換の記録を保存', { id: record.id, outcome: record.outcome, saved }),
});

/**
 * 記録上、次の実行から外してよい結果か
 *
 * @param record 処理記録
 * @returns 適用済みとして扱うなら true
 */
export function isReplaceDone(record: DescriptionReplaceRecord): boolean {
  return store.isReplaceDone(record);
}

/**
 * すべての処理記録を読み込む
 *
 * 形の合わないエントリは捨てて警告を残します。
 *
 * @returns 商品IDをキーにした処理記録
 */
export function loadReplaceRecords(): Promise<Record<string, DescriptionReplaceRecord>> {
  return store.loadReplaceRecords();
}

/**
 * 1 件の処理記録を保存する（同じ商品IDの古い記録は置き換える）
 *
 * @param record 保存する処理記録
 * @returns 保存に成功したか
 */
export function saveReplaceRecord(record: DescriptionReplaceRecord): Promise<boolean> {
  return store.saveReplaceRecord(record);
}
