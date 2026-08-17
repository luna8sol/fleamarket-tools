/**
 * トースト通知の組み立てと表示時間の制御（両拡張で共通の骨格）。
 *
 * - 同時に出すのは 1 件だけ（新しいものが前のものを置き換える）。
 * - 失敗・警告は `role="alert"` で読み上げを割り込ませる。成功・情報は `status`。
 * - マウスを載せている間は消さない（長い文言を読み切れるように）。
 *
 * 拡張ごとに違うもの（要素の id・クラス名の接頭辞・表示時間を CSS 変数に出すか・
 * マウスを離したあとに最初から数え直すか残り時間から再開するか・アイコンとボタンと
 * テーマの関数）は `createToast` に注入する。表示時間の決め方は呼び出し側（各拡張の
 * `showToast`）に残す。
 */

export type ToastType = 'success' | 'error' | 'info' | 'warning';

/** 退場アニメーションの長さ（各拡張の theme の toast-out と合わせる） */
export const TOAST_LEAVE_ANIMATION_MS = 220;

export interface ToastDeps {
  /** トースト要素の id */
  id: string;
  /** クラス名の接頭辞（`mdp` / `rbl`）。`<prefix>-toast <prefix>-scope` などを組むのに使う */
  prefix: string;
  /** 表示時間を要素の CSS 変数に出すなら、その変数名（残り時間のアニメーション用） */
  durationCssVar?: string;
  /**
   * マウスを離したあとの扱い。
   * - `restart`: 表示時間を最初から数え直す
   * - `resume`: 載せていた時間を差し引いた残り時間から再開する
   */
  hoverBehavior: 'restart' | 'resume';
  createIcon: (name: ToastType | 'close', size: number) => SVGSVGElement;
  decorateIconButton: (
    button: HTMLButtonElement,
    icon: 'close',
    label: string
  ) => HTMLButtonElement;
  ensureTheme: () => void;
}

export type ShowToast = (message: string, type: ToastType, durationMs: number) => void;

export function createToast(deps: ToastDeps): ShowToast {
  const p = deps.prefix;

  return (message: string, type: ToastType, durationMs: number): void => {
    deps.ensureTheme();

    document.getElementById(deps.id)?.remove();

    const toast = document.createElement('div');
    toast.id = deps.id;
    toast.className = `${p}-toast ${p}-scope`;
    toast.dataset.tone = type;
    toast.setAttribute('role', type === 'error' || type === 'warning' ? 'alert' : 'status');
    if (deps.durationCssVar) {
      toast.style.setProperty(deps.durationCssVar, `${durationMs}ms`);
    }

    const icon = deps.createIcon(type, 18);
    icon.classList.add(`${p}-toast__icon`);

    const body = document.createElement('div');
    body.className = `${p}-toast__body`;
    body.textContent = message;

    const close = deps.decorateIconButton(
      document.createElement('button'),
      'close',
      '通知を閉じる'
    );

    toast.append(icon, body, close);
    document.body.appendChild(toast);

    let timer = 0;
    let remaining = durationMs;
    let startedAt = 0;

    const dismiss = (): void => {
      window.clearTimeout(timer);
      if (!toast.isConnected) return;
      toast.dataset.leaving = 'true';
      window.setTimeout(() => toast.remove(), TOAST_LEAVE_ANIMATION_MS);
    };

    if (deps.hoverBehavior === 'resume') {
      const resume = (): void => {
        startedAt = Date.now();
        timer = window.setTimeout(dismiss, remaining);
      };
      const pause = (): void => {
        window.clearTimeout(timer);
        remaining = Math.max(0, remaining - (Date.now() - startedAt));
      };
      close.addEventListener('click', dismiss);
      toast.addEventListener('mouseenter', pause);
      toast.addEventListener('mouseleave', resume);
      resume();
    } else {
      const schedule = (): void => {
        window.clearTimeout(timer);
        timer = window.setTimeout(dismiss, durationMs);
      };
      close.addEventListener('click', dismiss);
      toast.addEventListener('mouseenter', () => window.clearTimeout(timer));
      toast.addEventListener('mouseleave', schedule);
      schedule();
    }
  };
}
