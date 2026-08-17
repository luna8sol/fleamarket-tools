/**
 * 出品フォームページ用の待機ユーティリティ。
 *
 * ラクマの出品フォームはReact製で要素の出現タイミングが読めないため、
 * 条件が満たされるまでポーリングで待つ。
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
export function waitFor<T>(fn: () => T | null | undefined, options: WaitForOptions): Promise<T> {
  const intervalMs = options.intervalMs ?? 500;

  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    const tick = (): void => {
      const result = fn();
      if (result !== null && result !== undefined) {
        resolve(result);
        return;
      }
      if (Date.now() - startedAt >= options.timeoutMs) {
        reject(new Error(`${options.label}が${options.timeoutMs}ms以内に確認できませんでした`));
        return;
      }
      window.setTimeout(tick, intervalMs);
    };

    tick();
  });
}
