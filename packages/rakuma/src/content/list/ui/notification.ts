import { createIcon } from '../../../common/icons';
import { CONFIG, ID_NAME } from '../infra/constants';
import { decorateIconButton } from './components';
import { ensureTheme } from './theme';

type ToastType = 'success' | 'error' | 'info' | 'warning';

/** 退場アニメーションの長さ（theme.ts の rbl-toast-out と合わせる） */
const LEAVE_ANIMATION_MS = 220;

/**
 * 画面下中央（ドックの上）にトースト通知を表示する。
 *
 * - 同時に出すのは 1 件だけ（新しいものが前のものを置き換える）。
 * - 失敗・警告は `role="alert"` で読み上げを割り込ませ、表示も長めにする。
 * - マウスを載せている間は消さない（長い文言を読み切れるように）。
 */
export function showToast(message: string, type: ToastType = 'info'): void {
  ensureTheme();

  document.getElementById(ID_NAME.TOAST)?.remove();

  const duration =
    type === 'error' || type === 'warning'
      ? CONFIG.TOAST_DURATION_LONG_MS
      : CONFIG.TOAST_DURATION_MS;

  const toast = document.createElement('div');
  toast.id = ID_NAME.TOAST;
  toast.className = 'rbl-toast rbl-scope';
  toast.dataset.tone = type;
  toast.setAttribute('role', type === 'error' || type === 'warning' ? 'alert' : 'status');
  toast.style.setProperty('--rbl-toast-duration', `${duration}ms`);

  const icon = createIcon(type, 18);
  icon.classList.add('rbl-toast__icon');

  const body = document.createElement('div');
  body.className = 'rbl-toast__body';
  body.textContent = message;

  const close = decorateIconButton(document.createElement('button'), 'close', '通知を閉じる');

  toast.append(icon, body, close);
  document.body.appendChild(toast);

  let timer = 0;
  let remaining = duration;
  let startedAt = 0;

  const dismiss = (): void => {
    window.clearTimeout(timer);
    if (!toast.isConnected) return;
    toast.dataset.leaving = 'true';
    window.setTimeout(() => toast.remove(), LEAVE_ANIMATION_MS);
  };

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
}
