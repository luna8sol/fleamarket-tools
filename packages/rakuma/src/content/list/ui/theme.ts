import { buildTokenCss, syncThemePreference } from '../../../common/theme';
import { CONFIG, ID_NAME } from '../infra/constants';
import { ensureStyleSheet } from '@fleamarket/core/style';

/**
 * 一覧ページへ注入する UI のスタイル。
 *
 * - 色・影などの値は src/common/theme.ts のトークン（CSS 変数）だけを使う。直書きしない。
 * - **ラクマ本体はダークモードに対応していない。** 浮遊する UI だけが配色の設定に従い、
 *   商品行に差し込む部品は `--rbl-page-*`（常にライト）で描く。
 * - クラス名はすべて `rbl-` で始める。ラクマ側のクラス名と衝突させないため。
 * - ボタンには `all: unset` を当ててから組む。ラクマ側のグローバル CSS
 *   （`button { ... }` など）の影響を受けないようにするため。
 */
const COMPONENT_CSS = `
/* ---------- 共通 ---------- */
.rbl-scope, .rbl-scope *, .rbl-scope *::before, .rbl-scope *::after { box-sizing: border-box; }
.rbl-scope {
  font-family: var(--rbl-font);
  color: var(--rbl-text);
  font-size: 13px;
  line-height: 1.5;
  letter-spacing: 0.01em;
  text-align: left;
  -webkit-font-smoothing: antialiased;
}
.rbl-scope[hidden], .rbl-scope [hidden] { display: none !important; }
.rbl-scope h2, .rbl-scope h3, .rbl-scope p, .rbl-scope ol, .rbl-scope ul { margin: 0; padding: 0; }
.rbl-icon { flex: none; display: block; }
.rbl-num { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }

/* ブランドの印（ドック・パネル・ダイアログの先頭） */
.rbl-mark {
  flex: none; display: inline-grid; place-items: center;
  width: 36px; height: 36px; border-radius: 11px; color: #fff;
  background:
    radial-gradient(120% 120% at 18% 0%, rgba(255, 255, 255, 0.35) 0%, transparent 42%),
    linear-gradient(140deg, var(--rbl-brand-2) 0%, var(--rbl-brand) 48%, #b00000 100%);
  box-shadow: 0 8px 18px -8px var(--rbl-ring), inset 0 1px 0 rgba(255, 255, 255, 0.35), inset 0 -1px 0 rgba(0, 0, 0, 0.12);
}
.rbl-mark--sm { width: 28px; height: 28px; border-radius: 9px; }

/* ---------- ボタン ---------- */
button.rbl-btn {
  all: unset;
  box-sizing: border-box;
  position: relative;
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  height: 38px; padding: 0 15px;
  border-radius: 11px;
  font-family: var(--rbl-font); font-size: 13px; font-weight: 700; line-height: 1;
  letter-spacing: 0.02em; white-space: nowrap;
  cursor: pointer; user-select: none;
  transition: background-color 160ms var(--rbl-ease-out), color 160ms var(--rbl-ease-out),
    box-shadow 160ms var(--rbl-ease-out), transform 160ms var(--rbl-ease-out), opacity 160ms;
}
button.rbl-btn:focus-visible { outline: 2px solid var(--rbl-ring); outline-offset: 2px; }
button.rbl-btn:active:not(:disabled) { transform: scale(0.97); }
button.rbl-btn:disabled { cursor: not-allowed; opacity: 0.42; }
button.rbl-btn[aria-disabled="true"] { opacity: 0.5; }
button.rbl-btn--sm { height: 30px; padding: 0 11px; font-size: 12px; border-radius: 9px; gap: 6px; }

button.rbl-btn--primary {
  color: var(--rbl-on-accent);
  background: var(--rbl-accent);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22), 0 6px 16px -8px var(--rbl-ring);
}
button.rbl-btn--primary:hover:not(:disabled) {
  background: var(--rbl-accent-hover);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22), 0 10px 22px -8px var(--rbl-ring);
}
button.rbl-btn--secondary {
  color: var(--rbl-text);
  background: var(--rbl-surface);
  box-shadow: inset 0 0 0 1px var(--rbl-border-strong), var(--rbl-shadow-sm);
}
button.rbl-btn--secondary:hover:not(:disabled) { background: var(--rbl-surface-sunken); }
button.rbl-btn--ghost { color: var(--rbl-text-muted); background: transparent; }
button.rbl-btn--ghost:hover:not(:disabled) { color: var(--rbl-text); background: var(--rbl-surface-hover); }
button.rbl-btn--danger {
  color: var(--rbl-danger);
  background: transparent;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--rbl-danger) 45%, transparent);
}
button.rbl-btn--danger:hover:not(:disabled) { background: var(--rbl-danger-soft); }
button.rbl-btn--danger-solid {
  color: var(--rbl-on-danger);
  background: var(--rbl-danger);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 6px 16px -8px color-mix(in srgb, var(--rbl-danger) 70%, transparent);
}
button.rbl-btn--danger-solid:hover:not(:disabled) { background: var(--rbl-danger-hover); }
button.rbl-btn--icon { width: 32px; height: 32px; padding: 0; border-radius: 9px; }

.rbl-spinner {
  flex: none; width: 14px; height: 14px; border-radius: 50%;
  border: 2px solid currentColor; border-right-color: transparent;
  animation: rbl-spin 700ms linear infinite;
}

/* ---------- 一括操作ドック（画面下中央の浮遊バー） ---------- */
.rbl-dock {
  position: fixed; left: 50%; bottom: 20px; z-index: ${CONFIG.ZINDEX.DOCK};
  display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px;
  width: max-content; max-width: calc(100vw - 32px);
  padding: 10px 10px 10px 12px;
  background: var(--rbl-glass);
  -webkit-backdrop-filter: saturate(180%) blur(22px);
  backdrop-filter: saturate(180%) blur(22px);
  border-radius: 22px;
  box-shadow: var(--rbl-shadow-lg), inset 0 0 0 1px var(--rbl-border), var(--rbl-highlight);
  transform: translateX(-50%);
  animation: rbl-dock-in 560ms var(--rbl-ease-out) both;
}
.rbl-dock__lead { display: flex; align-items: center; gap: 12px; }
.rbl-dock__stats { display: grid; gap: 2px; min-width: 104px; }
.rbl-dock__count { display: flex; align-items: baseline; gap: 4px; }
.rbl-dock__count-num {
  display: inline-block; font-size: 24px; font-weight: 800; line-height: 1; letter-spacing: -0.03em;
  color: var(--rbl-text); transition: color 200ms;
}
.rbl-dock__count-num[data-bump="true"] { animation: rbl-bump 380ms var(--rbl-ease-spring); }
.rbl-dock__count-unit { font-size: 12px; font-weight: 700; color: var(--rbl-text-muted); }
.rbl-dock__meta { font-size: 11px; color: var(--rbl-text-subtle); white-space: nowrap; }
.rbl-dock[data-empty="true"] .rbl-dock__count-num { color: var(--rbl-text-subtle); }
.rbl-dock__divider { align-self: stretch; width: 1px; margin: 4px 0; background: var(--rbl-border); }
.rbl-dock__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
/* 未選択のときは押せるが、押しても何も始まらないことを薄さで伝える */
.rbl-dock[data-empty="true"] .rbl-dock__actions button.rbl-btn--primary,
.rbl-dock[data-empty="true"] .rbl-dock__actions button.rbl-btn--danger { opacity: 0.5; }
.rbl-dock[data-empty="true"] #${ID_NAME.BULK_CLEAR_BTN} { visibility: hidden; }

/* 進捗（ドックの 2 段目に全幅で出す） */
.rbl-progress {
  flex: 1 0 100%;
  /* 長い失敗理由などでドックの幅を押し広げない（幅はドックの他の行に合わせる） */
  contain: inline-size;
  display: grid; gap: 8px;
  padding: 11px 12px 12px;
  border-radius: 14px;
  background: var(--rbl-surface-sunken);
  box-shadow: inset 0 0 0 1px var(--rbl-border);
  animation: rbl-fade-up 320ms var(--rbl-ease-out) both;
}
.rbl-progress__head { display: flex; align-items: center; gap: 8px; min-width: 0; font-weight: 700; color: var(--rbl-text); }
.rbl-progress__label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rbl-progress__pct { color: var(--rbl-text-muted); font-size: 12px; font-weight: 700; }
.rbl-progress__detail {
  margin-top: -3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 11px; color: var(--rbl-text-subtle);
}
.rbl-progress__detail:empty { display: none; }
.rbl-progress__track {
  position: relative; height: 6px; border-radius: 999px; overflow: hidden;
  background: color-mix(in srgb, var(--rbl-text) 10%, transparent);
}
.rbl-progress__bar {
  position: absolute; inset: 0 auto 0 0; width: 0%; border-radius: inherit;
  background: linear-gradient(90deg, var(--rbl-brand), var(--rbl-brand-2));
  transition: width 700ms var(--rbl-ease-out);
}
.rbl-progress__bar::after {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.55), transparent);
  transform: translateX(-100%);
  animation: rbl-shimmer 1.6s ease-in-out infinite;
}
.rbl-progress[data-indeterminate="true"] .rbl-progress__bar {
  width: 32% !important; animation: rbl-indeterminate 1.3s var(--rbl-ease-out) infinite;
}
.rbl-progress[data-tone="success"] .rbl-progress__bar { background: var(--rbl-success); }
.rbl-progress[data-tone="warning"] .rbl-progress__bar { background: var(--rbl-warning); }
.rbl-progress[data-tone="danger"] .rbl-progress__bar { background: var(--rbl-danger); }
.rbl-progress:not([data-tone="active"]) .rbl-progress__bar::after { display: none; }
.rbl-progress__head .rbl-icon { color: var(--rbl-text-subtle); }
.rbl-progress[data-tone="success"] .rbl-progress__head > .rbl-icon { color: var(--rbl-success); }
.rbl-progress[data-tone="warning"] .rbl-progress__head > .rbl-icon { color: var(--rbl-warning); }
.rbl-progress[data-tone="danger"] .rbl-progress__head > .rbl-icon { color: var(--rbl-danger); }
.rbl-progress__head .rbl-spinner { color: var(--rbl-accent-text); }
.rbl-progress__head button.rbl-btn--icon { width: 24px; height: 24px; margin: -4px -4px -4px 0; border-radius: 7px; }

.rbl-failures { display: grid; gap: 4px; margin: 0; padding: 0; list-style: none; }
.rbl-failures:empty { display: none; }
.rbl-failures li {
  display: flex; gap: 6px; min-width: 0;
  font-size: 11px; line-height: 1.5; color: var(--rbl-text-muted);
}
.rbl-failures li::before {
  content: ""; flex: none; width: 5px; height: 5px; margin-top: 6px; border-radius: 50%; background: var(--rbl-danger);
}
.rbl-failures b { flex: none; max-width: 45%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; color: var(--rbl-text); }
.rbl-failures span { min-width: 0; overflow-wrap: anywhere; }
.rbl-failures li.rbl-failures__more { color: var(--rbl-text-subtle); }
.rbl-failures li.rbl-failures__more::before { background: var(--rbl-text-subtle); }

/* ドックがページの末尾（ページャなど）を覆わないための余白 */
#${ID_NAME.DOCK_SPACER} { height: 120px; }

/* ---------- 商品行に差し込む部品（ラクマの白い背景の上に載る。常にライト） ---------- */
.rbl-row { transition: background-color 200ms var(--rbl-ease-out), box-shadow 200ms var(--rbl-ease-out); }
.rbl-row.rbl-row--selected {
  background-image: linear-gradient(90deg, var(--rbl-page-soft) 0, transparent 55%);
  box-shadow: inset 3px 0 0 var(--rbl-page-brand);
}
label.rbl-pick {
  flex: none; align-self: stretch;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  min-width: 44px; margin: 0 6px 0 0; padding: 4px 6px;
  cursor: pointer; user-select: none;
  font-family: var(--rbl-font);
}
label.rbl-pick[data-disabled="true"] { cursor: not-allowed; }
input.rbl-bulk-checkbox {
  -webkit-appearance: none; appearance: none;
  flex: none; display: inline-grid; place-content: center;
  width: 22px; height: 22px; margin: 0;
  border: none; border-radius: 7px; cursor: inherit;
  background: var(--rbl-page-surface);
  box-shadow: inset 0 0 0 1.5px var(--rbl-page-border), 0 1px 2px rgba(16, 16, 24, 0.06);
  transition: background-color 160ms var(--rbl-ease-out), box-shadow 160ms var(--rbl-ease-out), transform 160ms var(--rbl-ease-out);
}
input.rbl-bulk-checkbox::before {
  content: ""; width: 12px; height: 12px;
  background: #fff;
  clip-path: polygon(14% 52%, 0 66%, 38% 100%, 100% 22%, 86% 8%, 37% 70%);
  transform: scale(0); transition: transform 220ms var(--rbl-ease-spring);
}
label.rbl-pick:hover input.rbl-bulk-checkbox:not(:disabled) { box-shadow: inset 0 0 0 1.5px var(--rbl-page-accent), 0 1px 2px rgba(16, 16, 24, 0.06); }
label.rbl-pick:active input.rbl-bulk-checkbox:not(:disabled) { transform: scale(0.92); }
input.rbl-bulk-checkbox:checked {
  background: var(--rbl-page-accent);
  box-shadow: 0 0 0 3px var(--rbl-page-soft), 0 4px 10px -4px var(--rbl-page-ring);
}
input.rbl-bulk-checkbox:checked::before { transform: scale(1); }
input.rbl-bulk-checkbox:focus-visible { outline: 2px solid var(--rbl-page-ring); outline-offset: 2px; }
input.rbl-bulk-checkbox:disabled { opacity: 0.45; }

/* 選択順。出ていないときも場所を空けておく（出た瞬間にチェックボックスが動かないように） */
.rbl-order {
  display: inline-grid; place-items: center;
  min-width: 22px; height: 18px; padding: 0 6px; border-radius: 999px;
  font-size: 10.5px; font-weight: 800; line-height: 1; letter-spacing: 0;
  font-variant-numeric: tabular-nums;
  color: var(--rbl-page-accent); background: var(--rbl-page-badge);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--rbl-page-accent) 30%, transparent);
  animation: rbl-pop 300ms var(--rbl-ease-spring);
}
.rbl-order:empty { visibility: hidden; animation: none; }

/* ---------- トースト ---------- */
.rbl-toast {
  position: fixed; left: 50%; bottom: var(--rbl-dock-clearance, 24px); z-index: ${CONFIG.ZINDEX.TOAST};
  display: flex; align-items: flex-start; gap: 10px;
  width: max-content; max-width: min(520px, calc(100vw - 32px));
  padding: 12px 10px 12px 14px;
  border-radius: 16px;
  background: var(--rbl-glass);
  -webkit-backdrop-filter: saturate(180%) blur(22px);
  backdrop-filter: saturate(180%) blur(22px);
  box-shadow: var(--rbl-shadow-lg), inset 0 0 0 1px var(--rbl-border), var(--rbl-highlight);
  font-size: 13px; font-weight: 600; line-height: 1.55;
  white-space: pre-line;
  transform: translateX(-50%);
  transition: bottom 320ms var(--rbl-ease-out);
  animation: rbl-toast-in 440ms var(--rbl-ease-out) both;
}
.rbl-toast[data-tone="error"] { box-shadow: var(--rbl-shadow-lg), inset 0 0 0 1px color-mix(in srgb, var(--rbl-danger) 45%, transparent), var(--rbl-highlight); }
.rbl-toast[data-tone="warning"] { box-shadow: var(--rbl-shadow-lg), inset 0 0 0 1px color-mix(in srgb, var(--rbl-warning) 45%, transparent), var(--rbl-highlight); }
.rbl-toast[data-leaving="true"] { animation: rbl-toast-out 220ms ease-in both; }
.rbl-toast__icon { margin-top: 1px; }
.rbl-toast[data-tone="success"] .rbl-toast__icon { color: var(--rbl-success); }
.rbl-toast[data-tone="error"] .rbl-toast__icon { color: var(--rbl-danger); }
.rbl-toast[data-tone="warning"] .rbl-toast__icon { color: var(--rbl-warning); }
.rbl-toast[data-tone="info"] .rbl-toast__icon { color: var(--rbl-info); }
.rbl-toast__body { flex: 1; min-width: 0; color: var(--rbl-text); }
.rbl-toast button.rbl-btn--icon { width: 24px; height: 24px; margin: -1px 0 0 4px; border-radius: 7px; }
/* 残り時間の細い線（ホバー中は止まる） */
.rbl-toast::after {
  content: ""; position: absolute; left: 14px; right: 14px; bottom: 0; height: 2px; border-radius: 2px;
  background: currentColor; opacity: 0.18; transform-origin: left;
  animation: rbl-toast-timer var(--rbl-toast-duration, 3000ms) linear both;
}
.rbl-toast[data-tone="success"]::after { color: var(--rbl-success); }
.rbl-toast[data-tone="error"]::after { color: var(--rbl-danger); }
.rbl-toast[data-tone="warning"]::after { color: var(--rbl-warning); }
.rbl-toast[data-tone="info"]::after { color: var(--rbl-info); }
.rbl-toast:hover::after { animation-play-state: paused; }

/* ---------- 確認ダイアログ ---------- */
dialog.rbl-dialog {
  width: min(500px, calc(100vw - 32px)); max-width: none; max-height: min(680px, calc(100vh - 48px));
  margin: auto; padding: 0; border: none; border-radius: 24px; overflow: hidden;
  color: var(--rbl-text); background: var(--rbl-surface);
  box-shadow: var(--rbl-shadow-lg), inset 0 0 0 1px var(--rbl-border);
}
dialog.rbl-dialog[open] { display: flex; flex-direction: column; animation: rbl-dialog-in 380ms var(--rbl-ease-out) both; }
dialog.rbl-dialog::backdrop {
  background: var(--rbl-backdrop);
  -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
  animation: rbl-fade 240ms ease-out both;
}
.rbl-dialog__head { display: flex; gap: 14px; padding: 24px 24px 0; }
.rbl-dialog__badge {
  flex: none; display: grid; place-items: center; width: 42px; height: 42px; border-radius: 13px;
  color: var(--rbl-accent-text); background: var(--rbl-accent-soft);
}
.rbl-dialog[data-tone="danger"] .rbl-dialog__badge { color: var(--rbl-danger); background: var(--rbl-danger-soft); }
.rbl-dialog__title { font-size: 17px; font-weight: 800; line-height: 1.4; letter-spacing: 0; color: var(--rbl-text); }
.rbl-dialog__message { margin-top: 4px !important; font-size: 13px; line-height: 1.65; color: var(--rbl-text-muted); white-space: pre-line; }
.rbl-dialog__body {
  display: grid; gap: 12px; padding: 18px 24px 4px; overflow: auto;
  scrollbar-width: thin; scrollbar-color: var(--rbl-border-strong) transparent;
}
.rbl-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 8px; }
.rbl-facts:has(> :nth-child(4)) .rbl-fact__value { font-size: 16px; }
.rbl-fact {
  display: grid; gap: 2px; padding: 10px 12px; border-radius: 13px;
  background: var(--rbl-surface-sunken); box-shadow: inset 0 0 0 1px var(--rbl-border);
}
.rbl-fact__value { font-size: 18px; font-weight: 800; line-height: 1.2; letter-spacing: -0.01em; white-space: nowrap; color: var(--rbl-text); }
.rbl-fact__label { font-size: 11px; font-weight: 600; color: var(--rbl-text-subtle); }
.rbl-fact[data-emphasis="true"] { background: var(--rbl-accent-soft); box-shadow: inset 0 0 0 1px var(--rbl-ring); }
.rbl-fact[data-emphasis="true"] .rbl-fact__value { color: var(--rbl-accent-text); }
.rbl-dialog[data-tone="danger"] .rbl-fact[data-emphasis="true"] { background: var(--rbl-danger-soft); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--rbl-danger) 45%, transparent); }
.rbl-dialog[data-tone="danger"] .rbl-fact[data-emphasis="true"] .rbl-fact__value { color: var(--rbl-danger); }
.rbl-dialog__list-head { font-size: 11px; font-weight: 800; letter-spacing: 0.04em; color: var(--rbl-text-subtle); }
.rbl-dialog__list {
  list-style: none; counter-reset: rbl-item; padding: 6px !important;
  border-radius: 13px; background: var(--rbl-surface-sunken); box-shadow: inset 0 0 0 1px var(--rbl-border);
}
.rbl-dialog__list li {
  counter-increment: rbl-item;
  display: flex; align-items: baseline; gap: 10px; padding: 8px 8px;
  font-size: 13px; line-height: 1.45; color: var(--rbl-text);
}
.rbl-dialog__list li + li { border-top: 1px solid var(--rbl-border); }
.rbl-dialog__list li::before {
  content: counter(rbl-item);
  flex: none; min-width: 20px; font-size: 11px; font-weight: 800; text-align: right;
  font-variant-numeric: tabular-nums; color: var(--rbl-text-subtle);
}
.rbl-dialog__list li.rbl-dialog__more { color: var(--rbl-text-subtle); }
.rbl-dialog__list li.rbl-dialog__more::before { content: "…"; }
.rbl-note {
  display: flex; gap: 8px; padding: 10px 12px; border-radius: 13px;
  font-size: 12px; line-height: 1.6; color: var(--rbl-warning); background: var(--rbl-warning-soft);
}
.rbl-dialog[data-tone="danger"] .rbl-note { color: var(--rbl-danger); background: var(--rbl-danger-soft); }
.rbl-note .rbl-icon { margin-top: 2px; }
.rbl-dialog__foot { display: flex; justify-content: flex-end; gap: 8px; padding: 18px 24px 22px; }

/* ---------- 浮遊パネル（説明文の一括置換） ---------- */
.rbl-panel {
  position: fixed; right: 20px; bottom: var(--rbl-dock-clearance, 120px); z-index: ${CONFIG.ZINDEX.PANEL};
  display: flex; flex-direction: column;
  width: 440px; max-width: calc(100vw - 32px);
  max-height: calc(100vh - var(--rbl-dock-clearance, 120px) - 24px);
  transition: bottom 320ms var(--rbl-ease-out);
  border-radius: 24px; overflow: hidden;
  background: var(--rbl-surface);
  box-shadow: var(--rbl-shadow-lg), inset 0 0 0 1px var(--rbl-border);
  animation: rbl-panel-in 440ms var(--rbl-ease-out) both;
}
.rbl-panel__head { display: flex; align-items: center; gap: 12px; padding: 16px 14px 14px 18px; border-bottom: 1px solid var(--rbl-border); }
.rbl-panel__titles { flex: 1; min-width: 0; }
.rbl-panel__title { font-size: 15px; font-weight: 800; line-height: 1.3; color: var(--rbl-text); }
.rbl-panel__subtitle { margin-top: 2px !important; font-size: 12px; color: var(--rbl-text-subtle); }
.rbl-panel__body {
  display: grid; gap: 20px; padding: 18px; overflow: auto; overscroll-behavior: contain;
  scrollbar-width: thin; scrollbar-color: var(--rbl-border-strong) transparent;
}
.rbl-section { display: grid; gap: 10px; }
.rbl-section__title {
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; font-weight: 800; letter-spacing: 0.04em; color: var(--rbl-text-muted);
}
.rbl-step {
  display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 999px;
  font-size: 11px; font-weight: 800; color: var(--rbl-accent-text); background: var(--rbl-accent-soft);
}
.rbl-section[data-done="true"] .rbl-step { color: var(--rbl-on-accent); background: var(--rbl-accent); }
.rbl-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

label.rbl-file {
  position: relative; display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 10px;
  min-width: 0; padding: 11px 12px; border-radius: 13px; cursor: pointer;
  background: var(--rbl-surface-sunken);
  box-shadow: inset 0 0 0 1px var(--rbl-border);
  transition: box-shadow 160ms, background-color 160ms;
}
label.rbl-file:hover { box-shadow: inset 0 0 0 1px var(--rbl-border-strong); }
label.rbl-file:focus-within { box-shadow: inset 0 0 0 1px var(--rbl-accent-text), 0 0 0 3px var(--rbl-accent-soft); }
label.rbl-file .rbl-icon { color: var(--rbl-text-subtle); }
label.rbl-file[data-filled="true"] { background: var(--rbl-accent-soft); box-shadow: inset 0 0 0 1px var(--rbl-ring); }
label.rbl-file[data-filled="true"] .rbl-icon { color: var(--rbl-accent-text); }
label.rbl-file[data-disabled="true"] { cursor: not-allowed; opacity: 0.55; }
.rbl-file__text { display: grid; min-width: 0; }
.rbl-file__label { font-size: 12px; font-weight: 800; color: var(--rbl-text); }
.rbl-file__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; color: var(--rbl-text-subtle); }
label.rbl-file input[type="file"] { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: inherit; }

.rbl-inline-field { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.rbl-inline-field__label { font-size: 12px; font-weight: 700; color: var(--rbl-text); }
.rbl-inline-field__hint { font-size: 11px; color: var(--rbl-text-subtle); }
.rbl-number {
  flex: none; display: inline-flex; align-items: center; gap: 4px; padding: 0 10px 0 4px; height: 36px; border-radius: 11px;
  background: var(--rbl-surface-sunken); box-shadow: inset 0 0 0 1px var(--rbl-border);
  font-size: 12px; color: var(--rbl-text-muted);
}
.rbl-number:focus-within { box-shadow: inset 0 0 0 1px var(--rbl-accent-text), 0 0 0 3px var(--rbl-accent-soft); }
.rbl-number input {
  all: unset; box-sizing: border-box; width: 56px; height: 100%; padding: 0 6px; text-align: right;
  font-family: var(--rbl-font); font-size: 14px; font-weight: 800; color: var(--rbl-text);
  font-variant-numeric: tabular-nums;
}
.rbl-number input:disabled { opacity: 0.5; }

.rbl-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.rbl-stats .rbl-fact { padding: 9px 10px; }
.rbl-stats .rbl-fact__value { font-size: 18px; }
.rbl-empty {
  display: flex; align-items: center; gap: 10px; padding: 14px; border-radius: 13px;
  font-size: 12px; line-height: 1.6; color: var(--rbl-text-subtle);
  background: var(--rbl-surface-sunken); box-shadow: inset 0 0 0 1px var(--rbl-border);
}
.rbl-exclusions {
  display: grid; gap: 4px; list-style: none; padding: 10px 12px !important; border-radius: 13px;
  background: var(--rbl-danger-soft);
}
.rbl-exclusions__head { font-size: 11px; font-weight: 800; color: var(--rbl-danger); }
.rbl-exclusions li { font-size: 11px; line-height: 1.5; color: var(--rbl-text-muted); overflow-wrap: anywhere; }
.rbl-exclusions code { font-family: var(--rbl-mono); font-size: 10.5px; color: var(--rbl-text); }

.rbl-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.rbl-actions .rbl-spacer { flex: 1; }

.rbl-run { display: grid; gap: 8px; }
.rbl-run .rbl-progress { flex: none; }
.rbl-badges { display: flex; flex-wrap: wrap; gap: 6px; }
.rbl-badges:empty { display: none; }
.rbl-badge {
  display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 9px; border-radius: 999px;
  font-size: 11px; font-weight: 700; color: var(--rbl-text-muted); background: var(--rbl-surface-sunken);
  box-shadow: inset 0 0 0 1px var(--rbl-border);
}
.rbl-badge b { font-weight: 800; color: var(--rbl-text); font-variant-numeric: tabular-nums; }
.rbl-badge::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--rbl-text-subtle); }
.rbl-badge[data-tone="success"]::before { background: var(--rbl-success); }
.rbl-badge[data-tone="info"]::before { background: var(--rbl-info); }
.rbl-badge[data-tone="warning"]::before { background: var(--rbl-warning); }
.rbl-badge[data-tone="danger"]::before { background: var(--rbl-danger); }
.rbl-badge[data-tone="danger"][data-nonzero="true"] { color: var(--rbl-danger); background: var(--rbl-danger-soft); }
.rbl-badge[data-tone="warning"][data-nonzero="true"] { color: var(--rbl-warning); background: var(--rbl-warning-soft); }

/* ---------- 狭い画面 ---------- */
@media (max-width: 640px) {
  .rbl-dock {
    left: 8px; right: 8px; bottom: 8px; width: auto; max-width: none; transform: none;
    animation-name: rbl-fade-up;
  }
  .rbl-dock__divider { display: none; }
  /* ボタンは折り返さず横スクロールの 1 列にする（縦に積むと一覧を覆ってしまう） */
  .rbl-dock__actions {
    flex: 1 0 100%; flex-wrap: nowrap; overflow-x: auto; margin: 0 -2px; padding: 2px;
    scrollbar-width: none;
  }
  .rbl-dock__actions::-webkit-scrollbar { display: none; }
  .rbl-panel { left: 8px; right: 8px; width: auto; max-width: none; }
  .rbl-stats { grid-template-columns: repeat(2, 1fr); }
  .rbl-field-row { grid-template-columns: 1fr; }
}

/* ---------- アニメーション ---------- */
@keyframes rbl-spin { to { transform: rotate(360deg); } }
@keyframes rbl-fade { from { opacity: 0; } }
@keyframes rbl-fade-up { from { opacity: 0; transform: translateY(6px); } }
@keyframes rbl-dock-in { from { opacity: 0; transform: translate(-50%, 28px) scale(0.97); } }
@keyframes rbl-toast-in { from { opacity: 0; transform: translate(-50%, 14px) scale(0.97); } }
@keyframes rbl-toast-out { to { opacity: 0; transform: translate(-50%, 8px) scale(0.98); } }
@keyframes rbl-toast-timer { to { transform: scaleX(0); } }
@keyframes rbl-dialog-in { from { opacity: 0; transform: translateY(14px) scale(0.97); } }
@keyframes rbl-panel-in { from { opacity: 0; transform: translateY(16px) scale(0.98); } }
@keyframes rbl-bump { 40% { transform: translateY(-3px) scale(1.14); } }
@keyframes rbl-pop { from { transform: scale(0.4); opacity: 0; } }
@keyframes rbl-shimmer { 60%, 100% { transform: translateX(100%); } }
@keyframes rbl-indeterminate { from { transform: translateX(-110%); } to { transform: translateX(320%); } }

@media (prefers-reduced-motion: reduce) {
  .rbl-scope, .rbl-scope *, .rbl-scope::after, .rbl-order, input.rbl-bulk-checkbox, input.rbl-bulk-checkbox::before,
  .rbl-row, dialog.rbl-dialog, dialog.rbl-dialog::backdrop {
    animation-duration: 1ms !important; animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
  }
  .rbl-spinner { animation: rbl-spin 1.6s linear infinite !important; }
}

@media (forced-colors: active) {
  .rbl-dock, .rbl-toast, .rbl-panel, dialog.rbl-dialog { border: 1px solid CanvasText; }
  button.rbl-btn { border: 1px solid ButtonText; }
  input.rbl-bulk-checkbox { border: 1px solid CanvasText; }
  input.rbl-bulk-checkbox:checked::before { background: CanvasText; }
}
`;

/** 動きの曲線（トークンと同じく :root に置く。配色によって変わらない） */
const MOTION_CSS = `
:root {
  --rbl-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --rbl-ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}
`;

/**
 * テーマのスタイルシートを 1 度だけ注入し、配色の設定に追従させる。
 *
 * UI 部品を作る関数がそれぞれ呼ぶ（呼ばれる順序に依存しないため）。2 回目以降は何もしない。
 * 注入の仕組みは共有部品 `@fleamarket/core/style`。CSS 本文（トークン + 動き + 部品）と
 * `<style>` の id、注入後の配色設定への追従はここで決める。
 */
export function ensureTheme(): void {
  ensureStyleSheet({
    id: ID_NAME.THEME_STYLE,
    css: () => `${buildTokenCss()}\n${MOTION_CSS}\n${COMPONENT_CSS}`,
    afterInject: syncThemePreference,
  });
}
