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

/**
 * null/undefined/空文字列を安全に判定する。
 *
 * @param val 判定対象
 * @returns {boolean} null/undefined/空文字列ならtrue
 * @example
 *   isNullOrEmpty('') // true
 *   isNullOrEmpty(null) // true
 *   isNullOrEmpty('abc') // false
 */
export function isNullOrEmpty(val: unknown): boolean {
  return val === null || val === undefined || (typeof val === 'string' && val.trim() === '');
}

// 今後も共通化したい関数があればここに追加してください
