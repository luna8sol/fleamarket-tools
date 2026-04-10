import { error } from './logger';
import { showToast } from '../ui/notification';

/**
 * グローバルエラーハンドラの定義。
 *
 * - 予期しない例外発生時の通知・ログ出力を担います。
 * - UI/ロジックのエントリポイントでラップして使うことで、クラッシュを防ぎます。
 *
 * @param main メイン処理（例外安全化したい関数）
 * @example
 *   withGlobalErrorHandler(() => { ... });
 */
export function withGlobalErrorHandler(main: () => void): void {
  try {
    main();
  } catch (e) {
    const err = e as Error;
    const msg = '[Mercari Draft Publisher] 予期せぬエラーが発生しました: ' + (err && err.message ? err.message : String(err));
    console.error(msg, err);
    alert('拡張機能で予期せぬエラーが発生しました。ページを再読み込みしてください。\n' + (err && err.message ? err.message : String(err)));
  }
}

/**
 * エラータイプ定義
 */
export enum ErrorType {
  NETWORK = 'network',
  DOM = 'dom',
  UI = 'ui',
  LOGIC = 'logic',
  UNKNOWN = 'unknown',
}

/**
 * エラー情報インターフェース
 */
interface ErrorInfo {
  type: ErrorType;
  message: string;
  originalError?: Error | unknown;
  showToUser?: boolean;
}

/**
 * アプリケーションエラークラス
 */
export class AppError extends Error {
  type: ErrorType;
  originalError?: Error | unknown;
  showToUser: boolean;

  constructor(info: ErrorInfo) {
    super(info.message);
    this.name = 'AppError';
    this.type = info.type;
    this.originalError = info.originalError;
    this.showToUser = info.showToUser ?? false;
  }
}

/**
 * エラーハンドラー
 * @param err エラーまたはエラー情報
 */
export function handleError(err: Error | unknown | ErrorInfo): void {
  let appError: AppError;

  // エラー情報の正規化
  if (err instanceof AppError) {
    appError = err;
  } else if (typeof err === 'object' && err !== null && 'type' in err && 'message' in err) {
    appError = new AppError(err as ErrorInfo);
  } else {
    // 未知のエラーをラップ
    const errorMessage = err instanceof Error ? err.message : '不明なエラーが発生しました';
    appError = new AppError({
      type: ErrorType.UNKNOWN,
      message: errorMessage,
      originalError: err,
    });
  }

  // エラーをログ出力
  error(appError.message, {
    type: appError.type,
    stack: appError.stack,
    originalError: appError.originalError,
  });

  // ユーザー向けにエラーを表示
  if (appError.showToUser) {
    showToast(appError.message, 'error');
  }
}

/**
 * DOM要素が見つからないエラーを生成
 * @param selector 見つからなかったセレクタ
 * @param showToUser ユーザーに表示するか
 * @returns AppErrorインスタンス
 */
export function createElementNotFoundError(
  selector: string,
  showToUser: boolean = false
): AppError {
  return new AppError({
    type: ErrorType.DOM,
    message: `要素が見つかりません: ${selector}`,
    showToUser,
  });
}

/**
 * ネットワークエラーを生成
 * @param message エラーメッセージ
 * @param originalError 元のエラー
 * @returns AppErrorインスタンス
 */
export function createNetworkError(
  message: string,
  originalError?: Error | unknown
): AppError {
  return new AppError({
    type: ErrorType.NETWORK,
    message,
    originalError,
    showToUser: true,
  });
}
