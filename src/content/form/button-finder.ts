/**
 * ラクマ出品フォーム（React/Chakra UI製）のボタンをテキストで特定するユーティリティ。
 * css-* クラスはビルドごとに変わるハッシュのため、セレクタには使わない。
 */

import { waitFor } from './wait';

export interface FindButtonOptions {
  /**
   * button[type="submit"] を優先する（確認モーダルの「出品する」用）。
   *
   * NOTE: 実機では type="submit" だったが、必須条件にはしない。
   *       ラクマ側の変更で type が変わっただけで全商品が失敗するのを避けるため。
   */
  preferSubmit?: boolean;
}

/**
 * 要素が画面に描画されているか。
 *
 * NOTE: Chakra UIのモーダルは position:fixed のことがあり offsetParent が
 *       null になるため、getClientRects() で判定する。
 */
function isRendered(el: HTMLElement): boolean {
  return el.getClientRects().length > 0;
}

/**
 * ページ内のbutton要素をテキスト完全一致で探す。
 * 描画済みのものを優先し、preferSubmit 指定時はさらに type="submit" を優先する。
 */
export function findButtonByText(
  text: string,
  options: FindButtonOptions = {}
): HTMLButtonElement | null {
  const matched = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).filter(
    (btn) => btn.textContent?.trim() === text
  );
  if (matched.length === 0) return null;

  const rendered = matched.filter(isRendered);
  const candidates = rendered.length > 0 ? rendered : matched;

  if (options.preferSubmit) {
    const submit = candidates.find((btn) => btn.type === 'submit');
    if (submit) return submit;
  }
  return candidates[0];
}

/**
 * 現在表示されているボタンのラベル一覧。失敗時の手がかりとして使う。
 */
export function listRenderedButtonLabels(): string[] {
  const labels = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
    .filter(isRendered)
    .map((btn) => btn.textContent?.trim() ?? '')
    .filter((label) => label.length > 0 && label.length <= 24);
  return Array.from(new Set(labels));
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
