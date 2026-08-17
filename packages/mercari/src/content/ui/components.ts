import { CLASS_NAME } from '../infra/constants';
import { createIcon, IconName } from './icons';
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
  ensureTheme();

  button.type = 'button';
  button.className = [
    'mdp-btn',
    `mdp-btn--${spec.variant}`,
    spec.size === 'sm' ? 'mdp-btn--sm' : '',
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
  ensureTheme();

  button.type = 'button';
  button.className = 'mdp-btn mdp-btn--ghost mdp-btn--icon';
  button.removeAttribute('style');
  button.replaceChildren(createIcon(icon, 16));
  button.setAttribute('aria-label', label);
  button.title = label;
  return button;
}

/**
 * ボタンの文言だけを差し替える（アイコンは残す）
 *
 * @param button 対象のボタン
 * @param text 新しい文言
 */
export function setButtonLabel(button: HTMLButtonElement, text: string): void {
  const label = button.querySelector(`.${CLASS_NAME.BTN_LABEL}`);
  if (label) {
    label.textContent = text;
  } else {
    button.textContent = text;
  }
}

/**
 * ボタンを処理中の見た目にする（押せなくし、アイコンをスピナーにする）
 *
 * @param button 対象のボタン
 * @param busy 処理中か
 */
export function setButtonBusy(button: HTMLButtonElement, busy: boolean): void {
  button.disabled = busy;
  if (busy) {
    button.dataset.busy = 'true';
    button.setAttribute('aria-busy', 'true');
  } else {
    delete button.dataset.busy;
    button.removeAttribute('aria-busy');
  }
}

/** 進捗表示の色調 */
export type ProgressTone = 'active' | 'success' | 'warning' | 'danger' | 'idle';

/** 進捗表示に渡す内容 */
export interface ProgressView {
  label: string;
  /** 0〜1。省略すると終わりの見えない処理（準備中など）として流れる表示にする */
  ratio?: number;
  tone: ProgressTone;
  /** 先頭に出すアイコン。省略時、active ならスピナー */
  icon?: IconName;
}

/**
 * 進捗表示（見出し・割合・バー）の器を作る
 *
 * @param element 器にする要素（既存の ID 付き要素を渡してよい）
 * @returns 渡した要素
 */
export function buildProgress<T extends HTMLElement>(element: T): T {
  ensureTheme();

  element.className = 'mdp-progress';
  element.removeAttribute('style');
  element.setAttribute('role', 'status');
  element.setAttribute('aria-live', 'polite');
  element.replaceChildren();

  const head = document.createElement('div');
  head.className = CLASS_NAME.PROGRESS_HEAD;

  const label = document.createElement('span');
  label.className = CLASS_NAME.PROGRESS_LABEL;

  const pct = document.createElement('span');
  pct.className = `${CLASS_NAME.PROGRESS_PCT} mdp-num`;

  head.append(label, pct);

  const track = document.createElement('div');
  track.className = 'mdp-progress__track';
  const bar = document.createElement('div');
  bar.className = CLASS_NAME.PROGRESS_BAR;
  track.appendChild(bar);

  element.append(head, track);
  return element;
}

/**
 * 進捗表示を更新する
 *
 * @param element buildProgress で組んだ要素
 * @param view 表示内容
 */
export function updateProgress(element: HTMLElement, view: ProgressView): void {
  const head = element.querySelector(`.${CLASS_NAME.PROGRESS_HEAD}`);
  const label = element.querySelector(`.${CLASS_NAME.PROGRESS_LABEL}`);
  const pct = element.querySelector(`.${CLASS_NAME.PROGRESS_PCT}`);
  const bar = element.querySelector<HTMLElement>(`.${CLASS_NAME.PROGRESS_BAR}`);
  if (!head || !label || !pct || !bar) return;

  element.dataset.tone = view.tone;
  label.textContent = view.label;
  element.setAttribute('aria-label', view.label);

  // 先頭のアイコン（またはスピナー）を差し替える
  head.querySelector('.mdp-icon, .mdp-spinner')?.remove();
  if (view.icon) {
    head.prepend(createIcon(view.icon, 16));
  } else if (view.tone === 'active') {
    const spinner = document.createElement('span');
    spinner.className = 'mdp-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    head.prepend(spinner);
  }

  if (view.ratio === undefined) {
    element.dataset.indeterminate = 'true';
    pct.textContent = '';
    bar.style.width = '';
    return;
  }

  delete element.dataset.indeterminate;
  const clamped = Math.min(1, Math.max(0, view.ratio));
  pct.textContent = `${Math.round(clamped * 100)}%`;
  bar.style.width = `${clamped * 100}%`;
}
