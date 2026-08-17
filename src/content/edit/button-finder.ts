/**
 * ラクマ編集ページ（React/Chakra UI製）のボタンをテキストで特定するユーティリティ。
 * css-* クラスはビルドごとに変わるハッシュのため、セレクタには使わない。
 */

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
  const intervalMs = options.intervalMs ?? 500;

  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    const tryFind = (): void => {
      const btn = findButtonByText(text, options);
      if (btn) {
        resolve(btn);
        return;
      }
      if (Date.now() - startedAt >= options.timeoutMs) {
        reject(new Error(`ボタン「${text}」が${options.timeoutMs}ms以内に見つかりませんでした`));
        return;
      }
      window.setTimeout(tryFind, intervalMs);
    };

    tryFind();
  });
}
