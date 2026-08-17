import { createIcon, IconName } from '../../../common/icons';
import { warn } from '../../../common/logger';
import { CONFIG, ID_NAME } from '../infra/constants';
import { decorateButton } from './components';
import { ensureTheme } from './theme';

/**
 * 取り消せない操作の前に出す確認ダイアログ（window.confirm の置き換え）。
 *
 * - **既定のフォーカスは「キャンセル」。** Enter の押しっぱなしや連打で実行に進ませない。
 * - Esc・背景のクリックはキャンセル扱い。
 * - **`<dialog>` を出せない環境では `window.confirm` に切り替える。確認を省いて進むことはしない。**
 * - 件数だけでなく処理順の商品名も並べる。選んだつもりの対象と実際の対象のずれに気づけるように。
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
  /** 取り消せないことなどの注意書き */
  note?: string;
  confirmLabel: string;
  tone: 'primary' | 'danger';
  icon: IconName;
}

/** window.confirm に渡す文面を組み立てる（dialog を使えないときの代替） */
function toPlainText(options: ConfirmOptions): string {
  const max = CONFIG.CONFIRM_MAX_ITEMS;
  const items = options.items ?? [];
  const lines = [options.title];

  if (options.message) lines.push(options.message);
  if (options.facts?.length) {
    lines.push(options.facts.map((f) => `${f.label} ${f.value}`).join(' / '));
  }
  if (items.length > 0) {
    lines.push('', ...items.slice(0, max).map((name, i) => `${i + 1}. ${name}`));
    if (items.length > max) lines.push(`…ほか${items.length - max}件`);
  }
  if (options.note) lines.push('', options.note);
  lines.push('', '実行しますか？');

  return lines.join('\n');
}

function buildFacts(facts: ConfirmFact[]): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.className = 'rbl-facts';
  for (const fact of facts) {
    const tile = document.createElement('div');
    tile.className = 'rbl-fact';
    if (fact.emphasis) tile.dataset.emphasis = 'true';

    const value = document.createElement('span');
    value.className = 'rbl-fact__value rbl-num';
    value.textContent = fact.value;

    const label = document.createElement('span');
    label.className = 'rbl-fact__label';
    label.textContent = fact.label;

    tile.append(value, label);
    wrap.appendChild(tile);
  }
  return wrap;
}

function buildItemList(items: string[]): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const max = CONFIG.CONFIRM_MAX_ITEMS;

  const head = document.createElement('div');
  head.className = 'rbl-dialog__list-head';
  head.textContent = '処理する順番';
  fragment.appendChild(head);

  const list = document.createElement('ol');
  list.className = 'rbl-dialog__list';
  list.setAttribute('aria-label', '対象の商品（処理する順）');
  for (const name of items.slice(0, max)) {
    const li = document.createElement('li');
    li.textContent = name || '（商品名なし）';
    list.appendChild(li);
  }
  if (items.length > max) {
    const more = document.createElement('li');
    more.className = 'rbl-dialog__more';
    more.textContent = `ほか ${items.length - max}件`;
    list.appendChild(more);
  }
  fragment.appendChild(list);
  return fragment;
}

