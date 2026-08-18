import { CLASS_NAME } from '../infra/constants';
import { ListItem } from '../logic/item-collector';
import { ensureTheme } from './theme';
import { rangeBetween } from '@fleamarket/core/range';

/**
 * チェックボックスの状態変更コールバック
 */
export type CheckboxChangeHandler = (item: ListItem, checked: boolean) => void;

/** Shift を押しながらの選択で、範囲の起点にするチェックボックス */
let rangeAnchor: HTMLInputElement | null = null;

/** ページ内のチェックボックスを表示順（文書順）に返す */
function allCheckboxes(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>(`.${CLASS_NAME.BULK_CHECKBOX}`));
}

/**
 * Shift を押しながら押したとき、起点からそこまでの間を同じ状態にそろえる。
 * 変更は 1 件ずつ change を発火させて通常の選択と同じ経路に流す（選択順は表示順になる）。
 * 範囲の決め方（起点を含み押した行を含まない、起点から押した側への順）は
 * 共有部品 `@fleamarket/core/range` の `rangeBetween`。
 */
function applyRange(target: HTMLInputElement): void {
  if (!rangeAnchor || !rangeAnchor.isConnected || rangeAnchor === target) return;
  // 押した側がこれから向かう状態（click の時点で既に切り替わっている）
  const checked = target.checked;
  // 起点から押した側へ向かう順（押した行は含まない）に処理し、選択順を表示順にそろえる
  for (const box of rangeBetween(allCheckboxes(), rangeAnchor, target)) {
    if (box.disabled || box.checked === checked) continue;
    box.checked = checked;
    box.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function createPick(item: ListItem, onChange: CheckboxChangeHandler): HTMLLabelElement {
  const pick = document.createElement('label');
  pick.className = CLASS_NAME.ROW_PICK;
  pick.title = 'クリックで選択（Shift を押しながらで範囲をまとめて選択）';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = CLASS_NAME.BULK_CHECKBOX;
  checkbox.dataset.itemId = item.id;
  checkbox.setAttribute('aria-label', item.title ? `「${item.title}」を選択` : '商品を選択');

  const order = document.createElement('span');
  order.className = CLASS_NAME.ROW_ORDER;
  order.setAttribute('aria-hidden', 'true');

  // ラベルの余白を押したときはブラウザが input へ click を送り直す。その click に
  // Shift の状態が載る保証は無いので、ラベル側で受けた時点の状態を覚えておく。
  let shiftFromLabel = false;
  pick.addEventListener('click', (e) => {
    if (e.target !== checkbox) shiftFromLabel = e.shiftKey;
  });
  checkbox.addEventListener('click', (e) => {
    if (e.shiftKey || shiftFromLabel) applyRange(checkbox);
    shiftFromLabel = false;
    rangeAnchor = checkbox;
  });
  checkbox.addEventListener('change', () => {
    item.el.classList.toggle(CLASS_NAME.ROW_SELECTED, checkbox.checked);
    onChange(item, checkbox.checked);
  });

  pick.append(checkbox, order);
  return pick;
}

/**
 * 各商品要素の先頭にチェックボックスを追加し、追加した件数を返す。
 * 既にチェックボックスが付与されている要素はスキップするため、
 * 一覧が再描画されるたびに何度呼んでも安全（増えた分だけ付与される）。
 *
 * ラクマ側の要素は動かさず、こちらの部品を先頭に差し込むだけにする。
 */
export function addCheckboxes(items: ListItem[], onChange: CheckboxChangeHandler): number {
  let added = 0;

  for (const item of items) {
    if (item.el.querySelector(`.${CLASS_NAME.BULK_CHECKBOX}`)) {
      continue;
    }
    ensureTheme();

    // deal-itemはflexレイアウト（media）のため先頭に挿入する
    item.el.style.display = 'flex';
    item.el.classList.add(CLASS_NAME.ROW);
    item.el.insertBefore(createPick(item, onChange), item.el.firstChild);
    added++;
  }

  return added;
}

/**
 * 各行の選択順の数字を、選択順の ID 列に合わせて付け直す
 */
export function renderSelectionOrder(orderedIds: string[]): void {
  const position = new Map(orderedIds.map((id, index) => [id, index + 1]));
  for (const box of allCheckboxes()) {
    const order = box.parentElement?.querySelector<HTMLElement>(`.${CLASS_NAME.ROW_ORDER}`);
    if (!order) continue;
    const n = position.get(box.dataset.itemId ?? '');
    const text = n === undefined ? '' : String(n);
    if (order.textContent !== text) order.textContent = text;
  }
}

/**
 * すべてのチェックボックスを外す（change は発火させない。呼び出し側で選択状態をまとめて消す）
 */
export function uncheckAll(): number {
  let cleared = 0;
  for (const box of allCheckboxes()) {
    if (!box.checked) continue;
    box.checked = false;
    box.closest(`.${CLASS_NAME.ROW}`)?.classList.remove(CLASS_NAME.ROW_SELECTED);
    cleared++;
  }
  rangeAnchor = null;
  return cleared;
}

/**
 * すべてのチェックボックスの有効/無効を切り替える（処理中の誤操作防止）
 */
export function setCheckboxesEnabled(enabled: boolean): void {
  for (const box of allCheckboxes()) {
    box.disabled = !enabled;
    const pick = box.parentElement;
    if (pick) pick.dataset.disabled = enabled ? 'false' : 'true';
  }
}
