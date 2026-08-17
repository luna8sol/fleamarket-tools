import { createIcon } from '../../../common/icons';
import { CONFIG, ID_NAME } from '../infra/constants';
import { decorateIconButton } from './components';
import { ensureTheme } from './theme';
import { createToast, ToastType } from '@fleamarket/core/toast';

/**
 * トースト通知。組み立てと表示時間の制御は共有部品 `@fleamarket/core/toast` にある。
 * ここでは要素の id・接頭辞 `rbl`・残り時間のアニメーション用 CSS 変数・
 * 「マウスを離したら残り時間から再開する」方式を注入し、表示時間を種別から決める。
 */
const toast = createToast({
  id: ID_NAME.TOAST,
  prefix: 'rbl',
  durationCssVar: '--rbl-toast-duration',
  hoverBehavior: 'resume',
  createIcon,
  decorateIconButton,
  ensureTheme,
});

/**
 * 画面下中央（ドックの上）にトースト通知を表示する。
 *
 * - 同時に出すのは 1 件だけ（新しいものが前のものを置き換える）。
 * - 失敗・警告は `role="alert"` で読み上げを割り込ませ、表示も長めにする。
 * - マウスを載せている間は消さない（長い文言を読み切れるように）。
 */
export function showToast(message: string, type: ToastType = 'info'): void {
  const duration =
    type === 'error' || type === 'warning'
      ? CONFIG.TOAST_DURATION_LONG_MS
      : CONFIG.TOAST_DURATION_MS;
  toast(message, type, duration);
}
