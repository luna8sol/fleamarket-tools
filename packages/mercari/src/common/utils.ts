/**
 * 共通ユーティリティ関数集
 *
 * - アプリ全体でimportして使える汎用関数をまとめています。
 * - 非同期待機・ランダム整数生成・null/空判定など、どのレイヤーからも利用可能です。
 * - 新たな共通処理はこのファイルに追加してください。
 */

/**
 * 指定秒数だけ非同期で待機する。
 *
 * @param seconds 待機する秒数
 * @returns Promise<void> 指定秒数後に解決するPromise
 * @example
 *   await sleep(2); // 2秒待機
 */
export function sleep(seconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

/**
 * 指定範囲内のランダム整数を返す。
 *
 * @param min 最小値（含む）
 * @param max 最大値（含む）
 * @returns {number} min以上max以下のランダム整数
 * @example
 *   const n = randomInt(1, 5); // 1〜5のどれか
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 今後も共通化したい関数があればここに追加してください

/**
 * 条件が満たされるまでポーリングで待つ。
 *
 * - メルカリのフォームは React で遅延描画されるため「まだ無い」と「もう無い」を
 *   区別できません。必ず上限時間を設け、待てなかったことを呼び出し側へ返します。
 * - 判定関数が値を返した場合はその値を返すため、要素の出現待ちと取得を兼ねられます。
 *
 * @template T 判定関数が返す値の型
 * @param probe 条件判定。満たされたら値を、未達なら null / undefined / false を返す
 * @param timeoutMs 待機の上限（ミリ秒）
 * @param intervalMs ポーリング間隔（ミリ秒）
 * @returns 満たされた時点の値。時間内に満たされなければ null
 * @example
 *   const input = await waitFor(() => document.querySelector('input[name="name"]'), 20000, 250);
 */
export async function waitFor<T>(
  probe: () => T | null | undefined | false,
  timeoutMs: number,
  intervalMs: number
): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const value = probe();
    if (value) return value;
    if (Date.now() >= deadline) return null;
    await sleep(intervalMs / 1000);
  }
}

/**
 * FNV-1a（32bit）ハッシュを 10 進文字列で返す。
 *
 * - 説明文の一括置換で、原本・確定版・保存後の本文が**一字一句同じか**を照合するために使います。
 *   文字数だけでは並び替えや置換の取りこぼしを見分けられないため、文字数と併せて比較します。
 * - `charCodeAt` 単位（UTF-16 コードユニット）で畳み込みます。サロゲートペアも 2 単位として
 *   一貫して扱われるので、同じ実装同士で比べる限り結果は一致します。
 * - 暗号用途ではありません。改ざん検知ではなく「取得後に変わっていないか」の判定に使います。
 *
 * @param value ハッシュを取る文字列
 * @returns 32bit 符号なし整数を 10 進表記した文字列
 * @example
 *   fnv1a32('abc'); // '440920331'
 */
export function fnv1a32(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return String(hash);
}
