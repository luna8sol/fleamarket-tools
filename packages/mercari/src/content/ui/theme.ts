import { CONFIG, ID_NAME } from '../infra/constants';
import { ensureStyleSheet } from '@fleamarket/core/style';
import { buildTokenCss, TokenMap } from '@fleamarket/core/theme-tokens';

/**
 * メルカリのページへ注入する UI のデザインシステム（トークンと部品のスタイル）。
 *
 * - **ライト / ダークは `prefers-color-scheme` で切り替える。** メルカリ本体も同じメディア
 *   クエリで配色を切り替えている（2026-10-02 実測: ダーク時の背景 `#222`）。同じ条件に
 *   そろえておけば、ページと拡張機能の UI の明暗が食い違わない。
 * - **ブランドの赤は装飾にだけ使う。** メルカリの `#FF333F`（ダーク時 `#DA3E50`）は白文字を
 *   載せるとコントラスト比が 4.5:1 に届かない（3.62 / 4.39）。文字を載せる塗りには
 *   一段濃い `--mdp-accent` を使う。
 * - クラス名はすべて `mdp-` で始める。メルカリ側のクラス名と衝突させないため。
 * - popup / options page は拡張機能のページなので、同じトークンを
 *   [extension-pages.css](../../../extension-pages.css) に持っている。値を変えるときは両方そろえる。
 * - トークンの CSS（`:root` とダークのメディアクエリ）の組み立ては共有部品
 *   `@fleamarket/core/theme-tokens`。名前と値はここで決める。
 */
