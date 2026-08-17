/**
 * ログ出力・警告出力を担うシンプルなラッパーモジュール。
 *
 * - デバッグ・エラー調査用途で利用します。
 * - すべてのログに拡張機能名のプレフィックスが自動付与されます。
 * - どのレイヤーからもimportして利用可能です。
 * - レベル制御の骨格は共有部品 `@fleamarket/core/logger`。接頭辞・時刻・`[LOG]` などの
 *   タグの付け方（出力形式）はこの拡張固有のものなので、このファイルで決める。
 *
 * @example
 *   log('初期化完了', obj);
 *   warn('異常値検出', value);
 */
import { createLogger, LogLevelName } from '@fleamarket/core/logger';

const LOG_PREFIX = '[Mercari Draft Publisher]';

/**
 * ログレベル定義
 */
export enum LogLevel {
  DEBUG = 0,
  LOG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
}

const LEVEL_NAME: Record<LogLevel, LogLevelName> = {
  [LogLevel.DEBUG]: 'debug',
  [LogLevel.LOG]: 'log',
  [LogLevel.INFO]: 'info',
  [LogLevel.WARN]: 'warn',
  [LogLevel.ERROR]: 'error',
};

const LEVEL_TAG: Record<LogLevelName, string> = {
  debug: '[DEBUG]',
  log: '[LOG]',
  info: '[INFO]',
  warn: '[WARN]',
  error: '[ERROR]',
};

/**
 * タイムスタンプ付きメッセージを取得
 * @param message ログメッセージ
 * @returns タイムスタンプ付きメッセージ
 */
function getTimestampedMessage(message: string): string {
  const now = new Date();
  // 標準のDateTimeFormatOptionsを使用
  const timeStr = now.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // ミリ秒を手動で追加
  const ms = now.getMilliseconds().toString().padStart(3, '0');
  const timestamp = `${timeStr}.${ms}`;

  return `${LOG_PREFIX} [${timestamp}] ${message}`;
}

// 現在のログレベルは共有部品側が持つ（既定は LOG）
const logger = createLogger({
  format: (level, [message, ...optionalParams]) => [
    getTimestampedMessage(`${LEVEL_TAG[level]} ${message}`),
    ...optionalParams,
  ],
});

/**
 * ログレベルを設定
 * @param level 設定するログレベル
 */
export function setLogLevel(level: LogLevel): void {
  logger.setLevel(LEVEL_NAME[level]);
}

/**
 * デバッグモードに基づいてログレベルを設定
 * @param isDebugMode デバッグモードかどうか
 */
export function setDebugMode(isDebugMode: boolean): void {
  logger.setLevel(isDebugMode ? 'debug' : 'log');
  if (isDebugMode) {
    debug('デバッグモードが有効になりました');
  } else {
    log('通常モードに戻りました');
  }
}

/**
 * 現在のデバッグモードステータスを取得
 * @returns デバッグモードが有効かどうか
 */
export function isDebugModeEnabled(): boolean {
  return logger.isEnabled('debug');
}

/**
 * デバッグログ出力
 * @param message ログメッセージ
 * @param optionalParams 追加パラメータ
 */
export function debug(message: string, ...optionalParams: unknown[]): void {
  logger.emit('debug', [message, ...optionalParams]);
}

/**
 * 通常ログ出力
 * @param message ログメッセージ
 * @param optionalParams 追加パラメータ
 */
export function log(message: string, ...optionalParams: unknown[]): void {
  logger.emit('log', [message, ...optionalParams]);
}

/**
 * 警告ログ出力
 * @param message ログメッセージ
 * @param optionalParams 追加パラメータ
 */
export function warn(message: string, ...optionalParams: unknown[]): void {
  logger.emit('warn', [message, ...optionalParams]);
}

/**
 * エラーログ出力
 * @param message ログメッセージ
 * @param optionalParams 追加パラメータ
 */
export function error(message: string, ...optionalParams: unknown[]): void {
  logger.emit('error', [message, ...optionalParams]);
}

/**
 * メソッドの開始をログに記録
 * @param methodName メソッド名
 * @param params オプションのパラメータ
 */
export function debugMethodStart(methodName: string, params?: Record<string, unknown>): void {
  if (logger.isEnabled('debug')) {
    if (params) {
      debug(`[開始] ${methodName}`, params);
    } else {
      debug(`[開始] ${methodName}`);
    }
  }
}

/**
 * メソッドの終了をログに記録
 * @param methodName メソッド名
 * @param result オプションの結果データ
 * @param durationMs 実行時間（ミリ秒）
 */
export function debugMethodEnd(
  methodName: string,
  result?: Record<string, unknown>,
  durationMs?: number
): void {
  if (logger.isEnabled('debug')) {
    const message = durationMs
      ? `[終了] ${methodName} (所要時間: ${durationMs}ms)`
      : `[終了] ${methodName}`;

    if (result) {
      debug(message, result);
    } else {
      debug(message);
    }
  }
}
