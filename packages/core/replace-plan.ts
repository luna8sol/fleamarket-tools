/**
 * 説明文の一括置換の入力データの読み込みと、実行計画の組み立て（両拡張で共通の骨格）。
 *
 * 確定版（置き換え後）と原本（取得時点）の 2 ファイルを `[{ id, name, desc }]` の形で受け取り、
 * **どの商品を処理し、どの商品を処理しないか**をここで決める。
 * 計画に載らなかった商品は 1 件も開かない。
 *
 * 拡張ごとに違うもの（商品IDの正規化とその文言・本文の同一判定に使うハッシュの表記・
 * 上限文字数・処理記録の読み込みと処理済み判定・追加の除外条件・対象の形・ログ）は
 * `createReplacePlanner` に注入する。両拡張で同じ文言はここに置く。
 */

/** 入力ファイルの 1 件 */
export interface DescriptionEntry {
  /** 商品ID（正規化済み） */
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

/** 実行計画。`T` は処理対象 1 件の形、`R` は処理記録の形 */
export interface ReplacePlan<T, R> {
  /** 確定版ファイルの件数 */
  total: number;
  /** これから処理する商品 */
  targets: T[];
  /** 記録上すでに適用済みで、今回は処理しない商品 */
  alreadyDone: R[];
  /** 原本が無い・上限文字数超えなどで処理できない商品 */
  excluded: ReplaceExclusion[];
}

/** 処理記録のうち、計画の組み立てが参照する項目 */
export interface ReplaceRecordLike {
  /** 確定版の文字数 */
  expectedLength: number;
  /** 確定版のハッシュ（表記は拡張ごとに違う） */
  expectedHash: string;
}

export interface ReplacePlannerDeps<T, R extends ReplaceRecordLike> {
  /** 入力の商品IDを正規化する。解釈できなければ null */
  normalizeId: (raw: string) => string | null;
  /** 商品IDを解釈できなかったときの文言。`position` は 1 始まり、`raw` は入力のままの値 */
  invalidIdMessage: (label: string, position: number, raw: string) => string;
  /** 確定版の上限文字数 */
  maxLength: number;
  /** 本文のハッシュ。記録の `expectedHash` と同じ表記で返す */
  hash: (text: string) => string;
  /** 処理記録を商品IDをキーに読み込む */
  loadRecords: () => Promise<Record<string, R>>;
  /** 記録上、次の実行から外してよい結果か */
  isDone: (record: R) => boolean;
  /** 処理対象 1 件の形に組み立てる */
  toTarget: (entry: DescriptionEntry, original: DescriptionEntry) => T;
  /** 原本の有無と上限の判定のあと、さらに除外するなら理由を返す。除外しないなら null */
  excludeReason?: (entry: DescriptionEntry) => string | null;
  /** 一覧を読み込めたときに呼ぶ（ログ用） */
  onParsed?: (label: string, count: number) => void;
  /** 計画を組み立てたときに呼ぶ（ログ用） */
  onPlanned?: (plan: ReplacePlan<T, R>) => void;
}

export interface ReplacePlanner<T, R> {
  /**
   * JSON テキストを説明文の一覧として読み込む。
   *
   * 形が合わない・商品IDが不正・商品IDが重複している場合は例外を投げる。
   * **一部だけ読めた状態で先へ進めない**ため（件数がずれたまま実行すると、
   * 確認ダイアログの件数と実際の対象が食い違う）。
   */
  parseDescriptionEntries(text: string, label: string): DescriptionEntry[];
  /**
   * 実行計画を組み立てる。確定版の各商品について次の順で振り分ける。
   *
   * 1. 原本に同じ商品IDが無い → 対象外（照合の基準が無いので開かない）
   * 2. 確定版が上限文字数を超える → 対象外（説明欄に maxlength が無く、切れたまま保存されうる）
   * 3. 注入された追加の除外条件に当たる → 対象外
   * 4. 記録上すでに適用済みで、かつ記録の確定版が**今回の確定版と同じ本文** → 今回は処理しない
   * 5. それ以外 → 処理対象
   *
   * 4 で本文の一致まで見るのは、確定版を改訂して 2 回目以降を流すため。商品IDだけで
   * 除外すると、改訂した本文が 1 件も適用されない。
   */
  buildReplacePlan(
    fixed: DescriptionEntry[],
    originals: DescriptionEntry[]
  ): Promise<ReplacePlan<T, R>>;
}

/** 1 要素が `{ id, name, desc }` の形かを確かめる */
function isDescriptionEntry(value: unknown): value is DescriptionEntry {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.desc === 'string'
  );
}

export function createReplacePlanner<T, R extends ReplaceRecordLike>(
  deps: ReplacePlannerDeps<T, R>
): ReplacePlanner<T, R> {
  /** 記録に残っている確定版と、今回の確定版が同じ本文か（文字数とハッシュの両方で比べる） */
  const isSameFixedText = (record: R, entry: DescriptionEntry): boolean =>
    record.expectedLength === entry.desc.length && record.expectedHash === deps.hash(entry.desc);

  return {
    parseDescriptionEntries(text: string, label: string): DescriptionEntry[] {
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

        const id = deps.normalizeId(value.id);
        if (!id) {
          throw new Error(deps.invalidIdMessage(label, index + 1, value.id));
        }
        if (seen.has(id)) {
          throw new Error(`${label}: 商品ID ${id} が重複しています`);
        }

        seen.add(id);
        entries.push({ id, name: value.name, desc: value.desc });
      });

      deps.onParsed?.(label, entries.length);
      return entries;
    },

    async buildReplacePlan(
      fixed: DescriptionEntry[],
      originals: DescriptionEntry[]
    ): Promise<ReplacePlan<T, R>> {
      const originalById = new Map(originals.map((entry) => [entry.id, entry]));
      const records = await deps.loadRecords();

      const targets: T[] = [];
      const alreadyDone: R[] = [];
      const excluded: ReplaceExclusion[] = [];

      for (const entry of fixed) {
        const original = originalById.get(entry.id);
        if (!original) {
          excluded.push({ id: entry.id, name: entry.name, reason: '原本に同じ商品IDがありません' });
          continue;
        }

        if (entry.desc.length > deps.maxLength) {
          excluded.push({
            id: entry.id,
            name: entry.name,
            reason: `確定版が ${entry.desc.length} 字で上限 ${deps.maxLength} 字を超えています`,
          });
          continue;
        }

        const extraReason = deps.excludeReason?.(entry) ?? null;
        if (extraReason !== null) {
          excluded.push({ id: entry.id, name: entry.name, reason: extraReason });
          continue;
        }

        const record = records[entry.id];
        if (record && deps.isDone(record) && isSameFixedText(record, entry)) {
          alreadyDone.push(record);
          continue;
        }

        targets.push(deps.toTarget(entry, original));
      }

      const plan: ReplacePlan<T, R> = { total: fixed.length, targets, alreadyDone, excluded };
      deps.onPlanned?.(plan);
      return plan;
    },
  };
}
