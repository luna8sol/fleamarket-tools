/**
 * Content Script 共通の待機ユーティリティ。
 *
 * 一覧ページ（content-list）と出品フォームページ（content-form）は別バンドルだが、
 * 「指定時間だけ待つ」処理はどちらでも要るため、実装をここ 1 か所に置く。
 *
 * Background（Service Worker）からは使わない。SWは破棄されるとタイマーごと
 * 消えるため、Background側の待機は chrome.alarms で行う。
 */

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
