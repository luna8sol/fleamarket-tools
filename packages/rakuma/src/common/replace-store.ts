import { ReplaceRecord } from './messages';
import { warn } from './logger';
import { createReplaceStore } from '@fleamarket/core/replace-store';

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
 *
 * 読み込み・検証・書き戻しの骨格は共有部品 `@fleamarket/core/replace-store` にある。
 * ここでは、この拡張のストレージキーと読み書きの失敗時の扱い（warn して処理は止めない）、
 * 読み出し時に確定版の文字数・ハッシュまで検証すること、処理済みの判定で記録の辻褄まで
 * 確かめることを注入する。
 */

/** `chrome.storage.local` 上の保存キー */
const STORAGE_KEY = 'rakuma-bulk-lister:replace-records';

const store = createReplaceStore<ReplaceRecord>({
  read: async () => {
    try {
      return (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY];
    } catch (e) {
      warn('説明文の一括置換の記録を読み込めませんでした', e);
      return {};
    }
  },
  // 保存できなくても処理は止めない（記録が無くても二重保存は起きない）
  write: async (records) => {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: records });
      return true;
    } catch (e) {
      warn('説明文の一括置換の記録を保存できませんでした', e);
      return false;
    }
  },
  warn: (message) => warn(message),
  isValidRecord: (c) => typeof c.expectedLength === 'number' && typeof c.expectedHash === 'string',
  /**
   * 結果種別だけでは信用しない。applied は「保存後に商品ページから読んだ本文」が確定版と
   * 一致していること、already は「開いた時点の本文」が確定版と一致していることまで確かめる。
   * 記録の内部で辻褄が合っていない（完了処理の二重実行などで別の商品の照合結果が
   * 書かれた）ものを適用済み扱いにすると、その商品が永久に処理されなくなるため。
   */
  verifyDone: (record) => {
    if (record.outcome === 'applied') {
      return record.liveLength === record.expectedLength && record.liveHash === record.expectedHash;
    }
    return (
      record.currentLength === record.expectedLength && record.currentHash === record.expectedHash
    );
  },
});

/**
 * 記録上、次の実行から外してよい結果か。
 */
export function isReplaceDone(record: ReplaceRecord): boolean {
  return store.isReplaceDone(record);
}

/**
 * すべての処理記録を読み込む。形の合わないエントリは捨てて警告を残す。
 */
export function loadReplaceRecords(): Promise<Record<string, ReplaceRecord>> {
  return store.loadReplaceRecords();
}

/**
 * 1 件の処理記録を保存する（同じ商品IDの古い記録は置き換える）。
 * 保存できなくても処理は止めない（記録が無くても二重保存は起きない）。
 */
export function saveReplaceRecord(record: ReplaceRecord): Promise<boolean> {
  return store.saveReplaceRecord(record);
}
