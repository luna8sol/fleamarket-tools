import { CLASS_NAME } from '../infra/constants';
import { createIcon, IconName } from './icons';
import { ensureTheme } from './theme';
import { createUiComponents } from '@fleamarket/core/components';
import type {
  ButtonSpec as CoreButtonSpec,
  ButtonVariant,
  ProgressTone,
} from '@fleamarket/core/components';

/**
 * 注入 UI の共通部品（ボタン・進捗表示）。見た目は theme.ts のクラスで決まる。
 *
 * 組み立ては共有部品 `@fleamarket/core/components` にある。ここでは、この拡張のクラス名
 * （接頭辞 `mdp`、`CLASS_NAME` の値、アイコンを探すセレクタ）とアイコン・テーマを注入し、
 * 従来の関数名（`updateProgress`）と型（補足行・カウンタ無しの `ProgressView`）を保つ。
 */

export type { ButtonVariant, ProgressTone };

/** ボタンの装飾内容 */
export type ButtonSpec = CoreButtonSpec<IconName>;

/** 進捗表示に渡す内容 */
export interface ProgressView {
  label: string;
  /** 0〜1。省略すると終わりの見えない処理（準備中など）として流れる表示にする */
  ratio?: number;
  tone: ProgressTone;
  /** 先頭に出すアイコン。省略時、active ならスピナー */
  icon?: IconName;
}

const ui = createUiComponents<IconName>({
  classNames: {
    prefix: 'mdp',
    btnLabel: CLASS_NAME.BTN_LABEL,
    progressHead: CLASS_NAME.PROGRESS_HEAD,
    progressLabel: CLASS_NAME.PROGRESS_LABEL,
    progressPct: CLASS_NAME.PROGRESS_PCT,
    progressBar: CLASS_NAME.PROGRESS_BAR,
    headIconSelector: '.mdp-icon, .mdp-spinner',
  },
  createIcon,
  ensureTheme,
});

/**
 * ボタンにアイコンと文言を付け、種類に応じたクラスを当てる
 *
 * 何度呼んでも同じ結果になる（中身は毎回組み直す）。getOrCreateElement で
 * 取り出した既存のボタンにも使える。
 *
 * @param button 対象のボタン
 * @param spec 装飾内容
 * @returns 渡したボタン
 */
export function decorateButton(button: HTMLButtonElement, spec: ButtonSpec): HTMLButtonElement {
  return ui.decorateButton(button, spec);
}

/**
 * アイコンだけのボタンを作る（閉じるボタンなど）
 *
 * @param button 対象のボタン
 * @param icon アイコン名
 * @param label 読み上げ用の名前（title にも使う）
 * @returns 渡したボタン
 */
export function decorateIconButton(
  button: HTMLButtonElement,
  icon: IconName,
  label: string
): HTMLButtonElement {
  return ui.decorateIconButton(button, icon, label);
}

/**
 * ボタンの文言だけを差し替える（アイコンは残す）
 *
 * @param button 対象のボタン
 * @param text 新しい文言
 */
export function setButtonLabel(button: HTMLButtonElement, text: string): void {
  ui.setButtonLabel(button, text);
}

/**
 * ボタンを処理中の見た目にする（押せなくし、アイコンをスピナーにする）
 *
 * @param button 対象のボタン
 * @param busy 処理中か
 */
export function setButtonBusy(button: HTMLButtonElement, busy: boolean): void {
  ui.setButtonBusy(button, busy);
}

/**
 * 進捗表示（見出し・割合・バー）の器を作る
 *
 * @param element 器にする要素（既存の ID 付き要素を渡してよい）
 * @returns 渡した要素
 */
export function buildProgress<T extends HTMLElement>(element: T): T {
  return ui.buildProgress(element);
}

/**
 * 進捗表示を更新する
 *
 * @param element buildProgress で組んだ要素
 * @param view 表示内容
 */
export function updateProgress(element: HTMLElement, view: ProgressView): void {
  ui.renderProgress(element, view);
}
