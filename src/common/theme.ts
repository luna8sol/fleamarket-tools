/**
 * 拡張機能の UI（一覧ページへ注入する UI と popup）で共有するデザイントークンと、
 * ライト / ダークの設定。
 *
 * - **トークンの正本はここだけ。** 注入 UI（src/content/list/ui/theme.ts）も popup
 *   （src/popup/index.ts）も、ここから CSS 変数を組み立てて注入する。値を 2 か所に持たない。
 * - **ラクマ本体はダークモードに対応していない**（2026-10-02 実測: `prefers-color-scheme`
 *   のルールが 1 つも無く、OS がダークでも背景は `#fff` のまま）。そのため
 *   - 浮遊する UI（ドック・パネル・トースト・ダイアログ）は設定に従ってライト / ダークを切り替える
 *   - 一覧の行に差し込む部品（チェックボックス・選択順）はラクマの白い背景の上に載るので、
 *     設定に関わらず `--rbl-page-*` の固定値で描く
 * - **ブランドの赤は装飾にだけ使う。** ラクマの `#ec0606` は白文字とのコントラスト比が 4.57 で
 *   AA ぎりぎりのため、文字を載せる塗りには一段濃い `--rbl-accent` を使う。
 */

/** 利用者が選ぶ配色 */
export type ThemePreference = 'auto' | 'light' | 'dark';

/** chrome.storage.local のキー */
export const THEME_STORAGE_KEY = 'rbl-theme';

/** `<html>` に付ける属性（`auto` のときは付けない） */
export const THEME_ATTRIBUTE = 'data-rbl-theme';

const LIGHT_TOKENS: Record<string, string> = {
  '--rbl-font':
    '"Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Noto Sans JP", Meiryo, sans-serif',
  '--rbl-mono': 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',

  '--rbl-brand': '#ec0606',
  '--rbl-brand-2': '#ff5a3c',
  '--rbl-accent': '#d40a0a',
  '--rbl-accent-hover': '#b80808',
  '--rbl-accent-text': '#c40808',
  '--rbl-accent-soft': 'rgba(236, 6, 6, 0.08)',
  '--rbl-accent-soft-strong': 'rgba(236, 6, 6, 0.15)',
  '--rbl-on-accent': '#ffffff',
  '--rbl-ring': 'rgba(236, 6, 6, 0.40)',

  '--rbl-glass': 'rgba(255, 255, 255, 0.84)',
  '--rbl-surface': '#ffffff',
  '--rbl-surface-sunken': '#f4f4f6',
  '--rbl-surface-hover': 'rgba(17, 17, 26, 0.05)',
  '--rbl-surface-active': 'rgba(17, 17, 26, 0.09)',
  '--rbl-border': 'rgba(17, 17, 26, 0.10)',
  '--rbl-border-strong': 'rgba(17, 17, 26, 0.20)',
  '--rbl-text': '#18181b',
  '--rbl-text-muted': '#52525b',
  '--rbl-text-subtle': '#6b6b74',

  '--rbl-success': '#0f7b4b',
  '--rbl-success-soft': 'rgba(18, 183, 106, 0.12)',
  '--rbl-warning': '#a15c07',
  '--rbl-warning-soft': 'rgba(247, 144, 9, 0.14)',
  '--rbl-danger': '#c81e1e',
  '--rbl-danger-hover': '#a91616',
  '--rbl-danger-soft': 'rgba(217, 45, 32, 0.09)',
  '--rbl-on-danger': '#ffffff',
  '--rbl-info': '#1d5fd1',
  '--rbl-info-soft': 'rgba(46, 144, 250, 0.12)',

  '--rbl-shadow-sm': '0 1px 2px rgba(16, 16, 24, 0.06), 0 1px 1px rgba(16, 16, 24, 0.04)',
  '--rbl-shadow-lg':
    '0 1px 1px rgba(16, 16, 24, 0.04), 0 8px 20px -6px rgba(16, 16, 24, 0.14), 0 28px 56px -16px rgba(16, 16, 24, 0.24)',
  '--rbl-highlight': 'inset 0 1px 0 rgba(255, 255, 255, 0.7)',
  '--rbl-backdrop': 'rgba(10, 10, 14, 0.42)',
};

