/**
 * 取り消せない操作の前に出す確認ダイアログ（両拡張で共通の骨格）。
 *
 * - **既定のフォーカスは「キャンセル」。** Enter の押しっぱなしや連打で実行に進ませない。
 * - Esc・背景のクリックはキャンセル扱い。
 * - `<dialog>` を出せない環境では `window.confirm` に切り替える。**確認を省いて進むことはしない。**
 *
 * 2 つの拡張で違うもの（要素の id・クラス名・一覧の上限と平文の行頭・見出しや空の商品名の文言・
 * キャンセルに autofocus を付けるか・答えの確定方式）は `createConfirmDialog` に注入する。
 *
 * 確定方式は 2 系統あり、どちらも従来どおりに保つ:
 * - `close-event`: `<dialog>` の `close` イベントで答えを確定する（メルカリ用）
 * - `click`: ボタンのクリックでその場で確定し、`close` は Esc など
 *   ボタン以外で閉じられたときの受け皿にする。`close` イベントは描画の都合で遅れて届くことがあり、
 *   それを待つと承諾してから処理が始まるまでに間が空くため（ラクマ用）
 */
import type { ButtonVariant } from './components';

/** 件数などの要点（ダイアログ上部にタイルで並べる） */
export interface ConfirmFact {
  label: string;
  value: string;
  /** 主役の数字として強調するか */
  emphasis?: boolean;
}

/** 確認ダイアログの内容 */
export interface ConfirmOptions<I extends string> {
  title: string;
  message?: string;
  facts?: ConfirmFact[];
  /** 対象の一覧（処理順に並べる） */
  items?: string[];
  /** 一覧に並べる上限（超えた分は「…ほか N 件」にまとめる）。省略時は拡張ごとの既定値 */
  maxItems?: number;
  /** 取り消せないことなどの注意書き */
  note?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone: 'primary' | 'danger';
  icon: I;
}

export interface ConfirmDialogClassNames {
  /** 要点タイルを並べる要素のクラス名 */
  facts: string;
  /** 注意書きのクラス名 */
  note: string;
  /** 一覧の見出しのクラス名。`listHeadText` と一緒に渡したときだけ見出しを作る */
  listHead?: string;
}

export interface ConfirmDialogDeps<I extends string> {
  /** `<dialog>` の id。`-title` / `-message` を付けた id も派生させる */
  id: string;
  /** クラス名の接頭辞（`mdp` / `rbl`）。`<prefix>-dialog` などを組むのに使う */
  prefix: string;
  classNames: ConfirmDialogClassNames;
  /** `maxItems` 省略時の一覧の上限 */
  defaultMaxItems: number;
  /** `window.confirm` 用の平文で、一覧の 1 行をどう書くか */
  plainListItem: (name: string, index: number) => string;
  /** 一覧の上に出す見出しの文言。`classNames.listHead` と一緒に渡したときだけ出す */
  listHeadText?: string;
  /** 商品名が空のときに代わりに出す文言。省略時は空のまま */
  emptyItemName?: string;
  /** キャンセルボタンに `autofocus` を付けるか */
  autofocusCancel: boolean;
  settleMode: 'close-event' | 'click';
  createIcon: (name: I | 'warning', size: number) => SVGSVGElement;
  decorateButton: (
    button: HTMLButtonElement,
    spec: { label: string; variant: ButtonVariant; icon?: I }
  ) => HTMLButtonElement;
  ensureTheme: () => void;
  warn: (message: string, e: unknown) => void;
}

export type ConfirmAction<I extends string> = (options: ConfirmOptions<I>) => Promise<boolean>;

