/**
 * デザイントークン（CSS 変数）の CSS を組み立てる（両拡張で共通の骨格）。
 *
 * ライトの値を `:root` に出し、ダークの値を `prefers-color-scheme: dark` で上書きする。
 * 利用者が配色を選べる拡張（ラクマ）は `<html>` の属性でも切り替えるので、属性名を渡すと
 * メディアクエリ側を `:not([attr="light"])` で外し、`[attr="dark"]` のブロックを足す。
 * トークンの名前と値（接頭辞 `--mdp-` / `--rbl-` を含む）は各パッケージの theme に残る。
 */

export type TokenMap = Record<string, string>;

export interface TokenCssSpec {
  /** `:root` に出す値（ライト。ダークで上書きしないものも含む） */
  light: TokenMap;
  /** ダークで上書きする値 */
  dark: TokenMap;
  /** 配色に関わらず `:root` に出す値（`light` の後に続ける） */
  fixed?: TokenMap;
  /**
   * 利用者の配色設定を表す `<html>` の属性名。
   * あれば `auto`（属性なし）は OS の設定、`light` / `dark` は属性で決まる形にする。
   * 無ければ OS の設定だけで切り替える。
   */
  preferenceAttribute?: string;
}

/** トークンを `  name: value;` の行に並べる */
export function declarations(tokens: TokenMap): string {
  return Object.entries(tokens)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n');
}

export function buildTokenCss(spec: TokenCssSpec): string {
  const light = spec.fixed
    ? `${declarations(spec.light)}\n${declarations(spec.fixed)}`
    : declarations(spec.light);
  const dark = declarations(spec.dark);
  const attr = spec.preferenceAttribute;

  if (attr === undefined) {
    return [
      `:root {\n${light}\n}`,
      `@media (prefers-color-scheme: dark) {\n  :root {\n${dark}\n  }\n}`,
    ].join('\n');
  }

  return [
    `:root {\n${light}\n}`,
    `@media (prefers-color-scheme: dark) {\n  :root:not([${attr}="light"]) {\n${dark}\n  }\n}`,
    `:root[${attr}="dark"] {\n${dark}\n}`,
  ].join('\n');
}
