import { CLASS_NAME } from '../infra/constants';
import { ensureTheme } from './theme';

/**
 * 一覧の各行の左端に置く「チェックボックス列」。
 *
 * - **商品リンクの外に置く。** 下書き一覧は商品リンク（a）の内側にチェックボックスを
 *   差し込んでいたため、少しずれて押すと編集ページへ遷移していた。行（li）の左に余白を取り、
 *   その余白に列を重ねる。メルカリ側の要素は動かさない（React が管理している要素を
 *   付け替えると再描画で壊れるため）。
 * - **列そのものを押しても何も起きない。** チェックボックスやボタン以外の場所で起きた
 *   クリック・タップは、ここで止めてページ側へ伝えない。
 */

/** 列で止めるイベント（遷移や選択につながるもの） */
const SWALLOWED_EVENTS = ['click', 'auxclick', 'mousedown', 'mouseup', 'pointerdown', 'touchstart'];

/**
 * 行にチェックボックス列を用意する（既にあればそれを返す）
 *
 * @param li 対象の行
 * @param wide 「ここまで」ボタンも置くので幅を広く取るか
 * @returns チェックボックス列
 */
export function ensureRowGutter(li: HTMLLIElement, wide: boolean): HTMLDivElement {
  ensureTheme();

  li.classList.add(CLASS_NAME.ROW);
  if (wide) li.dataset.mdpGutter = 'wide';

  const existing = Array.from(li.children).find((child) =>
    child.classList.contains(CLASS_NAME.ROW_GUTTER)
  );
  if (existing instanceof HTMLDivElement) return existing;

  const gutter = document.createElement('div');
  gutter.className = CLASS_NAME.ROW_GUTTER;

  for (const type of SWALLOWED_EVENTS) {
    gutter.addEventListener(type, (e) => {
      // 中のチェックボックス・ボタンは自分で処理する。列の余白で起きたものだけ止める
      if (e.target !== gutter) return;
      e.preventDefault();
      e.stopPropagation();
    });
  }

  li.insertBefore(gutter, li.firstChild);
  return gutter;
}
