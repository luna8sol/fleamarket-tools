import { ID_NAME } from '../infra/constants';
import { createIcon } from './icons';
import { decorateIconButton } from './components';
import { ensureTheme } from './theme';

/** 退場アニメーションの長さ（theme.ts の mdp-toast-out と合わせる） */
const LEAVE_ANIMATION_MS = 220;

/**
 * トースト通知を表示
 *
 * - 同時に出すのは 1 件だけ（新しいものが前のものを置き換える）。
 * - 失敗・警告は `role="alert"` で読み上げを割り込ませる。成功・情報は `status`。
 * - マウスを載せている間は消さない（長い文言を読み切れるように）。
 *
 * @param message メッセージ内容（改行はそのまま表示する）
 * @param type 通知タイプ（success, error, info, warning）
 * @param duration 表示時間(ms)
 */
export function showToast(
  message: string,
  type: 'success' | 'error' | 'info' | 'warning' = 'info',
  duration: number = 3000
): void {
  ensureTheme();

  document.getElementById(ID_NAME.TOAST)?.remove();

  const toast = document.createElement('div');
  toast.id = ID_NAME.TOAST;
  toast.className = 'mdp-toast mdp-scope';
  toast.dataset.tone = type;
  toast.setAttribute('role', type === 'error' || type === 'warning' ? 'alert' : 'status');

  const icon = createIcon(type, 18);
  icon.classList.add('mdp-toast__icon');

  const body = document.createElement('div');
  body.className = 'mdp-toast__body';
  body.textContent = message;

  const close = decorateIconButton(document.createElement('button'), 'close', '通知を閉じる');

  toast.append(icon, body, close);
  document.body.appendChild(toast);

  let timer = 0;

  const dismiss = (): void => {
    window.clearTimeout(timer);
    if (!toast.isConnected) return;
    toast.dataset.leaving = 'true';
    window.setTimeout(() => toast.remove(), LEAVE_ANIMATION_MS);
  };

  const schedule = (): void => {
    window.clearTimeout(timer);
    timer = window.setTimeout(dismiss, duration);
  };

  close.addEventListener('click', dismiss);
  toast.addEventListener('mouseenter', () => window.clearTimeout(timer));
  toast.addEventListener('mouseleave', schedule);
  schedule();
}
