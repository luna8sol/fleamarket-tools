import { ID_NAME, CONFIG } from '../infra/constants';

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
 *
 * @param onRetry - 「再試行」が押されたときに実行する処理
 * @returns {void}
 */
export function showListLoadError(onRetry: () => void): void {
  hideListLoadError();

  const panel = document.createElement('div');
  panel.id = ID_NAME.LIST_LOAD_ERROR;

  const panelStyle = panel.style;
  panelStyle.position = 'fixed';
  panelStyle.top = '50px';
  panelStyle.left = '5px';
  panelStyle.zIndex = String(CONFIG.ZINDEX.CONTROL_PANEL);
  panelStyle.display = 'flex';
  panelStyle.alignItems = 'center';
  panelStyle.gap = '12px';
  panelStyle.maxWidth = '420px';
  panelStyle.padding = '1rem';
  panelStyle.backgroundColor = '#fffbe6';
  panelStyle.border = '2px solid #ff9800';
  panelStyle.borderRadius = '6px';
  panelStyle.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';

  const text = document.createElement('div');

  const message = document.createElement('div');
  message.textContent = LIST_LOAD_ERROR_MESSAGE;
  message.style.fontWeight = 'bold';
  message.style.color = '#d32f2f';

  const hint = document.createElement('div');
  hint.textContent = LIST_LOAD_ERROR_HINT;
  hint.style.marginTop = '4px';
  hint.style.fontSize = '12px';
  hint.style.color = '#555';

  text.appendChild(message);
  text.appendChild(hint);

  const retryBtn = document.createElement('button');
  retryBtn.id = ID_NAME.LIST_LOAD_RETRY_BTN;
  retryBtn.textContent = '再試行';

  const retryStyle = retryBtn.style;
  retryStyle.flex = '0 0 auto';
  retryStyle.padding = '8px 16px';
  retryStyle.background = '#ff333a';
  retryStyle.color = '#fff';
  retryStyle.border = 'none';
  retryStyle.borderRadius = '4px';
  retryStyle.fontWeight = 'bold';
  retryStyle.cursor = 'pointer';

  retryBtn.addEventListener('click', () => {
    hideListLoadError();
    onRetry();
  });

  panel.appendChild(text);
  panel.appendChild(retryBtn);

  document.body.appendChild(panel);
}

/**
 * リストの読み込み失敗パネルが出ていれば取り除く
 * @returns {void}
 */
export function hideListLoadError(): void {
  document.getElementById(ID_NAME.LIST_LOAD_ERROR)?.remove();
}
