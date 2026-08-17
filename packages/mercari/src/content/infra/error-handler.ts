import { error } from './logger';
import { showToast } from '../ui/notification';

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

