import { pollUntil } from '../wait';

/**
 * 出品フォームページ用の待機ユーティリティ。
 *
 * ラクマの出品フォームはReact製で要素の出現タイミングが読めないため、
 * 条件が満たされるまでポーリングで待つ。ポーリング自体は content/wait.ts の
 * pollUntil が行い、ここでは「見つからなければエラーで止める」という
 * フォーム側の扱い方だけを足す。
 */

export interface WaitForOptions {
  /** 最大待機時間 (ms) */
  timeoutMs: number;
  /** ポーリング間隔 (ms) */
  intervalMs?: number;
  /** タイムアウト時のエラーメッセージに使う説明 */
  label: string;
}

/**
 * fn が null/undefined 以外を返すまでポーリングで待機する。
 * タイムアウトした場合は label を含むエラーでrejectする。
 */
export async function waitFor<T>(
  fn: () => T | null | undefined,
  options: WaitForOptions
): Promise<T> {
  const result = await pollUntil(fn, {
    timeoutMs: options.timeoutMs,
    intervalMs: options.intervalMs,
  });
  if (result === null) {
    throw new Error(`${options.label}が${options.timeoutMs}ms以内に確認できませんでした`);
  }
  return result;
}
