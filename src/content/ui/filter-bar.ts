import { ID_NAME } from '../infra/constants';
import { filterManager, FilterType } from '../logic/filter-manager';
import { showToast } from './notification';
import { createIcon, IconName } from './icons';
import { ensureTheme } from './theme';

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
 * フィルターボタンの押下状態を切り替える（見た目は aria-pressed に連動する）
 */
function applyFilterButtonStyles(btn: HTMLButtonElement, isActive: boolean): void {
  btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
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
function createFilterButton(
  id: string,
  label: string,
  icon: IconName,
  filter: FilterType
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.id = id;
  btn.type = 'button';
  btn.className = 'mdp-chip';

  const text = document.createElement('span');
  text.textContent = label;
  btn.append(createIcon(icon, 14), text);
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

  ensureTheme();

  // バーを生成
  const bar = document.createElement('div');
  bar.id = ID_NAME.FILTER_BAR;
  bar.className = 'mdp-filterbar mdp-scope';
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', '出品中の商品の絞り込み');

  const label = document.createElement('span');
  label.className = 'mdp-filterbar__label';
  label.textContent = '絞り込み';

  const likesBtn = createFilterButton(ID_NAME.FILTER_LIKES_BTN, 'いいねあり', 'heart', 'likes');
  const commentsBtn = createFilterButton(
    ID_NAME.FILTER_COMMENTS_BTN,
    'コメントあり',
    'comment',
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