export function createConfirmDialog<I extends string>(
  deps: ConfirmDialogDeps<I>
): ConfirmAction<I> {
  const p = deps.prefix;
  const cls = deps.classNames;

  /** window.confirm に渡す文面を組み立てる（dialog を使えないときの代替） */
  const toPlainText = (options: ConfirmOptions<I>): string => {
    const max = options.maxItems ?? deps.defaultMaxItems;
    const items = options.items ?? [];
    const lines = [options.title];

    if (options.message) lines.push(options.message);
    if (options.facts?.length) {
      lines.push(options.facts.map((f) => `${f.label} ${f.value}`).join(' / '));
    }
    if (items.length > 0) {
      lines.push('', ...items.slice(0, max).map((name, i) => deps.plainListItem(name, i)));
      if (items.length > max) lines.push(`…ほか${items.length - max}件`);
    }
    if (options.note) lines.push('', options.note);
    lines.push('', '実行しますか？');

    return lines.join('\n');
  };

  /** ダイアログの中身を組み立て、確定ボタンとキャンセルボタンを返す */
  const buildDialog = (
    dialog: HTMLDialogElement,
    options: ConfirmOptions<I>
  ): { confirmBtn: HTMLButtonElement; cancelBtn: HTMLButtonElement } => {
    dialog.className = `${p}-dialog ${p}-scope`;
    dialog.dataset.tone = options.tone;
    dialog.replaceChildren();

    const titleId = `${deps.id}-title`;
    const messageId = `${deps.id}-message`;
    dialog.setAttribute('aria-labelledby', titleId);

    // 見出し
    const head = document.createElement('div');
    head.className = `${p}-dialog__head`;

    const badge = document.createElement('div');
    badge.className = `${p}-dialog__badge`;
    badge.appendChild(deps.createIcon(options.icon, 20));

    const titles = document.createElement('div');
    const title = document.createElement('h2');
    title.id = titleId;
    title.className = `${p}-dialog__title`;
    title.textContent = options.title;
    titles.appendChild(title);

    if (options.message) {
      const message = document.createElement('p');
      message.id = messageId;
      message.className = `${p}-dialog__message`;
      message.textContent = options.message;
      titles.appendChild(message);
      dialog.setAttribute('aria-describedby', messageId);
    } else {
      dialog.removeAttribute('aria-describedby');
    }

    head.append(badge, titles);

    // 本文（要点・一覧・注意書き）
    const body = document.createElement('div');
    body.className = `${p}-dialog__body`;

    if (options.facts?.length) {
      const facts = document.createElement('div');
      facts.className = cls.facts;
      for (const fact of options.facts) {
        const tile = document.createElement('div');
        tile.className = `${p}-fact`;
        if (fact.emphasis) tile.dataset.emphasis = 'true';

        const value = document.createElement('span');
        value.className = `${p}-fact__value ${p}-num`;
        value.textContent = fact.value;

        const label = document.createElement('span');
        label.className = `${p}-fact__label`;
        label.textContent = fact.label;

        tile.append(value, label);
        facts.appendChild(tile);
      }
      body.appendChild(facts);
    }

    const items = options.items ?? [];
    if (items.length > 0) {
      const max = options.maxItems ?? deps.defaultMaxItems;

      if (cls.listHead && deps.listHeadText) {
        const listHead = document.createElement('div');
        listHead.className = cls.listHead;
        listHead.textContent = deps.listHeadText;
        body.appendChild(listHead);
      }

      const list = document.createElement('ol');
      list.className = `${p}-dialog__list`;
      list.setAttribute('aria-label', '対象の商品（処理する順）');

      for (const name of items.slice(0, max)) {
        const li = document.createElement('li');
        li.textContent = deps.emptyItemName ? name || deps.emptyItemName : name;
        list.appendChild(li);
      }
      if (items.length > max) {
        const more = document.createElement('li');
        more.className = `${p}-dialog__more`;
        more.textContent = `ほか ${items.length - max}件`;
        list.appendChild(more);
      }
      body.appendChild(list);
    }

    if (options.note) {
      const note = document.createElement('div');
      note.className = cls.note;
      note.appendChild(deps.createIcon('warning', 14));
      const text = document.createElement('span');
      text.textContent = options.note;
      note.appendChild(text);
      body.appendChild(note);
    }

    // ボタン
    const foot = document.createElement('div');
    foot.className = `${p}-dialog__foot`;

    const cancelBtn = deps.decorateButton(document.createElement('button'), {
      label: options.cancelLabel ?? 'キャンセル',
      variant: 'secondary',
    });
    if (deps.autofocusCancel) cancelBtn.autofocus = true;

    const confirmBtn = deps.decorateButton(document.createElement('button'), {
      label: options.confirmLabel,
      variant: options.tone === 'danger' ? 'danger-solid' : 'primary',
      icon: options.icon,
    });

    foot.append(cancelBtn, confirmBtn);
    dialog.append(head, body, foot);

    return { confirmBtn, cancelBtn };
  };

  const fallback = (options: ConfirmOptions<I>): boolean => window.confirm(toPlainText(options));

  /** `close-event` 方式: `<dialog>` の close イベントで答えを確定する */
  const runCloseEventMode = (options: ConfirmOptions<I>): Promise<boolean> => {
    // 前のダイアログが残っていれば取り下げる（その呼び出しはキャンセル扱いで終わる）
    const previous = document.getElementById(deps.id);
    if (previous instanceof HTMLDialogElement && previous.open) {
      previous.close('cancel');
    }
    previous?.remove();

    const dialog = document.createElement('dialog');
    if (typeof dialog.showModal !== 'function') {
      return Promise.resolve(fallback(options));
    }

    dialog.id = deps.id;
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
        deps.warn('確認ダイアログを表示できないため window.confirm に切り替えます', e);
        dialog.remove();
        resolve(fallback(options));
      }
    });
  };

  /** 表示中のダイアログの答えを確定させる関数（次のダイアログを出すときにキャンセルで閉じるため） */
  let settleCurrent: ((confirmed: boolean) => void) | null = null;

  /** `click` 方式: ボタンのクリックでその場で確定する */
  const runClickMode = (options: ConfirmOptions<I>): Promise<boolean> => {
    // 前のダイアログが残っていれば取り下げる（その呼び出しはキャンセル扱いで終わる）
    settleCurrent?.(false);
    document.getElementById(deps.id)?.remove();

    const dialog = document.createElement('dialog');
    if (typeof dialog.showModal !== 'function') {
      return Promise.resolve(fallback(options));
    }

    dialog.id = deps.id;
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
        deps.warn('確認ダイアログを表示できないため window.confirm に切り替えます', e);
        settled = true;
        settleCurrent = null;
        dialog.remove();
        resolve(fallback(options));
      }
    });
  };

  return (options: ConfirmOptions<I>): Promise<boolean> => {
    deps.ensureTheme();
    return deps.settleMode === 'click' ? runClickMode(options) : runCloseEventMode(options);
  };
}
