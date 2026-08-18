import { ID_NAME } from '../infra/constants';
import { decorateButton } from './components';
import { createIcon } from './icons';
import { ensureTheme } from './theme';

/**
 * リストを読み込めなかったときに出す本文
 */
const LIST_LOAD_ERROR_MESSAGE = '商品リストを読み込めませんでした';

/**
 * 本文の下に添える補足。読み込み中との区別と、次に取れる行動を示す。
 */
const LIST_LOAD_ERROR_HINT =
  'メルカリ側の読み込みが終わっていないか、ページの構成が変わった可能性があります。';

/**
 * リストの読み込み失敗を知らせるパネルを表示する。
 *
 * リストを読めていない状態では一括操作バーを出さない（対象を把握できないまま
 * 実操作のボタンを置かないため）。そのぶん画面上は何も出ず、拡張機能が壊れたのか
 * まだ読み込み中なのかをユーザーが区別できないので、専用のパネルで知らせる。
 * 置き場所は一括操作バーと同じ画面下にする（バーが出るはずの場所で理由を伝える）。
 *
 * @param onRetry - 「再試行」が押されたときに実行する処理
 * @returns {void}
 */
export function showListLoadError(onRetry: () => void): void {
  hideListLoadError();
  ensureTheme();

  // 対象を把握できないまま実操作のボタンを残さない（このファイル冒頭のコメント参照）。
  // 一度リストを掴んだ後に見失った場合、一括操作バーが残っているのはこの経路だけなので、ここで撤去する。
  document.getElementById(ID_NAME.BULK_RELIST_CONTAINER)?.remove();

  const panel = document.createElement('div');
  panel.id = ID_NAME.LIST_LOAD_ERROR;
  panel.className = 'mdp-alert mdp-scope';
  panel.setAttribute('role', 'alert');

  const icon = document.createElement('span');
  icon.className = 'mdp-alert__icon';
  icon.appendChild(createIcon('warning', 18));

  const text = document.createElement('div');
  text.className = 'mdp-alert__text';

  const message = document.createElement('div');
  message.className = 'mdp-alert__title';
  message.textContent = LIST_LOAD_ERROR_MESSAGE;

  const hint = document.createElement('div');
  hint.className = 'mdp-alert__hint';
  hint.textContent = LIST_LOAD_ERROR_HINT;

  text.append(message, hint);

  const retryBtn = decorateButton(document.createElement('button'), {
    label: '再試行',
    variant: 'primary',
    icon: 'retry',
  });
  retryBtn.id = ID_NAME.LIST_LOAD_RETRY_BTN;

  retryBtn.addEventListener('click', () => {
    hideListLoadError();
    onRetry();
  });

  panel.append(icon, text, retryBtn);
  document.body.appendChild(panel);
}

/**
 * リストの読み込み失敗パネルが出ていれば取り除く
 * @returns {void}
 */
export function hideListLoadError(): void {
  document.getElementById(ID_NAME.LIST_LOAD_ERROR)?.remove();
}
