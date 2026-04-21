import { ID_NAME } from '../infra/constants';

/**
 * トースト通知を表示
 * @param message メッセージ内容
 * @param type 通知タイプ（success, error, info, warning）
 * @param duration 表示時間(ms)
 */
export function showToast(
  message: string,
  type: 'success' | 'error' | 'info' | 'warning' = 'info',
  duration: number = 3000
): void {
  // 既存のトーストを削除
  const existingToast = document.getElementById(ID_NAME.TOAST);
  if (existingToast) {
    document.body.removeChild(existingToast);
  }

  const toast = document.createElement('div');
  toast.id = ID_NAME.TOAST;
  toast.textContent = message;

  const colors = {
    success: { bg: '#4caf50', color: '#fff' },
    error: { bg: '#f44336', color: '#fff' },
    info: { bg: '#2196f3', color: '#fff' },
    warning: { bg: '#ff9800', color: '#fff' }
  };

  const style = toast.style;
  style.position = 'fixed';
  style.bottom = '20px';
  style.left = '50%';
  style.transform = 'translateX(-50%)';
  style.backgroundColor = colors[type].bg;
  style.color = colors[type].color;
  style.padding = '12px 24px';
  style.borderRadius = '4px';
  style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
  style.zIndex = '10000';
  style.transition = 'opacity 0.3s ease-in-out';

  document.body.appendChild(toast);

  // 表示時間後に消去
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      if (toast.parentNode) {
        document.body.removeChild(toast);
      }
    }, 300);
  }, duration);
}