const DARK_TOKENS: Record<string, string> = {
  '--rbl-brand': '#ff3b3b',
  '--rbl-brand-2': '#ff7a50',
  '--rbl-accent': '#d42a30',
  '--rbl-accent-hover': '#e23a40',
  '--rbl-accent-text': '#ff7a7a',
  '--rbl-accent-soft': 'rgba(255, 90, 90, 0.12)',
  '--rbl-accent-soft-strong': 'rgba(255, 90, 90, 0.20)',
  '--rbl-ring': 'rgba(255, 110, 110, 0.55)',

  '--rbl-glass': 'rgba(30, 30, 34, 0.80)',
  '--rbl-surface': '#1c1c20',
  '--rbl-surface-sunken': '#141417',
  '--rbl-surface-hover': 'rgba(255, 255, 255, 0.06)',
  '--rbl-surface-active': 'rgba(255, 255, 255, 0.10)',
  '--rbl-border': 'rgba(255, 255, 255, 0.10)',
  '--rbl-border-strong': 'rgba(255, 255, 255, 0.20)',
  '--rbl-text': '#f4f4f5',
  '--rbl-text-muted': '#b4b4bd',
  '--rbl-text-subtle': '#9a9aa5',

  '--rbl-success': '#5bd69a',
  '--rbl-success-soft': 'rgba(91, 214, 154, 0.14)',
  '--rbl-warning': '#f5b544',
  '--rbl-warning-soft': 'rgba(245, 181, 68, 0.14)',
  '--rbl-danger': '#ff6b6b',
  '--rbl-danger-hover': '#ff8a8a',
  '--rbl-danger-soft': 'rgba(255, 107, 107, 0.12)',
  '--rbl-on-danger': '#1a0a0a',
  '--rbl-info': '#7aa7ff',
  '--rbl-info-soft': 'rgba(122, 167, 255, 0.14)',

  '--rbl-shadow-sm': '0 1px 2px rgba(0, 0, 0, 0.4)',
  '--rbl-shadow-lg':
    '0 0 0 1px rgba(255, 255, 255, 0.06), 0 12px 28px -8px rgba(0, 0, 0, 0.55), 0 32px 64px -20px rgba(0, 0, 0, 0.7)',
  '--rbl-highlight': 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
  '--rbl-backdrop': 'rgba(0, 0, 0, 0.55)',
};

/**
 * ラクマの白い背景の上に載る部品用（設定に関わらずライトの値）。
 * 行のチェックボックスや選択順など、ページの中に差し込むものだけが使う。
 */
const PAGE_TOKENS: Record<string, string> = {
  '--rbl-page-accent': '#d40a0a',
  '--rbl-page-brand': '#ec0606',
  '--rbl-page-ring': 'rgba(236, 6, 6, 0.40)',
  '--rbl-page-soft': 'rgba(236, 6, 6, 0.05)',
  '--rbl-page-badge': 'rgba(236, 6, 6, 0.08)',
  '--rbl-page-surface': '#ffffff',
  '--rbl-page-border': 'rgba(17, 17, 26, 0.28)',
  '--rbl-page-text-subtle': '#6b6b74',
};

function declarations(tokens: Record<string, string>): string {
  return Object.entries(tokens)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n');
}

/**
 * トークンの CSS を組み立てる。
 *
 * ダークの値は 2 か所で当てる。
 * - 設定が `auto`（属性なし）で OS がダーク → `prefers-color-scheme` のメディアクエリ
 * - 設定が `dark` → 属性セレクタ（OS の設定に関わらず）
 * 設定が `light` のときはメディアクエリ側を `:not()` で外す。
 */
export function buildTokenCss(): string {
  const dark = declarations(DARK_TOKENS);
  return [
    `:root {\n${declarations(LIGHT_TOKENS)}\n${declarations(PAGE_TOKENS)}\n}`,
    `@media (prefers-color-scheme: dark) {\n  :root:not([${THEME_ATTRIBUTE}="light"]) {\n${dark}\n  }\n}`,
    `:root[${THEME_ATTRIBUTE}="dark"] {\n${dark}\n}`,
  ].join('\n');
}

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'auto' || value === 'light' || value === 'dark';
}

/** 保存されている配色を読む（無い・読めないときは auto） */
export async function loadThemePreference(): Promise<ThemePreference> {
  try {
    const stored = await chrome.storage.local.get(THEME_STORAGE_KEY);
    const value: unknown = stored[THEME_STORAGE_KEY];
    return isThemePreference(value) ? value : 'auto';
  } catch {
    return 'auto';
  }
}

/** 配色を保存する */
export async function saveThemePreference(preference: ThemePreference): Promise<void> {
  await chrome.storage.local.set({ [THEME_STORAGE_KEY]: preference });
}

/** `<html>` の属性へ反映する（auto は属性を外して OS に任せる） */
export function applyThemePreference(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === 'auto') {
    root.removeAttribute(THEME_ATTRIBUTE);
  } else {
    root.setAttribute(THEME_ATTRIBUTE, preference);
  }
}

/**
 * 保存されている配色を反映し、以後の変更（popup での切り替え）にも追従する。
 */
export function syncThemePreference(): void {
  void loadThemePreference().then(applyThemePreference);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !(THEME_STORAGE_KEY in changes)) return;
    const value: unknown = changes[THEME_STORAGE_KEY].newValue;
    applyThemePreference(isThemePreference(value) ? value : 'auto');
  });
}
