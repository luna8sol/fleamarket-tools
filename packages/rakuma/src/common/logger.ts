/**
 * ログ出力のシンプルなラッパー。
 * すべてのログに拡張機能名のプレフィックスを付与する。
 *
 * レベル制御の骨格は共有部品 `@fleamarket/core/logger`。接頭辞を別引数で渡す出力形式と、
 * debug を console.log で出す点はこの拡張固有のものなので、このファイルで決める。
 */
import { createLogger } from '@fleamarket/core/logger';

const PREFIX = '[RakumaBulkLister]';

const logger = createLogger({
  format: (_level, args) => [PREFIX, ...args],
  consoleMethod: { debug: 'log' },
});

export function setDebugMode(enabled: boolean): void {
  logger.setLevel(enabled ? 'debug' : 'log');
}

export function debug(...args: unknown[]): void {
  logger.emit('debug', args);
}

export function log(...args: unknown[]): void {
  logger.emit('log', args);
}

export function warn(...args: unknown[]): void {
  logger.emit('warn', args);
}
