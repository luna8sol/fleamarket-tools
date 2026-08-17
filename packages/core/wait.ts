/**
 * 待機・ポーリングのユーティリティ（両拡張の content script から使う）。
 *
 * Background（Service Worker）からは使わない。SW は破棄されるとタイマーごと
 * 消えるため、Background 側の待機は chrome.alarms で行う。
 *
 * 2 つの拡張で「満たされた」とみなす判定が違うため、判定方法ごとに関数を分けている。
 * - pollUntil: null / undefined 以外を「満たされた」とみなす（ラクマ用拡張の従来どおり）
 * - pollUntilTruthy: truthy を「満たされた」とみなす（メルカリ用拡張の従来どおり。
 *   0 / '' / false は「まだ」として待ち続ける）
 * どちらも、先に判定してから待つ（すでに満たされていれば待たずに返る）。
 * 時間切れのときは null を返し、例外は投げない。扱いは呼び出し側で決める。
 */

/** ポーリング間隔の既定値 (ms) */
const DEFAULT_POLL_INTERVAL_MS = 500;

/** 指定ミリ秒だけ待つ */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface PollOptions {
  /** 最大待機時間 (ms) */
  timeoutMs: number;
  /** ポーリング間隔 (ms)。既定は 500ms */
  intervalMs?: number;
}

async function pollWith<T>(
  fn: () => T,
  isReady: (value: T) => boolean,
  options: PollOptions
): Promise<T | null> {
  const intervalMs = options.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const startedAt = Date.now();

  for (;;) {
    const result = fn();
    if (isReady(result)) return result;
    if (Date.now() - startedAt >= options.timeoutMs) return null;
    await delay(intervalMs);
  }
}

/**
 * fn が null / undefined 以外を返すまでポーリングし、その値を返す。
 * timeoutMs 以内に返らなければ null を返す。
 */
export function pollUntil<T>(
  fn: () => T | null | undefined,
  options: PollOptions
): Promise<T | null> {
  return pollWith(
    fn,
    (value) => value !== null && value !== undefined,
    options
  ) as Promise<T | null>;
}

/**
 * fn が truthy な値を返すまでポーリングし、その値を返す。
 * timeoutMs 以内に返らなければ null を返す。
 */
export function pollUntilTruthy<T>(
  fn: () => T | null | undefined | false,
  options: PollOptions
): Promise<T | null> {
  return pollWith(fn, (value) => Boolean(value), options) as Promise<T | null>;
}
