/**
 * 注入 UI のスタイルシートを 1 度だけ `<style>` として差し込む（両拡張で共通の骨格）。
 *
 * UI 部品を作る関数がそれぞれ呼ぶ（呼ばれる順序に依存しないため）。2 回目以降は何もしない。
 * CSS の中身・`<style>` の id・注入後に行う処理（配色設定への追従など）は拡張ごとに違うので、
 * 呼び出し側から受け取る。
 */

export interface StyleSheetSpec {
  /** `<style>` 要素の id。これが document にあれば注入済みとみなす */
  id: string;
  /** CSS 本文。関数を渡すと、注入するときに 1 度だけ呼ばれる */
  css: string | (() => string);
  /** 注入した直後に 1 度だけ呼ぶ処理 */
  afterInject?: () => void;
}

export function ensureStyleSheet(spec: StyleSheetSpec): void {
  if (document.getElementById(spec.id)) return;

  const style = document.createElement('style');
  style.id = spec.id;
  style.textContent = typeof spec.css === 'function' ? spec.css() : spec.css;
  (document.head ?? document.documentElement).appendChild(style);

  spec.afterInject?.();
}
