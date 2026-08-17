/**
 * ラクマ出品フォーム（React/Chakra UI製）のボタンをテキストで特定するユーティリティ。
 * css-* クラスはビルドごとに変わるハッシュのため、セレクタには使わない。
 */

import { waitFor } from './wait';

export interface FindButtonOptions {
  /** button[type="submit"] のみを対象にする（確認モーダルの「出品する」用） */
  submitOnly?: boolean;
}

/**
 * ページ内のbutton要素をテキスト完全一致で探す
 */
export function findButtonByText(
  text: string,
  options: FindButtonOptions = {}
): HTMLButtonElement | null {
  const selector = options.submitOnly ? 'button[type="submit"]' : 'button';
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(selector));
  return buttons.find((btn) => btn.textContent?.trim() === text) ?? null;
}

export interface WaitForButtonOptions extends FindButtonOptions {
  /** 最大待機時間 (ms) */
  timeoutMs: number;
  /** ポーリング間隔 (ms) */
  intervalMs?: number;
}

/**
 * 指定テキストのボタンが出現するまでポーリングで待機する。
 * タイムアウトした場合はrejectする。
 */
export function waitForButton(
  text: string,
  options: WaitForButtonOptions
): Promise<HTMLButtonElement> {
  return waitFor(() => findButtonByText(text, options), {
    timeoutMs: options.timeoutMs,
    intervalMs: options.intervalMs,
    label: `ボタン「${text}」`,
  });
}
