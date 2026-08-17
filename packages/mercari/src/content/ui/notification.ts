import { ID_NAME } from '../infra/constants';
import { createIcon } from './icons';
import { decorateIconButton } from './components';
import { ensureTheme } from './theme';
import { createToast } from '@fleamarket/core/toast';

/**
 * トースト通知。組み立てと表示時間の制御は共有部品 `@fleamarket/core/toast` にある。
 * ここでは要素の id・接頭辞 `mdp`・「マウスを離したら最初から数え直す」方式を注入し、
 * 従来のシグネチャ（表示時間を呼び出し側が渡す）を保つ。
 */
const toast = createToast({
  id: ID_NAME.TOAST,
  prefix: 'mdp',
  hoverBehavior: 'restart',
  createIcon,
  decorateIconButton,
  ensureTheme,
});

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
  toast(message, type, duration);
}
