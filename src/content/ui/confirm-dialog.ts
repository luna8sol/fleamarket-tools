import { ID_NAME } from '../infra/constants';
import { warn } from '../infra/logger';
import { decorateButton } from './components';
import { createIcon, IconName } from './icons';
import { ensureTheme } from './theme';

/**
 * 取り消せない操作の前に出す確認ダイアログ。
 *
 * - **既定のフォーカスは「キャンセル」。** Enter の押しっぱなしや連打で実行に進ませない。
 * - Esc・背景のクリックはキャンセル扱い。
 * - `<dialog>` を出せない環境では `window.confirm` に切り替える。**確認を省いて進むことはしない。**
 */

/** 件数などの要点（ダイアログ上部にタイルで並べる） */
export interface ConfirmFact {
  label: string;
  value: string;
  /** 主役の数字として強調するか */
  emphasis?: boolean;
}

/** 確認ダイアログの内容 */
export interface ConfirmOptions {
  title: string;
  message?: string;
  facts?: ConfirmFact[];
  /** 対象の一覧（処理順に並べる） */
  items?: string[];
  /** 一覧に並べる上限（超えた分は「…ほか N 件」にまとめる） */
  maxItems?: number;
  /** 取り消せないことなどの注意書き */
  note?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone: 'primary' | 'danger';
  icon: IconName;
}

/** 一覧の既定の上限 */
const DEFAULT_MAX_ITEMS = 10;

/**
 * window.confirm に渡す文面を組み立てる（dialog を使えないときの代替）
 *
 * @param options 確認ダイアログの内容
 * @returns 文面
 */
function toPlainText(options: ConfirmOptions): string {
  const max = options.maxItems ?? DEFAULT_MAX_ITEMS;
  const items = options.items ?? [];
  const lines = [options.title];

  if (options.message) lines.push(options.message);
  if (options.facts?.length) {
    lines.push(options.facts.map((f) => `${f.label} ${f.value}`).join(' / '));
  }
  if (items.length > 0) {
    lines.push('', ...items.slice(0, max).map((name) => `・${name}`));
    if (items.length > max) lines.push(`…ほか${items.length - max}件`);
  }
  if (options.note) lines.push('', options.note);
  lines.push('', '実行しますか？');

  return lines.join('\n');
}

/**
 * ダイアログの中身を組み立てる
 *
 * @param dialog 器の dialog
 * @param options 確認ダイアログの内容
 * @returns 確定ボタンとキャンセルボタン
 */
