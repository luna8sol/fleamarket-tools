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

/**
 * 関数の実行レートを制限する
 * @param fn 対象の関数
 * @param limit 最小間隔(ms)
 * @returns スロットリングされた関数
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  let lastFunc: ReturnType<typeof setTimeout>;
  let lastRan = 0;

  return function(this: unknown, ...args: Parameters<T>): void {
    const context = this;

    if (!inThrottle) {
      fn.apply(context, args);
      lastRan = Date.now();
      inThrottle = true;
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(() => {
        if (Date.now() - lastRan >= limit) {
          fn.apply(context, args);
          lastRan = Date.now();
        }
      }, Math.max(limit - (Date.now() - lastRan), 0));
    }
  };
}
