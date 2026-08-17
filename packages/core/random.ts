/**
 * 指定範囲内のランダム整数を返す。
 *
 * @param min 最小値（含む）
 * @param max 最大値（含む）
 * @returns min 以上 max 以下のランダム整数
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