const LIGHT_TOKENS: TokenMap = {
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

const DARK_TOKENS: TokenMap = {
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

/** 部品のスタイル（トークンの CSS 変数だけを使う。直書きしない） */
const COMPONENT_CSS = `
/* ---------- 共通 ---------- */
.mdp-scope, .mdp-scope *, .mdp-scope *::before, .mdp-scope *::after { box-sizing: border-box; }
.mdp-scope {
  font-family: var(--mdp-font);
  color: var(--mdp-text);
  font-size: 13px;
  line-height: 1.5;
  letter-spacing: 0.01em;
  -webkit-font-smoothing: antialiased;
}
.mdp-icon { flex: none; display: block; }
.mdp-num { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }
.mdp-visually-hidden {
  position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
.mdp-icon-tile {
  flex: none; display: inline-grid; place-items: center;
  width: 34px; height: 34px; border-radius: 10px; color: #fff;
  background: radial-gradient(120% 120% at 20% 0%, #ff6a73 0%, var(--mdp-brand) 45%, #c4101f 100%);
  box-shadow: 0 6px 16px -6px var(--mdp-ring), inset 0 1px 0 rgba(255, 255, 255, 0.35);
}
.mdp-icon-tile--sm { width: 26px; height: 26px; border-radius: 8px; }

/* ---------- ボタン ---------- */
button.mdp-btn {
  all: unset;
  box-sizing: border-box;
  position: relative;
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  height: 36px; padding: 0 14px;
  border-radius: 10px;
  font-family: var(--mdp-font); font-size: 13px; font-weight: 700; line-height: 1;
  letter-spacing: 0.02em; white-space: nowrap;
  cursor: pointer; user-select: none;
  transition: background-color 160ms var(--mdp-ease-out), color 160ms var(--mdp-ease-out),
    box-shadow 160ms var(--mdp-ease-out), transform 160ms var(--mdp-ease-out), opacity 160ms;
}
button.mdp-btn:focus-visible { outline: 2px solid var(--mdp-ring); outline-offset: 2px; }
button.mdp-btn:active:not(:disabled) { transform: scale(0.97); }
button.mdp-btn:disabled { cursor: not-allowed; opacity: 0.45; }
button.mdp-btn--sm { height: 30px; padding: 0 11px; font-size: 12px; border-radius: 8px; gap: 6px; }

button.mdp-btn--primary {
  color: var(--mdp-on-accent);
  background: var(--mdp-accent);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.22) inset, 0 6px 16px -8px var(--mdp-ring);
}
button.mdp-btn--primary:hover:not(:disabled) {
  background: var(--mdp-accent-hover);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.22) inset, 0 10px 22px -8px var(--mdp-ring);
}
button.mdp-btn--secondary {
  color: var(--mdp-text);
  background: var(--mdp-surface);
  box-shadow: inset 0 0 0 1px var(--mdp-border-strong), var(--mdp-shadow-sm);
}
button.mdp-btn--secondary:hover:not(:disabled) { background: var(--mdp-surface-sunken); }
button.mdp-btn--ghost { color: var(--mdp-text-muted); background: transparent; }
button.mdp-btn--ghost:hover:not(:disabled) { color: var(--mdp-text); background: var(--mdp-surface-hover); }
button.mdp-btn--danger {
  color: var(--mdp-danger);
  background: transparent;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--mdp-danger) 45%, transparent);
}
button.mdp-btn--danger:hover:not(:disabled) { background: var(--mdp-danger-soft); }
button.mdp-btn--danger-solid {
  color: #fff;
  background: var(--mdp-danger);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.2) inset, 0 6px 16px -8px color-mix(in srgb, var(--mdp-danger) 70%, transparent);
}
button.mdp-btn--danger-solid:hover:not(:disabled) { background: var(--mdp-danger-hover); }
@media (prefers-color-scheme: dark) {
  button.mdp-btn--danger-solid { color: #1a0a0a; }
}
button.mdp-btn--icon { width: 32px; height: 32px; padding: 0; border-radius: 9px; }
button.mdp-btn[aria-disabled="true"] { opacity: 0.55; }

/* 処理中（data-busy）はアイコンをスピナーに差し替える */
button.mdp-btn[data-busy="true"] { cursor: progress; }
button.mdp-btn[data-busy="true"] .mdp-icon { opacity: 0; }
button.mdp-btn[data-busy="true"]::before {
  content: ""; position: absolute; left: 14px; width: 14px; height: 14px; border-radius: 50%;
  border: 2px solid currentColor; border-right-color: transparent;
  animation: mdp-spin 700ms linear infinite;
}
button.mdp-btn--sm[data-busy="true"]::before { left: 11px; width: 12px; height: 12px; }
.mdp-spinner {
  flex: none; width: 14px; height: 14px; border-radius: 50%;
  border: 2px solid currentColor; border-right-color: transparent;
  animation: mdp-spin 700ms linear infinite;
}

/* ---------- 一括操作ドック（画面下の浮遊バー） ---------- */
.mdp-dock {
  position: fixed; left: 50%; bottom: 20px; z-index: ${CONFIG.ZINDEX.CONTROL_PANEL};
  display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px;
  width: max-content; max-width: calc(100vw - 32px);
  padding: 10px 10px 10px 12px;
  background: var(--mdp-glass);
  -webkit-backdrop-filter: saturate(180%) blur(22px);
  backdrop-filter: saturate(180%) blur(22px);
  border-radius: var(--mdp-radius-lg);
  box-shadow: var(--mdp-shadow-lg), inset 0 0 0 1px var(--mdp-border), var(--mdp-highlight);
  transform: translateX(-50%);
  animation: mdp-dock-in 520ms var(--mdp-ease-out) both;
}
.mdp-dock__lead { display: flex; align-items: center; gap: 12px; padding-right: 4px; }
.mdp-dock__stats { display: grid; gap: 1px; min-width: 92px; }
.mdp-dock__count { display: flex; align-items: baseline; gap: 4px; color: var(--mdp-text); }
.mdp-dock__count-num {
  display: inline-block; font-size: 22px; font-weight: 800; line-height: 1; letter-spacing: -0.02em;
  transition: color 200ms;
}
.mdp-dock__count-num[data-bump="true"] { animation: mdp-bump 360ms var(--mdp-ease-spring); }
.mdp-dock__count-unit { font-size: 12px; font-weight: 700; color: var(--mdp-text-muted); }
.mdp-dock__meta { font-size: 11px; color: var(--mdp-text-subtle); white-space: nowrap; }
.mdp-dock[data-empty="true"] .mdp-dock__count-num { color: var(--mdp-text-subtle); }
.mdp-dock__divider { align-self: stretch; width: 1px; margin: 4px 0; background: var(--mdp-border); }
.mdp-dock__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.mdp-dock[data-empty="true"] .mdp-dock__actions button.mdp-btn--primary:not(:disabled),
.mdp-dock[data-empty="true"] .mdp-dock__actions button.mdp-btn--danger:not(:disabled) { opacity: 0.55; }

/* 進捗（処理中だけ表示。ドックの 2 段目に全幅で出す） */
.mdp-progress {
  flex: 1 0 100%;
  display: grid; gap: 7px;
  padding: 10px 12px 11px;
  border-radius: 12px;
  background: var(--mdp-surface-sunken);
  box-shadow: inset 0 0 0 1px var(--mdp-border);
  animation: mdp-fade-up 320ms var(--mdp-ease-out) both;
}
.mdp-progress__head { display: flex; align-items: center; gap: 8px; min-width: 0; font-weight: 700; color: var(--mdp-text); }
.mdp-progress__label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mdp-progress__pct { color: var(--mdp-text-muted); font-size: 12px; }
.mdp-progress__track {
  position: relative; height: 6px; border-radius: 999px; overflow: hidden;
  background: color-mix(in srgb, var(--mdp-text) 10%, transparent);
}
.mdp-progress__bar {
  position: absolute; inset: 0 auto 0 0; width: 0%; border-radius: inherit;
  background: linear-gradient(90deg, var(--mdp-brand), #ff7a59);
  transition: width 600ms var(--mdp-ease-out);
}
.mdp-progress__bar::after {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.55), transparent);
  transform: translateX(-100%);
  animation: mdp-shimmer 1.6s ease-in-out infinite;
}
.mdp-progress[data-indeterminate="true"] .mdp-progress__bar {
  width: 32% !important; animation: mdp-indeterminate 1.3s var(--mdp-ease-out) infinite;
}
.mdp-progress[data-tone="success"] .mdp-progress__bar { background: var(--mdp-success); }
.mdp-progress[data-tone="warning"] .mdp-progress__bar { background: var(--mdp-warning); }
.mdp-progress[data-tone="danger"] .mdp-progress__bar { background: var(--mdp-danger); }
.mdp-progress:not([data-tone="active"]) .mdp-progress__bar::after { display: none; }
.mdp-progress__head .mdp-icon { color: var(--mdp-text-subtle); }
.mdp-progress[data-tone="success"] .mdp-progress__head .mdp-icon { color: var(--mdp-success); }
.mdp-progress[data-tone="warning"] .mdp-progress__head .mdp-icon { color: var(--mdp-warning); }
.mdp-progress[data-tone="danger"] .mdp-progress__head .mdp-icon { color: var(--mdp-danger); }
.mdp-progress__head .mdp-spinner { color: var(--mdp-accent-text); }

/* ---------- 一覧の各行 ---------- */
/* 行の左に余白を取り、そこへチェックボックス列を重ねる（ui/row-gutter.ts） */
li.mdp-row { position: relative; padding-left: var(--mdp-gutter); --mdp-gutter: 52px; }
li.mdp-row[data-mdp-gutter="wide"] { --mdp-gutter: 92px; }
.mdp-row-gutter {
  position: absolute; top: 0; bottom: 0; left: 0; z-index: 1;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  width: var(--mdp-gutter);
  cursor: default;
}
.mdp-row-gutter input.bulk-checkbox,
.mdp-row-gutter .bulk-order-span,
.mdp-row-gutter button.bulk-select-up-to-btn { margin: 0; }
/* 出品順は出ていないときも場所を空けておく（出た瞬間にチェックボックスが動かないように） */
.mdp-row-gutter .bulk-order-span:empty { display: inline-grid; visibility: hidden; animation: none; }

input.bulk-checkbox {
  -webkit-appearance: none; appearance: none;
  flex: none; display: inline-grid; place-content: center;
  width: 20px; height: 20px; margin: 0 8px 0 0; vertical-align: middle;
  border-radius: 6px; cursor: pointer;
  background: var(--mdp-surface);
  box-shadow: inset 0 0 0 1.5px var(--mdp-border-strong), var(--mdp-shadow-sm);
  transition: background-color 160ms var(--mdp-ease-out), box-shadow 160ms var(--mdp-ease-out), transform 160ms var(--mdp-ease-out);
}
input.bulk-checkbox::before {
  content: ""; width: 12px; height: 12px;
  background: #fff;
  clip-path: polygon(14% 52%, 0 66%, 38% 100%, 100% 22%, 86% 8%, 37% 70%);
  transform: scale(0); transition: transform 200ms var(--mdp-ease-spring);
}
input.bulk-checkbox:hover { box-shadow: inset 0 0 0 1.5px var(--mdp-accent-text), var(--mdp-shadow-sm); }
input.bulk-checkbox:checked {
  background: var(--mdp-accent);
  box-shadow: 0 0 0 3px var(--mdp-accent-soft), 0 4px 10px -4px var(--mdp-ring);
}
input.bulk-checkbox:checked::before { transform: scale(1); }
input.bulk-checkbox:focus-visible { outline: 2px solid var(--mdp-ring); outline-offset: 2px; }

li.selected-item {
  background-color: var(--mdp-row-selected);
  box-shadow: inset 3px 0 0 var(--mdp-brand);
  transition: background-color 200ms var(--mdp-ease-out);
}

.bulk-order-span {
  display: inline-grid; place-items: center;
  flex: none; width: max-content; max-width: 100%;
  min-width: 22px; height: 22px; margin-right: 6px; padding: 0 6px;
  border-radius: 999px; vertical-align: middle;
  font-family: var(--mdp-font); font-size: 11px; font-weight: 800; line-height: 1;
  font-variant-numeric: tabular-nums;
  color: var(--mdp-on-accent); background: var(--mdp-accent);
  box-shadow: 0 3px 8px -3px var(--mdp-ring);
  animation: mdp-pop 280ms var(--mdp-ease-spring);
}
.bulk-order-span:empty { display: none; }

button.bulk-select-up-to-btn {
  all: unset; box-sizing: border-box;
  position: relative; z-index: 99999; pointer-events: auto;
  display: inline-flex; align-items: center; gap: 4px; flex: none; width: max-content;
  height: 22px; margin-right: 8px; padding: 0 8px 0 6px; vertical-align: middle;
  border-radius: 999px; cursor: pointer; white-space: nowrap;
  font-family: var(--mdp-font); font-size: 11px; font-weight: 700; line-height: 1;
  color: var(--mdp-accent-text);
  background: var(--mdp-surface);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--mdp-accent-text) 40%, transparent);
  transition: background-color 160ms, box-shadow 160ms, transform 160ms;
}
button.bulk-select-up-to-btn:hover { background: var(--mdp-accent-soft); }
button.bulk-select-up-to-btn:active { transform: scale(0.95); }
button.bulk-select-up-to-btn:focus-visible { outline: 2px solid var(--mdp-ring); outline-offset: 2px; }

a.ai-description-link {
  display: inline-flex; align-items: center; gap: 5px; flex: none; width: max-content; max-width: 100%;
  margin-top: 6px; padding: 4px 10px 4px 8px;
  border-radius: 999px; text-decoration: none;
  font-family: var(--mdp-font); font-size: 11px; font-weight: 700; line-height: 1.2;
  color: var(--mdp-accent-text);
  background: var(--mdp-accent-soft);
  transition: background-color 160ms, transform 160ms;
}
a.ai-description-link:hover { background: var(--mdp-accent-soft-strong); text-decoration: none; }
a.ai-description-link:focus-visible { outline: 2px solid var(--mdp-ring); outline-offset: 2px; }

/* ---------- フィルターバー ---------- */
.mdp-filterbar {
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
  margin: 12px 0; padding: 8px 10px 8px 14px;
  border-radius: 14px;
  background: var(--mdp-surface);
  box-shadow: inset 0 0 0 1px var(--mdp-border), var(--mdp-shadow-sm);
}
.mdp-filterbar__label { margin-right: 4px; font-size: 12px; font-weight: 700; color: var(--mdp-text-muted); }
button.mdp-chip {
  all: unset; box-sizing: border-box;
  display: inline-flex; align-items: center; gap: 6px;
  height: 30px; padding: 0 12px 0 10px; border-radius: 999px; cursor: pointer;
  font-family: var(--mdp-font); font-size: 12px; font-weight: 700; line-height: 1;
  color: var(--mdp-text-muted);
  background: var(--mdp-surface-sunken);
  box-shadow: inset 0 0 0 1px var(--mdp-border);
  transition: background-color 180ms var(--mdp-ease-out), color 180ms, box-shadow 180ms, transform 160ms;
}
button.mdp-chip:hover { color: var(--mdp-text); background: var(--mdp-surface-active); }
button.mdp-chip:active { transform: scale(0.96); }
button.mdp-chip:focus-visible { outline: 2px solid var(--mdp-ring); outline-offset: 2px; }
button.mdp-chip[aria-pressed="true"] {
  color: var(--mdp-on-accent); background: var(--mdp-accent);
  box-shadow: 0 6px 14px -8px var(--mdp-ring);
}
button.mdp-chip[aria-pressed="true"] .mdp-icon path { fill: currentColor; }

/* ---------- トースト ---------- */
.mdp-toast {
  position: fixed; left: 50%; bottom: 24px; z-index: ${CONFIG.ZINDEX.TOAST};
  display: flex; align-items: flex-start; gap: 10px;
  width: max-content; max-width: min(520px, calc(100vw - 32px));
  padding: 12px 10px 12px 14px;
  border-radius: 14px;
  background: var(--mdp-glass);
  -webkit-backdrop-filter: saturate(180%) blur(22px);
  backdrop-filter: saturate(180%) blur(22px);
  box-shadow: var(--mdp-shadow-lg), inset 0 0 0 1px var(--mdp-border), var(--mdp-highlight);
  font-family: var(--mdp-font); font-size: 13px; font-weight: 600; line-height: 1.55; color: var(--mdp-text);
  white-space: pre-line;
  transform: translateX(-50%);
  animation: mdp-toast-in 420ms var(--mdp-ease-out) both;
}
body:has(.mdp-dock) .mdp-toast { bottom: var(--mdp-dock-offset, 112px); }
body:has(.mdp-alert) .mdp-toast { bottom: 112px; }
.mdp-toast[data-tone="error"] {
  box-shadow: var(--mdp-shadow-lg), inset 0 0 0 1px color-mix(in srgb, var(--mdp-danger) 45%, transparent), var(--mdp-highlight);
}
.mdp-toast[data-tone="warning"] {
  box-shadow: var(--mdp-shadow-lg), inset 0 0 0 1px color-mix(in srgb, var(--mdp-warning) 45%, transparent), var(--mdp-highlight);
}
.mdp-toast[data-leaving="true"] { animation: mdp-toast-out 220ms ease-in both; }
.mdp-toast__icon { margin-top: 1px; }
.mdp-toast[data-tone="success"] .mdp-toast__icon { color: var(--mdp-success); }
.mdp-toast[data-tone="error"] .mdp-toast__icon { color: var(--mdp-danger); }
.mdp-toast[data-tone="warning"] .mdp-toast__icon { color: var(--mdp-warning); }
.mdp-toast[data-tone="info"] .mdp-toast__icon { color: var(--mdp-info); }
.mdp-toast__body { flex: 1; min-width: 0; padding-top: 0; }
.mdp-toast button.mdp-btn--icon { width: 24px; height: 24px; margin: -1px 0 0 4px; border-radius: 7px; }

/* ---------- 確認ダイアログ ---------- */
dialog.mdp-dialog {
  width: min(480px, calc(100vw - 32px)); max-height: min(640px, calc(100vh - 48px));
  margin: auto; padding: 0; border: none; border-radius: 22px; overflow: hidden;
  color: var(--mdp-text); background: var(--mdp-surface);
  box-shadow: var(--mdp-shadow-lg), inset 0 0 0 1px var(--mdp-border);
}
dialog.mdp-dialog[open] { display: flex; flex-direction: column; animation: mdp-dialog-in 360ms var(--mdp-ease-out) both; }
dialog.mdp-dialog::backdrop {
  background: rgba(10, 10, 14, 0.45);
  -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
  animation: mdp-fade 240ms ease-out both;
}
.mdp-dialog__head { display: flex; gap: 14px; padding: 22px 22px 0; }
.mdp-dialog__badge {
  flex: none; display: grid; place-items: center; width: 40px; height: 40px; border-radius: 12px;
  color: var(--mdp-accent-text); background: var(--mdp-accent-soft);
}
.mdp-dialog[data-tone="danger"] .mdp-dialog__badge { color: var(--mdp-danger); background: var(--mdp-danger-soft); }
.mdp-dialog__title { margin: 0; font-size: 17px; font-weight: 800; line-height: 1.4; letter-spacing: 0; color: var(--mdp-text); }
.mdp-dialog__message { margin: 4px 0 0; font-size: 13px; line-height: 1.65; color: var(--mdp-text-muted); white-space: pre-line; }
.mdp-dialog__body {
  display: grid; gap: 12px; padding: 16px 22px 4px; overflow: auto;
  scrollbar-width: thin; scrollbar-color: var(--mdp-border-strong) transparent;
}
.mdp-dialog__facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(88px, 1fr)); gap: 8px; }
.mdp-fact {
  display: grid; gap: 2px; padding: 10px 12px; border-radius: 12px;
  background: var(--mdp-surface-sunken); box-shadow: inset 0 0 0 1px var(--mdp-border);
}
.mdp-fact__value { font-size: 18px; font-weight: 800; line-height: 1.2; color: var(--mdp-text); }
.mdp-fact__label { font-size: 11px; font-weight: 600; color: var(--mdp-text-subtle); }
.mdp-fact[data-emphasis="true"] { background: var(--mdp-accent-soft); box-shadow: inset 0 0 0 1px var(--mdp-ring); }
.mdp-fact[data-emphasis="true"] .mdp-fact__value { color: var(--mdp-accent-text); }
.mdp-dialog__list {
  margin: 0; padding: 6px; list-style: none; counter-reset: mdp-item;
  border-radius: 12px; background: var(--mdp-surface-sunken); box-shadow: inset 0 0 0 1px var(--mdp-border);
}
.mdp-dialog__list li {
  counter-increment: mdp-item;
  display: flex; align-items: baseline; gap: 10px; padding: 7px 8px; border-radius: 8px;
  font-size: 13px; line-height: 1.45; color: var(--mdp-text);
}
.mdp-dialog__list li + li { box-shadow: 0 -1px 0 var(--mdp-border); }
.mdp-dialog__list li::before {
  content: counter(mdp-item);
  flex: none; min-width: 20px; font-size: 11px; font-weight: 800; text-align: right;
  font-variant-numeric: tabular-nums; color: var(--mdp-text-subtle);
}
.mdp-dialog__list li.mdp-dialog__more { color: var(--mdp-text-subtle); }
.mdp-dialog__list li.mdp-dialog__more::before { content: "…"; }
.mdp-dialog__note {
  display: flex; gap: 8px; padding: 10px 12px; border-radius: 12px;
  font-size: 12px; line-height: 1.6; color: var(--mdp-warning); background: var(--mdp-warning-soft);
}
.mdp-dialog[data-tone="danger"] .mdp-dialog__note { color: var(--mdp-danger); background: var(--mdp-danger-soft); }
.mdp-dialog__note .mdp-icon { margin-top: 2px; }
.mdp-dialog__foot {
  display: flex; justify-content: flex-end; gap: 8px; padding: 16px 22px 20px;
}

/* ---------- 浮遊パネル（説明文の一括置換など） ---------- */
.mdp-panel {
  position: fixed; right: 20px; bottom: var(--mdp-dock-offset, 112px); z-index: ${CONFIG.ZINDEX.CONTROL_PANEL};
  display: flex; flex-direction: column;
  width: 420px; max-width: calc(100vw - 32px); max-height: calc(100vh - var(--mdp-dock-offset, 112px) - 24px);
  border-radius: 22px; overflow: hidden;
  background: var(--mdp-surface);
  box-shadow: var(--mdp-shadow-lg), inset 0 0 0 1px var(--mdp-border);
  animation: mdp-panel-in 420ms var(--mdp-ease-out) both;
}
.mdp-panel__head { display: flex; align-items: center; gap: 12px; padding: 16px 14px 14px 18px; border-bottom: 1px solid var(--mdp-border); }
.mdp-panel__titles { flex: 1; min-width: 0; }
.mdp-panel__title { margin: 0; font-size: 15px; font-weight: 800; line-height: 1.3; color: var(--mdp-text); }
.mdp-panel__subtitle { margin: 2px 0 0; font-size: 12px; color: var(--mdp-text-subtle); }
.mdp-panel__body {
  display: grid; gap: 18px; padding: 18px; overflow: auto; overscroll-behavior: contain;
  scrollbar-width: thin; scrollbar-color: var(--mdp-border-strong) transparent;
}
.mdp-section { display: grid; gap: 10px; }
.mdp-section__title {
  display: flex; align-items: center; gap: 8px; margin: 0;
  font-size: 12px; font-weight: 800; letter-spacing: 0.04em; color: var(--mdp-text-muted);
}
.mdp-step {
  display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 999px;
  font-size: 11px; font-weight: 800; color: var(--mdp-accent-text); background: var(--mdp-accent-soft);
}
.mdp-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

label.mdp-file {
  position: relative; display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 10px;
  min-width: 0; padding: 10px 12px; border-radius: 12px; cursor: pointer;
  background: var(--mdp-surface-sunken);
  box-shadow: inset 0 0 0 1px var(--mdp-border);
  transition: box-shadow 160ms, background-color 160ms;
}
label.mdp-file:hover { box-shadow: inset 0 0 0 1px var(--mdp-border-strong); }
label.mdp-file:focus-within { box-shadow: inset 0 0 0 1px var(--mdp-accent-text), 0 0 0 3px var(--mdp-accent-soft); }
label.mdp-file .mdp-icon { color: var(--mdp-text-subtle); }
label.mdp-file[data-filled="true"] { background: var(--mdp-accent-soft); box-shadow: inset 0 0 0 1px var(--mdp-ring); }
label.mdp-file[data-filled="true"] .mdp-icon { color: var(--mdp-accent-text); }
label.mdp-file[data-disabled="true"] { cursor: not-allowed; opacity: 0.55; }
.mdp-file__text { display: grid; min-width: 0; }
.mdp-file__label { font-size: 12px; font-weight: 800; color: var(--mdp-text); }
.mdp-file__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; color: var(--mdp-text-subtle); }
label.mdp-file input[type="file"] { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: inherit; }

.mdp-inline-field { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.mdp-inline-field__label { font-size: 12px; font-weight: 700; color: var(--mdp-text); }
.mdp-inline-field__hint { font-size: 11px; color: var(--mdp-text-subtle); }
.mdp-number {
  display: inline-flex; align-items: center; gap: 4px; padding: 0 10px 0 4px; height: 34px; border-radius: 10px;
  background: var(--mdp-surface-sunken); box-shadow: inset 0 0 0 1px var(--mdp-border);
  font-size: 12px; color: var(--mdp-text-muted);
}
.mdp-number:focus-within { box-shadow: inset 0 0 0 1px var(--mdp-accent-text), 0 0 0 3px var(--mdp-accent-soft); }
.mdp-number input {
  all: unset; box-sizing: border-box; width: 52px; height: 100%; padding: 0 6px; text-align: right;
  font-family: var(--mdp-font); font-size: 14px; font-weight: 800; color: var(--mdp-text);
  font-variant-numeric: tabular-nums;
}
.mdp-number input:disabled { opacity: 0.5; }

.mdp-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.mdp-stats .mdp-fact { padding: 9px 10px; }
.mdp-stats .mdp-fact__value { font-size: 17px; }
.mdp-empty {
  display: flex; align-items: center; gap: 10px; padding: 14px; border-radius: 12px;
  font-size: 12px; line-height: 1.6; color: var(--mdp-text-subtle);
  background: var(--mdp-surface-sunken); box-shadow: inset 0 0 0 1px var(--mdp-border);
  border: 1px dashed transparent;
}
.mdp-exclusions {
  display: grid; gap: 4px; margin: 0; padding: 10px 12px; list-style: none; border-radius: 12px;
  background: var(--mdp-danger-soft);
}
.mdp-exclusions__head { font-size: 11px; font-weight: 800; color: var(--mdp-danger); }
.mdp-exclusions li { font-size: 11px; line-height: 1.5; color: var(--mdp-text-muted); overflow-wrap: anywhere; }
.mdp-exclusions code { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 10.5px; color: var(--mdp-text); }

.mdp-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.mdp-actions .mdp-spacer { flex: 1; }

.mdp-run { display: grid; gap: 8px; }
.mdp-run:empty { display: none; }
.mdp-run .mdp-progress { flex: none; }
.mdp-badges { display: flex; flex-wrap: wrap; gap: 6px; }
.mdp-badge {
  display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 9px; border-radius: 999px;
  font-size: 11px; font-weight: 700; color: var(--mdp-text-muted); background: var(--mdp-surface-sunken);
  box-shadow: inset 0 0 0 1px var(--mdp-border);
}
.mdp-badge b { font-weight: 800; color: var(--mdp-text); font-variant-numeric: tabular-nums; }
.mdp-badge::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--mdp-text-subtle); }
.mdp-badge[data-tone="success"]::before { background: var(--mdp-success); }
.mdp-badge[data-tone="info"]::before { background: var(--mdp-info); }
.mdp-badge[data-tone="warning"]::before { background: var(--mdp-warning); }
.mdp-badge[data-tone="danger"]::before { background: var(--mdp-danger); }
.mdp-badge[data-tone="danger"][data-nonzero="true"] { color: var(--mdp-danger); background: var(--mdp-danger-soft); }
.mdp-badge[data-tone="warning"][data-nonzero="true"] { color: var(--mdp-warning); background: var(--mdp-warning-soft); }

/* ---------- お知らせカード（リスト読み込み失敗など） ---------- */
.mdp-alert {
  position: fixed; left: 50%; bottom: 20px; z-index: ${CONFIG.ZINDEX.CONTROL_PANEL};
  display: flex; align-items: center; gap: 14px;
  width: max-content; max-width: min(520px, calc(100vw - 32px));
  padding: 14px 14px 14px 16px; border-radius: var(--mdp-radius-lg);
  background: var(--mdp-glass);
  -webkit-backdrop-filter: saturate(180%) blur(22px); backdrop-filter: saturate(180%) blur(22px);
  box-shadow: var(--mdp-shadow-lg), inset 0 0 0 1px var(--mdp-border), var(--mdp-highlight);
  transform: translateX(-50%);
  animation: mdp-dock-in 520ms var(--mdp-ease-out) both;
}
.mdp-alert__icon {
  flex: none; display: grid; place-items: center; width: 36px; height: 36px; border-radius: 11px;
  color: var(--mdp-warning); background: var(--mdp-warning-soft);
}
.mdp-alert__text { flex: 1; min-width: 0; }
.mdp-alert__title { font-size: 13px; font-weight: 800; color: var(--mdp-text); }
.mdp-alert__hint { margin-top: 2px; font-size: 12px; line-height: 1.55; color: var(--mdp-text-muted); }

/* ---------- AI 説明文アシスタント（出品フォーム内） ---------- */
.mdp-ai {
  position: relative; display: grid; gap: 12px;
  margin: 12px 0 20px; padding: 16px; border-radius: 16px;
  background:
    radial-gradient(120% 140% at 0% 0%, var(--mdp-accent-soft) 0%, transparent 55%),
    var(--mdp-surface);
  box-shadow: inset 0 0 0 1px var(--mdp-border), var(--mdp-shadow-sm);
}
.mdp-ai__head { display: flex; align-items: center; gap: 12px; }
.mdp-ai__titles { flex: 1; min-width: 0; }
.mdp-ai__title { margin: 0; font-size: 14px; font-weight: 800; color: var(--mdp-text); }
.mdp-ai__caption { margin: 2px 0 0; font-size: 12px; line-height: 1.5; color: var(--mdp-text-subtle); }
.mdp-ai__status { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 12px; font-weight: 600; line-height: 1.5; color: var(--mdp-text-muted); }
.mdp-ai__status[data-tone="error"] { color: var(--mdp-danger); }
.mdp-ai__status[data-tone="loading"] { color: var(--mdp-accent-text); }
.mdp-ai__result { display: grid; gap: 10px; animation: mdp-fade-up 320ms var(--mdp-ease-out) both; }
.mdp-ai__result[hidden] { display: none; }
.mdp-ai textarea.mdp-textarea {
  all: unset; box-sizing: border-box; display: block; width: 100%; min-height: 220px; padding: 12px 14px;
  border-radius: 12px; resize: vertical; white-space: pre-wrap;
  font-family: var(--mdp-font); font-size: 14px; line-height: 1.75; color: var(--mdp-text);
  background: var(--mdp-surface-sunken); box-shadow: inset 0 0 0 1px var(--mdp-border);
  scrollbar-width: thin; scrollbar-color: var(--mdp-border-strong) transparent;
  transition: box-shadow 160ms;
}
.mdp-ai textarea.mdp-textarea:focus { box-shadow: inset 0 0 0 1px var(--mdp-accent-text), 0 0 0 3px var(--mdp-accent-soft); }
.mdp-ai__foot { display: flex; align-items: center; gap: 8px; }
.mdp-ai__count { margin-left: auto; font-size: 11px; font-weight: 700; color: var(--mdp-text-subtle); }
.mdp-ai__count[data-over="true"] { color: var(--mdp-danger); }
.mdp-ai[data-loading="true"]::after {
  content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; padding: 1px;
  background: conic-gradient(from var(--mdp-angle, 0deg), transparent 0 70%, var(--mdp-brand) 85%, transparent 100%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude;
  animation: mdp-orbit 2.2s linear infinite;
}

/* ---------- 狭い画面 ---------- */
@media (max-width: 560px) {
  .mdp-dock, .mdp-alert {
    left: 8px; right: 8px; bottom: 8px; width: auto; max-width: none; transform: none;
    animation-name: mdp-fade-up;
  }
  .mdp-dock__divider { display: none; }
  /* ボタンは折り返さず横スクロールの 1 列にする（縦に積むと一覧を覆ってしまう） */
  .mdp-dock__actions {
    flex: 1 0 100%; flex-wrap: nowrap; overflow-x: auto; margin: 0 -2px; padding: 2px;
    scrollbar-width: none;
  }
  .mdp-dock__actions::-webkit-scrollbar { display: none; }
  .mdp-panel { left: 8px; right: 8px; width: auto; max-width: none; }
  .mdp-stats { grid-template-columns: repeat(2, 1fr); }
  .mdp-field-row { grid-template-columns: 1fr; }
}

/* ---------- アニメーション ---------- */
@property --mdp-angle { syntax: "<angle>"; inherits: false; initial-value: 0deg; }
@keyframes mdp-spin { to { transform: rotate(360deg); } }
@keyframes mdp-orbit { to { --mdp-angle: 360deg; } }
@keyframes mdp-fade { from { opacity: 0; } }
@keyframes mdp-fade-up { from { opacity: 0; transform: translateY(6px); } }
@keyframes mdp-dock-in { from { opacity: 0; transform: translate(-50%, 24px) scale(0.98); } }
@keyframes mdp-toast-in { from { opacity: 0; transform: translate(-50%, 14px) scale(0.97); } }
@keyframes mdp-toast-out { to { opacity: 0; transform: translate(-50%, 8px) scale(0.98); } }
@keyframes mdp-dialog-in { from { opacity: 0; transform: translateY(12px) scale(0.97); } }
@keyframes mdp-panel-in { from { opacity: 0; transform: translateY(16px) scale(0.98); } }
@keyframes mdp-bump { 40% { transform: translateY(-3px) scale(1.12); } }
@keyframes mdp-pop { from { transform: scale(0.4); opacity: 0; } }
@keyframes mdp-shimmer { 60%, 100% { transform: translateX(100%); } }
@keyframes mdp-indeterminate { from { transform: translateX(-110%); } to { transform: translateX(320%); } }

@media (prefers-reduced-motion: reduce) {
  .mdp-scope, .mdp-scope *, .bulk-order-span, input.bulk-checkbox, input.bulk-checkbox::before,
  dialog.mdp-dialog, dialog.mdp-dialog::backdrop {
    animation-duration: 1ms !important; animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
  }
  button.mdp-btn[data-busy="true"]::before, .mdp-spinner { animation: mdp-spin 1.6s linear infinite !important; }
}

@media (forced-colors: active) {
  .mdp-dock, .mdp-toast, .mdp-panel, .mdp-alert, dialog.mdp-dialog, .mdp-ai, .mdp-filterbar { border: 1px solid CanvasText; }
  button.mdp-btn, button.mdp-chip, button.bulk-select-up-to-btn { border: 1px solid ButtonText; }
  input.bulk-checkbox { border: 1px solid CanvasText; }
  input.bulk-checkbox:checked::before { background: CanvasText; }
}
`;

/** 注入する CSS 全体（トークン + 部品） */
const THEME_CSS = `${buildTokenCss({ light: LIGHT_TOKENS, dark: DARK_TOKENS })}\n${COMPONENT_CSS}`;

/**
 * テーマのスタイルシートを 1 度だけ注入する
 *
 * UI 部品を作る関数がそれぞれ呼ぶ（呼ばれる順序に依存しないため）。2 回目以降は何もしない。
 * 注入の仕組みは共有部品 `@fleamarket/core/style`。CSS 本文と `<style>` の id はここで決める。
 */
export function ensureTheme(): void {
  ensureStyleSheet({ id: ID_NAME.THEME_STYLE, css: THEME_CSS });
}
