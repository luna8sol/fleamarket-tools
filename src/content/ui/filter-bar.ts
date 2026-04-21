import { ID_NAME } from '../infra/constants';
import { filterManager, FilterType } from '../logic/filter-manager';
import { applyFixedStyles } from './bulk-bar-ui';
import { showToast } from './notification';

/**
 * カウントを読み取れずフィルターを解除したときの通知文
 */
const UNREADABLE_COUNT_MESSAGE = 'いいね・コメント数を読み取れないため、フィルターを解除しました';

/**
 * フィルターボタンのIDと対応するフィルター種別
 */
const FILTER_BUTTONS: { id: string; filter: FilterType }[] = [
  { id: ID_NAME.FILTER_LIKES_BTN, filter: 'likes' },
  { id: ID_NAME.FILTER_COMMENTS_BTN, filter: 'comments' },
];

/**
 * フィルターボタンのスタイルをアクティブ状態に応じて切り替える
 */
function applyFilterButtonStyles(btn: HTMLButtonElement, isActive: boolean): void {
  applyFixedStyles(btn, {
    padding: '6px 14px',
    border: '2px solid #ff333a',
    borderRadius: '20px',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer',
    background: isActive ? '#ff333a' : '#fff',
    color: isActive ? '#fff' : '#ff333a',
  });
}

/**
 * 全フィルターボタンの見た目を現在の状態に合わせ直す。
 *
 * カウントが読めないときは押していない側のフィルターも解除されるため、
 * クリックされたボタンだけを塗り直すと、もう片方の見た目が実際の状態とズレる。
 */
function syncFilterButtonStyles(): void {
  for (const { id, filter } of FILTER_BUTTONS) {
    const btn = document.getElementById(id);
    if (btn instanceof HTMLButtonElement) {
      applyFilterButtonStyles(btn, filterManager.isActive(filter));
    }
  }
}

/**
 * フィルター適用後の後始末。ボタンの見た目を合わせ、解除された場合は理由を知らせる。
 *
 * @param applied - FilterManagerがフィルターを適用できたかどうか
 */
function handleApplyResult(applied: boolean): void {
  syncFilterButtonStyles();
  if (!applied) {
    showToast(UNREADABLE_COUNT_MESSAGE, 'warning');
  }
}

/**
 * フィルタートグルボタンを生成する
 */
function createFilterButton(id: string, label: string, filter: FilterType): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.id = id;
  btn.textContent = label;
  applyFilterButtonStyles(btn, filterManager.isActive(filter));

  btn.addEventListener('click', () => {
    handleApplyResult(filterManager.toggle(filter));
  });

  return btn;
}

/**
 * フィルターバーをul要素の直前に描画する。
 * 既にバーが存在しDOMに接続済みの場合は再描画をスキップし、フィルターの再適用のみ行う。
 * ulが変わった場合は自動的にFilterManagerへ通知する。
 *
 * @param ul - 出品中商品リストのul要素
 */
export function renderFilterBar(ul: HTMLUListElement): void {
  // フィルター管理クラスに最新のul要素を伝える
  filterManager.setUl(ul);

  const existing = document.getElementById(ID_NAME.FILTER_BAR);
  if (existing?.isConnected) {
    // バーは健在 → 現在のフィルター状態を新しい li 群に再適用するだけ
    handleApplyResult(filterManager.apply());
    return;
  }
  existing?.remove();

  // バーを生成
  const bar = document.createElement('div');
  bar.id = ID_NAME.FILTER_BAR;
  applyFixedStyles(bar, {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    margin: '8px 0',
    background: '#fff',
    borderRadius: '8px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
    flexWrap: 'wrap',
  });

  const label = document.createElement('span');
  label.textContent = 'フィルター:';
  applyFixedStyles(label, {
    fontWeight: 'bold',
    color: '#555',
    fontSize: '13px',
    marginRight: '4px',
  });

  const likesBtn = createFilterButton(
    ID_NAME.FILTER_LIKES_BTN,
    '❤️ いいねあり',
    'likes'
  );
  const commentsBtn = createFilterButton(
    ID_NAME.FILTER_COMMENTS_BTN,
    '💬 コメントあり',
    'comments'
  );

  bar.appendChild(label);
  bar.appendChild(likesBtn);
  bar.appendChild(commentsBtn);

  // ul の直前に挿入
  ul.parentElement?.insertBefore(bar, ul);

  // 現在のフィルター状態をすぐに適用
  handleApplyResult(filterManager.apply());
}
