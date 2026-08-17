/**
 * 注入 UI の共通部品（ボタン・進捗表示）の組み立て（両拡張で共通の骨格）。
 *
 * 見た目は各拡張の theme のクラスで決まる。クラス名の接頭辞（`mdp` / `rbl`）、
 * 定数で管理しているクラス名、アイコンの生成、スタイルの注入は拡張ごとに違うので、
 * `createUiComponents` に注入して、その拡張用の関数一式を作る。
 *
 * 進捗表示は 2 つの拡張で構造が少し違う。ラクマ用は見出しの下に補足行（detail）を持ち、
 * 割合の代わりに任意の文字（counter）を出せる。`classNames.progressDetail` を渡したときだけ
 * 補足行を作り、渡さなければメルカリ用の従来の構造（見出しとバーだけ）になる。
 */

/** ボタンの種類 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-solid';

/** ボタンの装飾内容 */
export interface ButtonSpec<I extends string> {
  label: string;
  variant: ButtonVariant;
  icon?: I;
  size?: 'sm' | 'md';
}

/** 進捗表示の色調 */
export type ProgressTone = 'active' | 'success' | 'warning' | 'danger' | 'idle';

/** 進捗表示に渡す内容 */
export interface ProgressView<I extends string> {
  label: string;
  /** 見出しの下に小さく出す補足。`classNames.progressDetail` が無い拡張では使わない */
  detail?: string;
  /** 0〜1。省略すると終わりの見えない処理として流れる表示にする */
  ratio?: number;
  /** 割合の代わりに右端へ出す文字（「3 / 10」など）。省略時は割合 */
  counter?: string;
  tone: ProgressTone;
  /** 先頭に出すアイコン。省略時、active ならスピナー */
  icon?: I;
}

export interface ComponentClassNames {
  /** クラス名の接頭辞（`mdp` / `rbl`）。`<prefix>-btn` などを組むのに使う */
  prefix: string;
  btnLabel: string;
  progressHead: string;
  progressLabel: string;
  progressPct: string;
  progressBar: string;
  /** 補足行のクラス名。渡したときだけ補足行を作る */
  progressDetail?: string;
  /** 見出しの先頭にあるアイコン・スピナーを探すセレクタ（差し替えのために消す対象） */
  headIconSelector: string;
}

export interface ComponentDeps<I extends string> {
  classNames: ComponentClassNames;
  createIcon: (name: I, size: number) => SVGSVGElement;
  ensureTheme: () => void;
}

export interface UiComponents<I extends string> {
  /**
   * ボタンにアイコンと文言を付け、種類に応じたクラスを当てる。
   * 何度呼んでも同じ結果になる（中身は毎回組み直す）。
   */
  decorateButton(button: HTMLButtonElement, spec: ButtonSpec<I>): HTMLButtonElement;
  /**
   * アイコンだけのボタンにする（閉じるボタンなど）。
   * 文言が無いので、読み上げ用の名前を aria-label と title に入れる。
   */
  decorateIconButton(button: HTMLButtonElement, icon: I, label: string): HTMLButtonElement;
  /** ボタンの文言だけを差し替える（アイコンは残す） */
  setButtonLabel(button: HTMLButtonElement, text: string): void;
  /** ボタンを処理中の見た目にする（押せなくし、アイコンをスピナーにする） */
  setButtonBusy(button: HTMLButtonElement, busy: boolean): void;
  /** 進捗表示の器を作る。既存の ID 付き要素を渡してよい（中身は組み直す） */
  buildProgress<T extends HTMLElement>(element: T): T;
  /** 進捗表示を更新する */
  renderProgress(element: HTMLElement, view: ProgressView<I>): void;
}

export function createUiComponents<I extends string>(deps: ComponentDeps<I>): UiComponents<I> {
  const { classNames: cls, createIcon, ensureTheme } = deps;
  const p = cls.prefix;

  return {
    decorateButton(button: HTMLButtonElement, spec: ButtonSpec<I>): HTMLButtonElement {
      ensureTheme();

      button.type = 'button';
      button.className = [
        `${p}-btn`,
        `${p}-btn--${spec.variant}`,
        spec.size === 'sm' ? `${p}-btn--sm` : '',
      ]
        .filter(Boolean)
        .join(' ');
      button.removeAttribute('style');
      button.replaceChildren();

      if (spec.icon) {
        button.appendChild(createIcon(spec.icon, spec.size === 'sm' ? 14 : 16));
      }

      const label = document.createElement('span');
      label.className = cls.btnLabel;
      label.textContent = spec.label;
      button.appendChild(label);

      return button;
    },

    decorateIconButton(button: HTMLButtonElement, icon: I, label: string): HTMLButtonElement {
      ensureTheme();

      button.type = 'button';
      button.className = `${p}-btn ${p}-btn--ghost ${p}-btn--icon`;
      button.removeAttribute('style');
      button.replaceChildren(createIcon(icon, 16));
      button.setAttribute('aria-label', label);
      button.title = label;
      return button;
    },

    setButtonLabel(button: HTMLButtonElement, text: string): void {
      const label = button.querySelector(`.${cls.btnLabel}`);
      if (label) {
        label.textContent = text;
      } else {
        button.textContent = text;
      }
    },

    setButtonBusy(button: HTMLButtonElement, busy: boolean): void {
      button.disabled = busy;
      if (busy) {
        button.dataset.busy = 'true';
        button.setAttribute('aria-busy', 'true');
      } else {
        delete button.dataset.busy;
        button.removeAttribute('aria-busy');
      }
    },

    buildProgress<T extends HTMLElement>(element: T): T {
      ensureTheme();

      element.className = `${p}-progress`;
      element.removeAttribute('style');
      element.setAttribute('role', 'status');
      element.setAttribute('aria-live', 'polite');
      element.replaceChildren();

      const head = document.createElement('div');
      head.className = cls.progressHead;

      const label = document.createElement('span');
      label.className = cls.progressLabel;

      const pct = document.createElement('span');
      pct.className = `${cls.progressPct} ${p}-num`;

      head.append(label, pct);

      const track = document.createElement('div');
      track.className = `${p}-progress__track`;
      const bar = document.createElement('div');
      bar.className = cls.progressBar;
      track.appendChild(bar);

      if (cls.progressDetail) {
        const detail = document.createElement('div');
        detail.className = cls.progressDetail;
        element.append(head, detail, track);
      } else {
        element.append(head, track);
      }
      return element;
    },

    renderProgress(element: HTMLElement, view: ProgressView<I>): void {
      const head = element.querySelector(`.${cls.progressHead}`);
      const label = element.querySelector(`.${cls.progressLabel}`);
      const pct = element.querySelector(`.${cls.progressPct}`);
      const bar = element.querySelector<HTMLElement>(`.${cls.progressBar}`);
      const detail = cls.progressDetail ? element.querySelector(`.${cls.progressDetail}`) : null;
      if (!head || !label || !pct || !bar) return;
      if (cls.progressDetail && !detail) return;

      element.dataset.tone = view.tone;
      label.textContent = view.label;
      if (detail) {
        detail.textContent = view.detail ?? '';
      }
      element.setAttribute('aria-label', view.detail ? `${view.label} ${view.detail}` : view.label);

      // 先頭のアイコン（またはスピナー）を差し替える
      head.querySelector(cls.headIconSelector)?.remove();
      if (view.icon) {
        head.prepend(createIcon(view.icon, 16));
      } else if (view.tone === 'active') {
        const spinner = document.createElement('span');
        spinner.className = `${p}-spinner`;
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
    },
  };
}
