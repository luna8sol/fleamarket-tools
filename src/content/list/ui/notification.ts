import { CONFIG, ID_NAME } from '../infra/constants';

type ToastType = 'success' | 'error' | 'info' | 'warning';

const TOAST_COLORS: Record<ToastType, string> = {
  success: '#2e7d32',
  error: '#c62828',
  info: '#1565c0',
  warning: '#ef6c00',
};

/**
 * 画面右下にトースト通知を表示する
 */
export function showToast(message: string, type: ToastType = 'info'): void {
  document.getElementById(ID_NAME.TOAST)?.remove();

  const toast = document.createElement('div');
  toast.id = ID_NAME.TOAST;
  toast.textContent = message;
  Object.assign(toast.style, {
    position: 'fixed',
    right: '16px',
    bottom: '16px',
    zIndex: '10000',
    padding: '10px 16px',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 'bold',
    boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
    backgroundColor: TOAST_COLORS[type],
  });

  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), CONFIG.TOAST_DURATION_MS);
}