function buildDialog(
  dialog: HTMLDialogElement,
  options: ConfirmOptions
): { confirmBtn: HTMLButtonElement; cancelBtn: HTMLButtonElement } {
  dialog.className = 'mdp-dialog mdp-scope';
  dialog.dataset.tone = options.tone;
  dialog.replaceChildren();

  const titleId = `${ID_NAME.CONFIRM_DIALOG}-title`;
  const messageId = `${ID_NAME.CONFIRM_DIALOG}-message`;
  dialog.setAttribute('aria-labelledby', titleId);

  // 見出し
  const head = document.createElement('div');
  head.className = 'mdp-dialog__head';

  const badge = document.createElement('div');
  badge.className = 'mdp-dialog__badge';
  badge.appendChild(createIcon(options.icon, 20));

  const titles = document.createElement('div');
  const title = document.createElement('h2');
  title.id = titleId;
  title.className = 'mdp-dialog__title';
  title.textContent = options.title;
  titles.appendChild(title);

  if (options.message) {
    const message = document.createElement('p');
    message.id = messageId;
    message.className = 'mdp-dialog__message';
    message.textContent = options.message;
    titles.appendChild(message);
    dialog.setAttribute('aria-describedby', messageId);
  } else {
    dialog.removeAttribute('aria-describedby');
  }

  head.append(badge, titles);

  // 本文（要点・一覧・注意書き）
  const body = document.createElement('div');
  body.className = 'mdp-dialog__body';

  if (options.facts?.length) {
    const facts = document.createElement('div');
    facts.className = 'mdp-dialog__facts';
    for (const fact of options.facts) {
      const tile = document.createElement('div');
      tile.className = 'mdp-fact';
      if (fact.emphasis) tile.dataset.emphasis = 'true';

      const value = document.createElement('span');
      value.className = 'mdp-fact__value mdp-num';
      value.textContent = fact.value;

      const label = document.createElement('span');
      label.className = 'mdp-fact__label';
      label.textContent = fact.label;

      tile.append(value, label);
      facts.appendChild(tile);
    }
    body.appendChild(facts);
  }

  const items = options.items ?? [];
  if (items.length > 0) {
    const max = options.maxItems ?? DEFAULT_MAX_ITEMS;
    const list = document.createElement('ol');
    list.className = 'mdp-dialog__list';
    list.setAttribute('aria-label', '対象の商品（処理する順）');

    for (const name of items.slice(0, max)) {
      const li = document.createElement('li');
      li.textContent = name;
      list.appendChild(li);
    }
    if (items.length > max) {
      const more = document.createElement('li');
      more.className = 'mdp-dialog__more';
      more.textContent = `ほか ${items.length - max}件`;
      list.appendChild(more);
    }
    body.appendChild(list);
  }

  if (options.note) {
    const note = document.createElement('div');
    note.className = 'mdp-dialog__note';
    note.appendChild(createIcon('warning', 14));
    const text = document.createElement('span');
    text.textContent = options.note;
    note.appendChild(text);
    body.appendChild(note);
  }

  // ボタン
  const foot = document.createElement('div');
  foot.className = 'mdp-dialog__foot';

  const cancelBtn = decorateButton(document.createElement('button'), {
    label: options.cancelLabel ?? 'キャンセル',
    variant: 'secondary',
  });
  cancelBtn.autofocus = true;

  const confirmBtn = decorateButton(document.createElement('button'), {
    label: options.confirmLabel,
    variant: options.tone === 'danger' ? 'danger-solid' : 'primary',
    icon: options.icon,
  });

  foot.append(cancelBtn, confirmBtn);
  dialog.append(head, body, foot);

  return { confirmBtn, cancelBtn };
}

/**
 * 確認ダイアログを出し、利用者の答えを待つ
 *
 * @param options 確認ダイアログの内容
 * @returns 実行してよければ true
 */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  ensureTheme();

  // 前のダイアログが残っていれば取り下げる（その呼び出しはキャンセル扱いで終わる）
  const previous = document.getElementById(ID_NAME.CONFIRM_DIALOG);
  if (previous instanceof HTMLDialogElement && previous.open) {
    previous.close('cancel');
  }
  previous?.remove();

  const dialog = document.createElement('dialog');
  if (typeof dialog.showModal !== 'function') {
    return Promise.resolve(window.confirm(toPlainText(options)));
  }

  dialog.id = ID_NAME.CONFIRM_DIALOG;
  const { confirmBtn, cancelBtn } = buildDialog(dialog, options);
  document.body.appendChild(dialog);

  return new Promise<boolean>((resolve) => {
    dialog.addEventListener(
      'close',
      () => {
        resolve(dialog.returnValue === 'confirm');
        dialog.remove();
      },
      { once: true }
    );

    confirmBtn.addEventListener('click', () => dialog.close('confirm'));
    cancelBtn.addEventListener('click', () => dialog.close('cancel'));

    // 背景（dialog 要素そのもの）のクリックはキャンセル
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close('cancel');
    });

    try {
      dialog.showModal();
      cancelBtn.focus();
    } catch (e) {
      warn('確認ダイアログを表示できないため window.confirm に切り替えます', e);
      dialog.remove();
      resolve(window.confirm(toPlainText(options)));
    }
  });
}
