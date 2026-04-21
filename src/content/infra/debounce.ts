/**
 * 関数の連続実行を抑制する
 * @param fn 対象の関数
 * @param delay 遅延時間(ms)
 * @returns デバウンスされた関数
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: number | null = null;

  return function(this: unknown, ...args: Parameters<T>): void {
    const context = this;

    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }

    timeoutId = window.setTimeout(() => {
      fn.apply(context, args);
      timeoutId = null;
    }, delay);
  };
}

