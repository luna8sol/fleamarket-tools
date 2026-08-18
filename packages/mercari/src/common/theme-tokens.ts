import { buildTokenCss, TokenMap } from '@fleamarket/core/theme-tokens';

/**
 * デザイントークン（CSS 変数）の正本。
 *
 * メルカリのページへ注入する UI（src/content/ui/theme.ts）と、拡張機能のページ
 * （popup.html / options.html）の両方がここから CSS を組み立てる。**値を 2 か所に持たない**
 * （以前は extension-pages.css に写しを持っていて、フォントと `--mdp-info-soft` がずれていた）。
 *
 * - **ライト / ダークは `prefers-color-scheme` で切り替える。** メルカリ本体も同じメディア
 *   クエリで配色を切り替えている（2026-10-02 実測: ダーク時の背景 `#222`）。
 * - **ブランドの赤は装飾にだけ使う。** メルカリの `#FF333F`（ダーク時 `#DA3E50`）は白文字を
 *   載せるとコントラスト比が 4.5:1 に届かない（3.62 / 4.39）。文字を載せる塗りには
 *   一段濃い `--mdp-accent` を使う。
 * - `:root` とダークのメディアクエリへの組み立ては共有部品 `@fleamarket/core/theme-tokens`。
 *   名前と値はここで決める。
 */
export const LIGHT_TOKENS: TokenMap = {
  '--mdp-font':
    '"Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Noto Sans JP", Meiryo, sans-serif',
  '--mdp-brand': '#ff333f',
  '--mdp-accent': '#e3192a',
  '--mdp-accent-hover': '#c9101f',
  '--mdp-accent-text': '#d0182a',
  '--mdp-accent-soft': 'rgba(255, 51, 63, 0.09)',
  '--mdp-accent-soft-strong': 'rgba(255, 51, 63, 0.16)',
  '--mdp-row-selected': 'rgba(255, 51, 63, 0.05)',
  '--mdp-on-accent': '#ffffff',
  '--mdp-ring': 'rgba(255, 51, 63, 0.42)',

  '--mdp-glass': 'rgba(255, 255, 255, 0.82)',
  '--mdp-surface': '#ffffff',
  '--mdp-surface-sunken': '#f4f4f6',
  '--mdp-surface-hover': 'rgba(17, 17, 26, 0.05)',
  '--mdp-surface-active': 'rgba(17, 17, 26, 0.09)',
  '--mdp-border': 'rgba(17, 17, 26, 0.10)',
  '--mdp-border-strong': 'rgba(17, 17, 26, 0.20)',
  '--mdp-text': '#18181b',
  '--mdp-text-muted': '#52525b',
  '--mdp-text-subtle': '#6b6b74',

  '--mdp-success': '#0f7b4b',
  '--mdp-success-soft': 'rgba(18, 183, 106, 0.12)',
  '--mdp-warning': '#a15c07',
  '--mdp-warning-soft': 'rgba(247, 144, 9, 0.14)',
  '--mdp-danger': '#c81e1e',
  '--mdp-danger-hover': '#a91616',
  '--mdp-danger-soft': 'rgba(217, 45, 32, 0.09)',
  '--mdp-info': '#1d5fd1',
  '--mdp-info-soft': 'rgba(46, 144, 250, 0.12)',

  '--mdp-shadow-sm': '0 1px 2px rgba(16, 16, 24, 0.06), 0 1px 1px rgba(16, 16, 24, 0.04)',
  '--mdp-shadow-lg':
    '0 1px 1px rgba(16, 16, 24, 0.04), 0 8px 20px -6px rgba(16, 16, 24, 0.14), 0 28px 56px -16px rgba(16, 16, 24, 0.22)',
  '--mdp-highlight': 'inset 0 1px 0 rgba(255, 255, 255, 0.7)',

  '--mdp-radius-sm': '8px',
  '--mdp-radius-md': '12px',
  '--mdp-radius-lg': '20px',
  '--mdp-ease-out': 'cubic-bezier(0.22, 1, 0.36, 1)',
  '--mdp-ease-spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
};

