import { ID_NAME } from '../infra/constants';
import { warn } from '../infra/logger';
import { decorateButton } from './components';
import { createIcon, IconName } from './icons';
import { ensureTheme } from './theme';
import { createConfirmDialog } from '@fleamarket/core/confirm-dialog';
import type { ConfirmOptions as CoreConfirmOptions } from '@fleamarket/core/confirm-dialog';

/**
 * 取り消せない操作の前に出す確認ダイアログ。
 *
 * - **既定のフォーカスは「キャンセル」。** Enter の押しっぱなしや連打で実行に進ませない。
 * - Esc・背景のクリックはキャンセル扱い。
 * - `<dialog>` を出せない環境では `window.confirm` に切り替える。**確認を省いて進むことはしない。**
 *
 * 組み立てと答えの待ち方は共有部品 `@fleamarket/core/confirm-dialog` にある。ここでは
 * この拡張の id・接頭辞 `mdp`・一覧の既定の上限（10）・平文の行頭（`・`）・キャンセルへの
 * autofocus・`close` イベントで答えを確定する方式を注入する。
 */

export type { ConfirmFact } from '@fleamarket/core/confirm-dialog';

/** 確認ダイアログの内容 */
export type ConfirmOptions = CoreConfirmOptions<IconName>;

const confirm = createConfirmDialog<IconName>({
  id: ID_NAME.CONFIRM_DIALOG,
  prefix: 'mdp',
  classNames: { facts: 'mdp-dialog__facts', note: 'mdp-dialog__note' },
  defaultMaxItems: 10,
  plainListItem: (name) => `・${name}`,
  autofocusCancel: true,
  settleMode: 'close-event',
  createIcon,
  decorateButton,
  ensureTheme,
  warn,
});

/**
 * 確認ダイアログを出し、利用者の答えを待つ
 *
 * @param options 確認ダイアログの内容
 * @returns 実行してよければ true
 */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  return confirm(options);
}
