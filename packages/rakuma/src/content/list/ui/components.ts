import { createIcon, IconName } from '../../../common/icons';
import { CLASS_NAME } from '../infra/constants';
import { ensureTheme } from './theme';
import { createUiComponents } from '@fleamarket/core/components';
import type {
  ButtonSpec as CoreButtonSpec,
  ButtonVariant,
  ProgressTone,
  ProgressView as CoreProgressView,
} from '@fleamarket/core/components';

/**
 * 注入 UI の共通部品（ボタン・進捗表示）。見た目は theme.ts のクラスで決まる。
 *
 * 組み立ては共有部品 `@fleamarket/core/components` にある。ここでは、この拡張のクラス名
 * （接頭辞 `rbl`、`CLASS_NAME` の値、補足行、アイコンを探すセレクタ）とアイコン・テーマを
 * 注入し、従来の関数名（`renderProgress`）を保つ。
 */

export type { ButtonVariant, ProgressTone };

/** ボタンの装飾内容 */
export type ButtonSpec = CoreButtonSpec<IconName>;

/** 進捗表示に渡す内容（見出し・補足・割合またはカウンタ・色調・アイコン） */
export type ProgressView = CoreProgressView<IconName>;

const ui = createUiComponents<IconName>({
  classNames: {
    prefix: 'rbl',
    btnLabel: CLASS_NAME.BTN_LABEL,
    progressHead: CLASS_NAME.PROGRESS_HEAD,
    progressLabel: CLASS_NAME.PROGRESS_LABEL,
    progressPct: CLASS_NAME.PROGRESS_PCT,
    progressBar: CLASS_NAME.PROGRESS_BAR,
    progressDetail: CLASS_NAME.PROGRESS_DETAIL,
    headIconSelector: ':scope > .rbl-icon, :scope > .rbl-spinner',
  },
  createIcon,
  ensureTheme,
});

/**
 * ボタンにアイコンと文言を付け、種類に応じたクラスを当てる。
 * 何度呼んでも同じ結果になる（中身は毎回組み直す）。
 */
export function decorateButton(button: HTMLButtonElement, spec: ButtonSpec): HTMLButtonElement {
  return ui.decorateButton(button, spec);
}

/**
 * アイコンだけのボタンにする（閉じるボタンなど）。
 * 文言が無いので、読み上げ用の名前を aria-label と title に入れる。
 */
export function decorateIconButton(
  button: HTMLButtonElement,
  icon: IconName,
  label: string
): HTMLButtonElement {
  return ui.decorateIconButton(button, icon, label);
}

/**
 * 進捗表示（見出し・補足・バー）の器を作る。
 * 既存の ID 付き要素を渡してよい（中身は組み直す）。
 */
export function buildProgress<T extends HTMLElement>(element: T): T {
  return ui.buildProgress(element);
}

/**
 * 進捗表示を更新する
 */
export function renderProgress(element: HTMLElement, view: ProgressView): void {
  ui.renderProgress(element, view);
}