export const DARK_TOKENS: TokenMap = {
  '--mdp-brand': '#da3e50',
  '--mdp-accent': '#cc2e44',
  '--mdp-accent-hover': '#dd4459',
  '--mdp-accent-text': '#ff7a85',
  '--mdp-accent-soft': 'rgba(255, 92, 108, 0.12)',
  '--mdp-accent-soft-strong': 'rgba(255, 92, 108, 0.20)',
  '--mdp-row-selected': 'rgba(255, 92, 108, 0.08)',
  '--mdp-ring': 'rgba(255, 110, 124, 0.55)',

  '--mdp-glass': 'rgba(34, 34, 38, 0.80)',
  '--mdp-surface': '#1e1e22',
  '--mdp-surface-sunken': '#151518',
  '--mdp-surface-hover': 'rgba(255, 255, 255, 0.06)',
  '--mdp-surface-active': 'rgba(255, 255, 255, 0.10)',
  '--mdp-border': 'rgba(255, 255, 255, 0.10)',
  '--mdp-border-strong': 'rgba(255, 255, 255, 0.20)',
  '--mdp-text': '#f4f4f5',
  '--mdp-text-muted': '#b4b4bd',
  '--mdp-text-subtle': '#8e8e98',

  '--mdp-success': '#5bd69a',
  '--mdp-success-soft': 'rgba(91, 214, 154, 0.14)',
  '--mdp-warning': '#f5b544',
  '--mdp-warning-soft': 'rgba(245, 181, 68, 0.14)',
  '--mdp-danger': '#ff6b6b',
  '--mdp-danger-hover': '#ff8a8a',
  '--mdp-danger-soft': 'rgba(255, 107, 107, 0.12)',
  '--mdp-info': '#7aa7ff',
  '--mdp-info-soft': 'rgba(122, 167, 255, 0.14)',

  '--mdp-shadow-sm': '0 1px 2px rgba(0, 0, 0, 0.4)',
  '--mdp-shadow-lg':
    '0 0 0 1px rgba(255, 255, 255, 0.06), 0 12px 28px -8px rgba(0, 0, 0, 0.55), 0 32px 64px -20px rgba(0, 0, 0, 0.7)',
  '--mdp-highlight': 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
};

/**
 * 拡張機能のページ（popup / options）だけが使う値と、ページ側で上書きする値。
 *
 * - フォントは OS の書体に寄せる。注入 UI はメルカリのページに溶け込むよう、ページと同じ
 *   Helvetica / Arial 先頭の書体にしているので、ここだけ違えてある。
 * - `--mdp-page` はページ全体の背景。注入 UI には無い。
 */
const PAGE_LIGHT_TOKENS: TokenMap = {
  '--mdp-font':
    '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic UI", "Segoe UI", Meiryo, system-ui, sans-serif',
  '--mdp-mono': 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  '--mdp-page': '#f6f6f8',
  '--mdp-shadow-md': '0 1px 2px rgba(16, 16, 24, 0.05), 0 6px 20px -8px rgba(16, 16, 24, 0.14)',
};

const PAGE_DARK_TOKENS: TokenMap = {
  '--mdp-page': '#161619',
  '--mdp-shadow-md': '0 0 0 1px rgba(255, 255, 255, 0.04), 0 10px 28px -12px rgba(0, 0, 0, 0.7)',
};

/**
 * 拡張機能のページに入れるトークンの CSS（`:root` とダークのメディアクエリ）。
 *
 * popup / options は head で同期的に読み込むスクリプトからこれを `<style>` として差し込み、
 * 描画前にトークンをそろえる（後から入れると開いた瞬間に既定の配色で一瞬光る）。
 */
export function buildExtensionPageTokenCss(): string {
  return buildTokenCss({
    light: { ...LIGHT_TOKENS, ...PAGE_LIGHT_TOKENS },
    dark: { ...DARK_TOKENS, ...PAGE_DARK_TOKENS },
  });
}
