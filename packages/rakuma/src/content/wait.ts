/**
 * Content Script 共通の待機ユーティリティ。
 *
 * 一覧ページ（content-list）と出品フォームページ（content-form）は別バンドルだが、
 * 「指定時間だけ待つ」「条件が満たされるまでポーリングする」処理はどちらでも要るため、
 * 実装を共有部品 `@fleamarket/core` の 1 か所に置き、ここから再エクスポートする。
 *
 * Background（Service Worker）からは使わない。SWは破棄されるとタイマーごと
 * 消えるため、Background側の待機は chrome.alarms で行う。
 */
export { delay, pollUntil } from '@fleamarket/core/wait';
export type { PollOptions } from '@fleamarket/core/wait';
