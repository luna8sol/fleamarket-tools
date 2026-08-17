/**
 * ログ出力のシンプルなラッパー。
 * すべてのログに拡張機能名のプレフィックスを付与する。
 */

const PREFIX = '[RakumaBulkLister]';

let debugMode = false;

export function setDebugMode(enabled: boolean): void {
  debugMode = enabled;
}

export function debug(...args: unknown[]): void {
  if (debugMode) {
    console.log(PREFIX, ...args);
  }
}

export function log(...args: unknown[]): void {
  console.log(PREFIX, ...args);
}

export function warn(...args: unknown[]): void {
  console.warn(PREFIX, ...args);
}
