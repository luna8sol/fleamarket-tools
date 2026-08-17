import { createIcon, IconName } from '../../../common/icons';
import { warn } from '../../../common/logger';
import { CONFIG, ID_NAME } from '../infra/constants';
import { decorateButton } from './components';
import { ensureTheme } from './theme';
import { createConfirmDialog } from '@fleamarket/core/confirm-dialog';
import type { ConfirmFact } from '@fleamarket/core/confirm-dialog';

/**
 * 取り消せない操作の前に出す確認ダイアログ（window.confirm の置き換え）。
 *
 * - **既定のフォーカスは「キャンセル」。** Enter の押しっぱなしや連打で実行に進ませない。
 * - Esc・背景のクリックはキャンセル扱い。
 * - **`<dialog>` を出せない環境では `window.confirm` に切り替える。確認を省いて進むことはしない。**
 * - 件数だけでなく処理順の商品名も並べる。選んだつもりの対象と実際の対象のずれに気づけるように。
 *
 * 組み立てと答えの待ち方は共有部品 `@fleamarket/core/confirm-dialog` にある。ここでは
 * この拡張の id・接頭辞 `rbl`・一覧の上限（`CONFIG.CONFIRM_MAX_ITEMS`）・平文の行頭（番号）・
 * 一覧の見出し「処理する順番」・空の商品名の代わり・ボタンのクリックでその場で答えを確定する
 * 方式を注入する。
 */

export type { ConfirmFact };

/** 確認ダイアログの内容 */
export interface ConfirmOptions {
  title: string;
  message?: string;
  facts?: ConfirmFact[];
  /** 対象の一覧（処理順に並べる） */
  items?: string[];
  /** 取り消せないことなどの注意書き */
  note?: string;
  confirmLabel: string;
  tone: 'primary' | 'danger';
  icon: IconName;
}

const confirm = createConfirmDialog<IconName>({
  id: ID_NAME.CONFIRM_DIALOG,
  prefix: 'rbl',
  classNames: { facts: 'rbl-facts', note: 'rbl-note', listHead: 'rbl-dialog__list-head' },
  defaultMaxItems: CONFIG.CONFIRM_MAX_ITEMS,
  plainListItem: (name, i) => `${i + 1}. ${name}`,
  listHeadText: '処理する順番',
  emptyItemName: '（商品名なし）',
  autofocusCancel: false,
  settleMode: 'click',
  createIcon,
  decorateButton,
  ensureTheme,
  warn,
});

/**
 * 確認ダイアログを出し、利用者の答えを待つ。実行してよければ true。
 *
 * 答えはボタンのクリックで直接確定させる。`close` イベントは描画の都合で遅れて
 * 届くことがあり、それを待つと承諾してから処理が始まるまでに間が空くため。
 * `close` は Esc など、ボタン以外で閉じられたときの受け皿として使う。
 */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  return confirm(options);
}
