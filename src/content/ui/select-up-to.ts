import { CLASS_NAME } from '../infra/constants';
import { safeQuery, safeQueryAll } from '../../common/dom';
import { warn } from '../infra/logger';
import { selectionManager } from '../logic/selection-manager';
import { showToast } from './notification';
import { createIcon } from './icons';
import { ensureTheme } from './theme';

/**
 * 起点の行を含め、一覧の先頭からそこまでの行をまとめて選択する
 *
 * **起点の行から上へ向かって積む。** 選択した順がそのまま出品順になるため、走査順が結果を変える。
 * すでに選択済みの行は積み直さない（積み直すとその行の順番だけ末尾へ飛ぶ）。
 *
 * 一覧の構造が読めないときは**部分的に選ばず中止する**。範囲を取り違えたまま
 * 選択が入ると、そのまま一括出品の対象になってしまうため。
 *
 * @param li 起点の li（この行自身も選択対象に含む）
 * @returns 新たに選択した件数。中止したときは null
 */
export function selectUpToLi(li: HTMLLIElement): number | null {
  const list = li.closest<HTMLUListElement>('ul');
  if (!list) {
    warn('selectUpToLi: 一覧の ul が見つからないため中止します', li);
    return null;
  }

  const rows = safeQueryAll<HTMLLIElement>('li', list);
  const targetIndex = rows.indexOf(li);
  if (targetIndex < 0) {
    warn('selectUpToLi: 起点の行が一覧内に見つからないため中止します', li);
    return null;
  }

  let added = 0;

  // 下（起点の行）から上へ。この順がそのまま出品順になる
  for (const row of rows.slice(0, targetIndex + 1).reverse()) {
    const checkbox = safeQuery<HTMLInputElement>(`.${CLASS_NAME.BULK_CHECKBOX}`, row);
    const itemId = checkbox?.dataset.itemId;

    if (!checkbox || !itemId) {
      warn('selectUpToLi: チェックボックスが無い行をとばします', row);
      continue;
    }

    // 表示だけ外れている行もあり得るので、選択済みでもチェックは入れ直す
    checkbox.checked = true;

    if (selectionManager.isSelected(itemId)) continue;

    selectionManager.addSelection(itemId);
    added++;
  }

  return added;
}

/**
 * 「ここまで選択」ボタンを生成する
 *
 * li 全体が商品ページへのリンクになっているため、クリックは捕捉段階で止める。
 * 止めないと選択と同時にページ遷移してしまう。
 *
 * @param li 起点の li
 * @param onSelectionChanged 選択が変わったあとの再描画処理
 * @returns 生成したボタン
 */
export function createSelectUpToButton(
  li: HTMLLIElement,
  onSelectionChanged: () => void
): HTMLButtonElement {
  ensureTheme();

  const button = document.createElement('button');
  button.type = 'button';
  button.className = CLASS_NAME.SELECT_UP_TO_BTN;
  button.title = 'この商品から上へ順に、一覧の先頭までまとめて選択します';
  button.setAttribute('aria-label', 'この商品から一覧の先頭までまとめて選択');

  const label = document.createElement('span');
  label.textContent = 'ここまで';
  button.append(createIcon('selectUpTo', 12), label);

  const suppress = (e: Event): void => {
    e.stopImmediatePropagation();
    e.stopPropagation();
    e.preventDefault();
  };

  /** 先頭からこの行までをまとめて選び、結果を知らせる */
  const selectUpTo = (): void => {
    const added = selectUpToLi(li);
    if (added === null) {
      showToast('一覧の構造が読めないため、まとめて選択できませんでした', 'error');
      return;
    }

    onSelectionChanged();

    if (added === 0) {
      showToast('この商品までは選択済みです', 'info');
      return;
    }

    showToast(
      `${added}件を選択しました（選択中 ${selectionManager.getSelectionCount()}件）`,
      'success'
    );
  };

  // click まで待つとリンクの遷移に間に合わないため mousedown で処理する
  button.addEventListener(
    'mousedown',
    (e) => {
      suppress(e);
      selectUpTo();
    },
    true
  );
  // キーボード（Enter / Space）でも押せるようにする。click は握りつぶしているので別に受ける
  button.addEventListener(
    'keydown',
    (e) => {
      if ((e.key !== 'Enter' && e.key !== ' ') || e.repeat) return;
      suppress(e);
      selectUpTo();
    },
    true
  );
  button.addEventListener('click', suppress, true);

  return button;
}
