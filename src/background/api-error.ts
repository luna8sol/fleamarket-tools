import Anthropic from '@anthropic-ai/sdk';

/**
 * Claude API 呼び出し時の例外を、content script にそのまま表示できる日本語メッセージへ変換するモジュール。
 *
 * - SDK の型付き例外（{@link Anthropic.AuthenticationError} 等）で分岐します。
 * - 例外オブジェクトはメッセージパッシングで構造化クローンできないため、必ず文字列化して返します。
 * - APIキーはこのモジュールに渡さないこと。SDKの例外メッセージにキーは含まれませんが、
 *   ここで組み立てた文字列は content script に渡るため、キーを混ぜてはいけません。
 */

/**
 * Claude API の例外を日本語のエラーメッセージに変換する。
 *
 * @param e 発生した例外
 * @returns {string} ユーザーに表示する日本語メッセージ
 * @example
 *   sendResponse({ ok: false, message: toJapaneseErrorMessage(e) });
 */
export function toJapaneseErrorMessage(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) {
    return 'APIキーが正しくありません。拡張機能のオプション画面で設定を確認してください。';
  }
  if (e instanceof Anthropic.PermissionDeniedError) {
    return 'このAPIキーではこの操作が許可されていません。APIキーの権限を確認してください。';
  }
  if (e instanceof Anthropic.RateLimitError) {
    return 'APIのレート制限に達しました。しばらく待ってから再実行してください。';
  }
  if (e instanceof Anthropic.BadRequestError) {
    return `リクエストが不正です: ${e.message}`;
  }
  if (e instanceof Anthropic.NotFoundError) {
    return '指定されたモデルが見つかりません。拡張機能の更新が必要な可能性があります。';
  }
  if (e instanceof Anthropic.InternalServerError) {
    return 'Claude API 側でエラーが発生しました。しばらく待ってから再実行してください。';
  }
  if (e instanceof Anthropic.APIConnectionTimeoutError) {
    return 'Claude API への接続がタイムアウトしました。通信環境を確認して再実行してください。';
  }
  if (e instanceof Anthropic.APIConnectionError) {
    return 'Claude API に接続できませんでした。通信環境を確認して再実行してください。';
  }
  if (e instanceof Anthropic.APIError) {
    return `Claude API エラー (${e.status ?? '不明'}): ${e.message}`;
  }
  if (e instanceof Error) {
    return `予期せぬエラーが発生しました: ${e.message}`;
  }
  return `予期せぬエラーが発生しました: ${String(e)}`;
}