/** ダイアログの中身を組み立て、確定ボタンとキャンセルボタンを返す */
function buildDialog(
  dialog: HTMLDialogElement,
  options: ConfirmOptions
): { confirmBtn: HTMLButtonElement; cancelBtn: HTMLButtonElement } {
  dialog.className = 'rbl-dialog rbl-scope';
  dialog.dataset.tone = options.tone;

  const titleId = `${ID_NAME.CONFIRM_DIALOG}-title`;
  const messageId = `${ID_NAME.CONFIRM_DIALOG}-message`;
  dialog.setAttribute('aria-labelledby', titleId);

  const head = document.createElement('div');
  head.className = 'rbl-dialog__head';

  const badge = document.createElement('div');
  badge.className = 'rbl-dialog__badge';
  badge.appendChild(createIcon(options.icon, 20));

  const titles = document.createElement('div');
  const title = document.createElement('h2');
  title.id = titleId;
  title.className = 'rbl-dialog__title';
  title.textContent = options.title;
  titles.appendChild(title);

  if (options.message) {
    const message = document.createElement('p');
    message.id = messageId;
    message.className = 'rbl-dialog__message';
    message.textContent = options.message;
    titles.appendChild(message);
    dialog.setAttribute('aria-describedby', messageId);
  }
  head.append(badge, titles);

  const body = document.createElement('div');
  body.className = 'rbl-dialog__body';
  if (options.facts?.length) body.appendChild(buildFacts(options.facts));
  if (options.items?.length) body.appendChild(buildItemList(options.items));
  if (options.note) {
    const note = document.createElement('div');
    note.className = 'rbl-note';
    note.appendChild(createIcon('warning', 14));
    const text = document.createElement('span');
    text.textContent = options.note;
    note.appendChild(text);
    body.appendChild(note);
  }

  const foot = document.createElement('div');
  foot.className = 'rbl-dialog__foot';
  const cancelBtn = decorateButton(document.createElement('button'), {
    label: 'キャンセル',
    variant: 'secondary',
  });
  const confirmBtn = decorateButton(document.createElement('button'), {
    label: options.confirmLabel,
    variant: options.tone === 'danger' ? 'danger-solid' : 'primary',
    icon: options.icon,
  });
  foot.append(cancelBtn, confirmBtn);

  dialog.append(head, body, foot);
  return { confirmBtn, cancelBtn };
}

/** 表示中のダイアログの答えを確定させる関数（次のダイアログを出すときにキャンセルで閉じるため） */
let settleCurrent: ((confirmed: boolean) => void) | null = null;

/**
 * 確認ダイアログを出し、利用者の答えを待つ。実行してよければ true。
 *
 * 答えはボタンのクリックで直接確定させる。`close` イベントは描画の都合で遅れて
 * 届くことがあり、それを待つと承諾してから処理が始まるまでに間が空くため。
 * `close` は Esc など、ボタン以外で閉じられたときの受け皿として使う。
 */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  ensureTheme();

  // 前のダイアログが残っていれば取り下げる（その呼び出しはキャンセル扱いで終わる）
  settleCurrent?.(false);
  document.getElementById(ID_NAME.CONFIRM_DIALOG)?.remove();

  const dialog = document.createElement('dialog');
  if (typeof dialog.showModal !== 'function') {
    return Promise.resolve(window.confirm(toPlainText(options)));
  }

  dialog.id = ID_NAME.CONFIRM_DIALOG;
  const { confirmBtn, cancelBtn } = buildDialog(dialog, options);
  document.body.appendChild(dialog);

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const settle = (confirmed: boolean): void => {
      if (settled) return;
      settled = true;
      settleCurrent = null;
      if (dialog.open) dialog.close(confirmed ? 'confirm' : 'cancel');
      dialog.remove();
      resolve(confirmed);
    };
    settleCurrent = settle;

    confirmBtn.addEventListener('click', () => settle(true));
    cancelBtn.addEventListener('click', () => settle(false));
    // Esc など、ボタン以外で閉じられたときはキャンセル扱い
    dialog.addEventListener('close', () => settle(dialog.returnValue === 'confirm'));

    // 背景（dialog 要素そのもの）のクリックはキャンセル。
    // 本文の上で押してから背景で離した場合などを拾わないよう、押した位置も dialog であることを見る。
    let pressedOnBackdrop = false;
    dialog.addEventListener('pointerdown', (e) => {
      pressedOnBackdrop = e.target === dialog;
    });
    dialog.addEventListener('click', (e) => {
      if (pressedOnBackdrop && e.target === dialog) settle(false);
    });

    try {
      dialog.showModal();
      cancelBtn.focus();
    } catch (e) {
      warn('確認ダイアログを表示できないため window.confirm に切り替えます', e);
      settled = true;
      settleCurrent = null;
      dialog.remove();
      resolve(window.confirm(toPlainText(options)));
    }
  });
}
