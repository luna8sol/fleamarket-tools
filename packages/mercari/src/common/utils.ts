/**
 * 共通ユーティリティ関数集
 *
 * - 実装は共有部品 `@fleamarket/core` にある。このファイルは、この拡張の従来の
 *   シグネチャ（秒単位の sleep、引数を並べる waitFor、10 進表記の fnv1a32）を保つための
 *   薄いラッパー。呼び出し側はこれまでどおりここから import する。
 */
import { fnv1a32 as fnv1a32Number } from '@fleamarket/core/text-hash';
import { delay, pollUntilTruthy } from '@fleamarket/core/wait';

export { randomInt } from '@fleamarket/core/random';

/**
 * 指定秒数だけ非同期で待機する。
 *
 * @param seconds 待機する秒数
 * @returns Promise<void> 指定秒数後に解決するPromise
 * @example
 *   await sleep(2); // 2秒待機
 */
export function sleep(seconds: number): Promise<void> {
  return delay(seconds * 1000);
}

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
export function waitFor<T>(
  probe: () => T | null | undefined | false,
  timeoutMs: number,
  intervalMs: number
): Promise<T | null> {
  return pollUntilTruthy(probe, { timeoutMs, intervalMs });
}

/**
 * FNV-1a（32bit）ハッシュを 10 進文字列で返す。
 *
 * - 説明文の一括置換で、原本・確定版・保存後の本文が**一字一句同じか**を照合するために使います。
 * - 10 進表記は保存済みの置換記録（`expectedHash` など）と照合するための値なので変えないこと。
 *
 * @param value ハッシュを取る文字列
 * @returns 32bit 符号なし整数を 10 進表記した文字列
 * @example
 *   fnv1a32('abc'); // '440920331'
 */
export function fnv1a32(value: string): string {
  return String(fnv1a32Number(value));
}
