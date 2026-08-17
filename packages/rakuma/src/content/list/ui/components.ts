import { createIcon, IconName } from '../../../common/icons';
import { CLASS_NAME } from '../infra/constants';
import { ensureTheme } from './theme';

/**
 * 注入 UI の共通部品（ボタン・進捗表示）。見た目は theme.ts のクラスで決まる。
 */

/** ボタンの種類 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-solid';

/** ボタンの装飾内容 */
export interface ButtonSpec {
  label: string;
  variant: ButtonVariant;
  icon?: IconName;
  size?: 'sm' | 'md';
}

/**
 * ボタンにアイコンと文言を付け、種類に応じたクラスを当てる。
 * 何度呼んでも同じ結果になる（中身は毎回組み直す）。
 */
export function decorateButton(button: HTMLButtonElement, spec: ButtonSpec): HTMLButtonElement {
  ensureTheme();

  button.type = 'button';
  button.className = [
    'rbl-btn',
    `rbl-btn--${spec.variant}`,
    spec.size === 'sm' ? 'rbl-btn--sm' : '',
  ]
    .filter(Boolean)
    .join(' ');
  button.removeAttribute('style');
  button.replaceChildren();

  if (spec.icon) {
    button.appendChild(createIcon(spec.icon, spec.size === 'sm' ? 14 : 16));
  }

  const label = document.createElement('span');
  label.className = CLASS_NAME.BTN_LABEL;
  label.textContent = spec.label;
  button.appendChild(label);

  return button;
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
  ensureTheme();

  button.type = 'button';
  button.className = 'rbl-btn rbl-btn--ghost rbl-btn--icon';
  button.removeAttribute('style');
  button.replaceChildren(createIcon(icon, 16));
  button.setAttribute('aria-label', label);
  button.title = label;
  return button;
}

/** 進捗表示の色調 */
export type ProgressTone = 'active' | 'success' | 'warning' | 'danger' | 'idle';

/** 進捗表示に渡す内容 */
export interface ProgressView {
  label: string;
  /** 見出しの下に小さく出す補足（処理中の商品名など）。省略時は出さない */
  detail?: string;
  /** 0〜1。省略すると終わりの見えない処理（待機中など）として流れる表示にする */
  ratio?: number;
  /** 割合の代わりに右端へ出す文字（「3 / 10」など）。省略時は割合 */
  counter?: string;
  tone: ProgressTone;
  /** 先頭に出すアイコン。省略時、active ならスピナー */
  icon?: IconName;
}

/**
 * 進捗表示（見出し・補足・バー）の器を作る。
 * 既存の ID 付き要素を渡してよい（中身は組み直す）。
 */
export function buildProgress<T extends HTMLElement>(element: T): T {
  ensureTheme();

  element.className = 'rbl-progress';
  element.removeAttribute('style');
  element.setAttribute('role', 'status');
  element.setAttribute('aria-live', 'polite');
  element.replaceChildren();

  const head = document.createElement('div');
  head.className = CLASS_NAME.PROGRESS_HEAD;

  const label = document.createElement('span');
  label.className = CLASS_NAME.PROGRESS_LABEL;

  const pct = document.createElement('span');
  pct.className = `${CLASS_NAME.PROGRESS_PCT} rbl-num`;

  head.append(label, pct);

  const detail = document.createElement('div');
  detail.className = CLASS_NAME.PROGRESS_DETAIL;

  const track = document.createElement('div');
  track.className = 'rbl-progress__track';
  const bar = document.createElement('div');
  bar.className = CLASS_NAME.PROGRESS_BAR;
  track.appendChild(bar);

  element.append(head, detail, track);
  return element;
}

/**
 * 進捗表示を更新する
 */
export function renderProgress(element: HTMLElement, view: ProgressView): void {
  const head = element.querySelector(`.${CLASS_NAME.PROGRESS_HEAD}`);
  const label = element.querySelector(`.${CLASS_NAME.PROGRESS_LABEL}`);
  const pct = element.querySelector(`.${CLASS_NAME.PROGRESS_PCT}`);
  const detail = element.querySelector(`.${CLASS_NAME.PROGRESS_DETAIL}`);
  const bar = element.querySelector<HTMLElement>(`.${CLASS_NAME.PROGRESS_BAR}`);
  if (!head || !label || !pct || !detail || !bar) return;

  element.dataset.tone = view.tone;
  label.textContent = view.label;
  detail.textContent = view.detail ?? '';
  element.setAttribute('aria-label', view.detail ? `${view.label} ${view.detail}` : view.label);

  // 先頭のアイコン（またはスピナー）を差し替える
  head.querySelector(':scope > .rbl-icon, :scope > .rbl-spinner')?.remove();
  if (view.icon) {
    head.prepend(createIcon(view.icon, 16));
  } else if (view.tone === 'active') {
    const spinner = document.createElement('span');
    spinner.className = 'rbl-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    head.prepend(spinner);
  }

  if (view.ratio === undefined) {
    element.dataset.indeterminate = 'true';
    pct.textContent = view.counter ?? '';
    bar.style.width = '';
    return;
  }

  delete element.dataset.indeterminate;
  const clamped = Math.min(1, Math.max(0, view.ratio));
  pct.textContent = view.counter ?? `${Math.round(clamped * 100)}%`;
  bar.style.width = `${clamped * 100}%`;
}
