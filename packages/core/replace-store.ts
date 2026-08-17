/**
 * 説明文の一括置換の処理記録（両拡張で共通の骨格）。
 *
 * 商品IDごとに最新の結果 1 件を `chrome.storage.local` に持ち、中断して再開したとき、
 * 記録上すでに適用済み（`applied` / `already`）の商品を対象から外すために使う。
 *
 * **記録が無くても二重に保存されることはない。** 1 件ずつ開いた時点の本文を
 * 確定版・原本と照合してから書くので、記録はあくまで「開く手間を省く」ためのもの。
 *
 * 拡張ごとに違うもの（ストレージのキー・読み書きの失敗時の扱い・検証する項目・
 * 「処理済み」とみなす追加条件・保存後のログ）は `createReplaceStore` に注入する。
 * ここにあるのは「読んだ値の形を確かめ、壊れたエントリを捨てて警告する」「読んで 1 件
 * 差し替えて書き戻す」「結果種別が処理済みか」の骨格だけ。
 */

/**
 * 1 件の処理結果。
 * - applied: 置換して保存した
 * - already: 開いた時点で確定版と同じだった
 * - skipped: 照合が通らず保存しなかった
 * - failed: 失敗した
 * - unverified: 保存ボタンは押したが、保存後の本文を確認できなかった
 */
export type ReplaceOutcome = 'applied' | 'already' | 'skipped' | 'failed' | 'unverified';

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

/** 両拡張の処理記録に共通する項目（読み出し時にここまでは必ず検証する） */
export interface ReplaceRecordBase {
  id: string;
  name: string;
  outcome: ReplaceOutcome;
  /** 確定ボタンを押したか（押したあとの結果が不明でも true） */
  saved: boolean;
  at: string;
}

export interface ReplaceStoreDeps<R extends ReplaceRecordBase> {
  /** ストレージから生の値を読む。失敗したときの扱い（ログと代わりの値）はこの関数の中で決める */
  read: () => Promise<unknown>;
  /** 記録全体を書き戻す。失敗したときの扱い（ログ）はこの関数の中で決め、成否を返す */
  write: (records: Record<string, R>) => Promise<boolean>;
  /** 壊れた記録を捨てたときの警告 */
  warn: (message: string) => void;
  /** 共通項目に加えて検証する条件。`candidate` は object であることまで確かめてある */
  isValidRecord?: (candidate: Record<string, unknown>) => boolean;
  /** 結果種別が処理済みのとき、さらに記録の中身が辻褄に合っているかを確かめる条件 */
  verifyDone?: (record: R) => boolean;
  /** 保存を試みた直後に呼ぶ（ログ用） */
  afterSave?: (record: R, saved: boolean) => void;
}

export interface ReplaceStore<R extends ReplaceRecordBase> {
  /** 記録上、次の実行から外してよい結果か */
  isReplaceDone(record: R): boolean;
  /** すべての処理記録を読み込む。形の合わないエントリは捨てて警告を残す */
  loadReplaceRecords(): Promise<Record<string, R>>;
  /** 1 件の処理記録を保存する（同じ商品IDの古い記録は置き換える） */
  saveReplaceRecord(record: R): Promise<boolean>;
}

export function createReplaceStore<R extends ReplaceRecordBase>(
  deps: ReplaceStoreDeps<R>
): ReplaceStore<R> {
  /**
   * ストレージから読んだ値が処理記録の形をしているかを確かめる。
   * `chrome.storage.local` の中身は型どおりとは限らないため、必要な項目だけ確認する。
   */
  const isReplaceRecord = (value: unknown): value is R => {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Record<string, unknown>;
    return (
      typeof candidate.id === 'string' &&
      typeof candidate.name === 'string' &&
      typeof candidate.outcome === 'string' &&
      KNOWN_OUTCOMES.includes(candidate.outcome as ReplaceOutcome) &&
      typeof candidate.saved === 'boolean' &&
      (deps.isValidRecord ? deps.isValidRecord(candidate) : true) &&
      typeof candidate.at === 'string'
    );
  };

  const loadReplaceRecords = async (): Promise<Record<string, R>> => {
    const stored = await deps.read();
    if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) {
      if (stored !== undefined && stored !== null) {
        deps.warn('説明文の一括置換の記録が想定外の形だったため無視します');
      }
      return {};
    }

    const records: Record<string, R> = {};
    let dropped = 0;

    for (const [id, value] of Object.entries(stored as Record<string, unknown>)) {
      if (isReplaceRecord(value) && value.id === id) {
        records[id] = value;
      } else {
        dropped++;
      }
    }

    if (dropped > 0) {
      deps.warn(`説明文の一括置換の記録のうち ${dropped} 件が壊れていたため無視します`);
    }

    return records;
  };

  return {
    isReplaceDone(record: R): boolean {
      if (!DONE_OUTCOMES.includes(record.outcome)) return false;
      return deps.verifyDone ? deps.verifyDone(record) : true;
    },

    loadReplaceRecords,

    async saveReplaceRecord(record: R): Promise<boolean> {
      const records = await loadReplaceRecords();
      records[record.id] = record;

      const saved = await deps.write(records);
      deps.afterSave?.(record, saved);
      return saved;
    },
  };
}
