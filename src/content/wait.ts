/**
 * Content Script 共通の待機ユーティリティ。
 *
 * 一覧ページ（content-list）と出品フォームページ（content-form）は別バンドルだが、
 * 「指定時間だけ待つ」「条件が満たされるまでポーリングする」処理はどちらでも要るため、
 * 実装をここ 1 か所に置く。
 *
 * Background（Service Worker）からは使わない。SWは破棄されるとタイマーごと
 * 消えるため、Background側の待機は chrome.alarms で行う。
 */

/** ポーリング間隔の既定値 (ms) */
const DEFAULT_POLL_INTERVAL_MS = 500;

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export interface PollOptions {
  /** 最大待機時間 (ms) */
  timeoutMs: number;
  /** ポーリング間隔 (ms)。既定は 500ms */
  intervalMs?: number;
}

/**
 * fn が null/undefined 以外を返すまでポーリングし、その値を返す。
 * timeoutMs 以内に返らなければ null を返す（例外は投げない）。
 *
 * 判定してから待つ順序なので、すでに条件が満たされていれば待たずに返る。
 * タイムアウトの扱いは呼び出し側で決める。form/wait.ts の waitFor は
 * この戻り値を見て reject に変え、pager.ts は false を返して諦める。
 */
export async function pollUntil<T>(
  fn: () => T | null | undefined,
  options: PollOptions
): Promise<T | null> {
  const intervalMs = options.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const startedAt = Date.now();

  for (;;) {
    const result = fn();
    if (result !== null && result !== undefined) return result;
    if (Date.now() - startedAt >= options.timeoutMs) return null;
    await delay(intervalMs);
  }
}
