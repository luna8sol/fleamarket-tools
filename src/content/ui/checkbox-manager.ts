import { CLASS_NAME, COMPOSITE_SELECTOR, SELECTOR } from '../infra/constants';
import { safeQuery, safeGetAttr } from '../../common/dom';
import { warn, debugMethodStart, debugMethodEnd } from '../infra/logger';
import { selectionManager } from '../logic/selection-manager';
import { createOrderSpan } from './order';
import { getDraftItems, DraftItem } from './list';
import { updateDraftCount } from './bulk-bar-core';
import { updateOrderDisplay } from '../ui/order-display';
import { createSelectUpToButton } from './select-up-to';
import { ensureTheme } from './theme';
import { ensureRowGutter } from './row-gutter';

// チェックボックスのトグル処理済みフラグを管理する WeakMap
const toggleHandledMap = new WeakMap<HTMLInputElement, boolean>();

/** Shift を押しながらの選択で、範囲の起点にするチェックボックス（最後に押したもの） */
let rangeAnchor: HTMLInputElement | null = null;

/**
 * 範囲選択の起点を忘れる（選択をまとめて解除したときなど）
 */
export function resetRangeAnchor(): void {
  rangeAnchor = null;
}

/**
 * 行が画面に出ているか（絞り込みで隠した行は display: none になる）
 *
 * @param checkbox 行のチェックボックス
 * @returns 出ていれば true
 */
function isRowVisible(checkbox: HTMLInputElement): boolean {
  const row = checkbox.closest('li') ?? checkbox;
  return row.getClientRects().length > 0;
}

/**
 * Shift を押しながら押したとき、起点からそこまでの行を押した行と同じ状態にそろえる
 *
 * - **押した行より先に、起点の側から順に処理する。** 選んだ順がそのまま出品順になるため、
 *   起点 → 押した行 の並びで積まれるようにする（押した行は呼び出し側が最後に切り替える）。
 * - **押した行のチェックは、範囲を処理し終えるまで入れない。** 途中の再描画（順番表示）は
 *   「チェック済みなのに選択に無い行」を見つけると末尾に足すため、先に入れると押した行が
 *   範囲の途中に割り込んでしまう。
 * - **画面に出ていない行は対象にしない。** 絞り込みで隠した商品が、見えないまま
 *   一括出品・再出品の対象に入らないようにするため。
 * - 起点と押した行が同じ一覧に無いとき（一覧が作り直された等）は何もしない。
 * - 変更は 1 件ずつ change を発火させ、通常の選択と同じ経路（選択管理・順番表示・件数）に流す。
 *
 * @param target 押したチェックボックス（まだ切り替える前）
 * @param checked 押した行がこれから向かう状態。範囲の行もこの状態にそろえる
 */
function applyRange(target: HTMLInputElement, checked: boolean): void {
  const anchor = rangeAnchor;
  if (!anchor || !anchor.isConnected || anchor === target) return;

  const list = target.closest('ul');
  if (!list || !list.contains(anchor)) return;

  const boxes = Array.from(
    list.querySelectorAll<HTMLInputElement>(COMPOSITE_SELECTOR.BULK_CHECKBOX_INPUT)
  );
  const from = boxes.indexOf(anchor);
  const to = boxes.indexOf(target);
  if (from < 0 || to < 0) return;

  const range = from < to ? boxes.slice(from, to) : boxes.slice(to + 1, from + 1).reverse();
  for (const box of range) {
    if (box.disabled || box.checked === checked || !isRowVisible(box)) continue;
    box.checked = checked;
    box.dispatchEvent(new Event('change', { bubbles: false }));
  }
}

// 共通のチェックボックス生成関数（クリック抑止＋手動トグル）
function createBulkCheckboxElement(
  onChange: (this: HTMLInputElement, ev: Event) => void
): HTMLInputElement {
  const startTime = performance.now();
  debugMethodStart('createBulkCheckboxElement');

  ensureTheme();

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = CLASS_NAME.BULK_CHECKBOX;
  checkbox.setAttribute('aria-label', '一括操作の対象にする');
  checkbox.title = 'クリックで選択（Shift を押しながらで、前に押した行からここまでをまとめて選択）';
  checkbox.style.position = 'relative';
  checkbox.style.zIndex = '99999';
  checkbox.style.pointerEvents = 'auto';
  toggleHandledMap.set(checkbox, false);

  // shift: Shift を押しながらなら、起点からここまでの範囲も同じ状態にそろえる
  const toggleAndChange = (el: HTMLInputElement, shift: boolean): void => {
    const next = !el.checked;
    if (shift) applyRange(el, next);
    el.checked = next;
    const ev = new Event('change', { bubbles: false });
    el.dispatchEvent(ev);
    rangeAnchor = el;
  };

  const onPointerDown = (e: MouseEvent | TouchEvent): void => {
    e.stopImmediatePropagation();
    e.stopPropagation();
    e.preventDefault();
    if (!toggleHandledMap.get(checkbox)) {
      toggleHandledMap.set(checkbox, true);
      toggleAndChange(checkbox, e.shiftKey);
    }
  };
  checkbox.addEventListener('mousedown', onPointerDown, true);
  checkbox.addEventListener('touchstart', onPointerDown, true);

  const onPointerUp = (e: Event): void => {
    e.stopImmediatePropagation();
    e.stopPropagation();
    e.preventDefault();
    toggleHandledMap.set(checkbox, false);
  };
  checkbox.addEventListener('mouseup', onPointerUp, true);
  checkbox.addEventListener('touchend', onPointerUp, true);

  // キーボード（Space）でも切り替えられるようにする。
  // click を握りつぶしているため、ブラウザ標準の Space による切り替えは効かない。
  checkbox.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== ' ' || e.repeat) return;
      e.stopImmediatePropagation();
      e.stopPropagation();
      e.preventDefault();
      toggleAndChange(checkbox, e.shiftKey);
    },
    true
  );

  // クリックは完全抑止（手動トグルで一貫）
  checkbox.addEventListener(
    'click',
    (e) => {
      e.stopImmediatePropagation();
      e.stopPropagation();
      e.preventDefault();
      return false;
    },
    true
  );

  // changeでコールバック実行
  checkbox.addEventListener('change', function (this: HTMLInputElement, e: Event) {
    e.stopPropagation();
    onChange.call(this, e);
  });

  const duration = Math.round(performance.now() - startTime);
  debugMethodEnd('createBulkCheckboxElement', { elementCreated: true }, duration);

  return checkbox;
}

/**
 * 「ここまで選択」ボタンを行に付ける
 *
 * すでに付いている行には何もしない。一覧は再描画のたびに同じ li を見に来るため。
 *
 * @param li 対象の li
 * @param checkbox 付与済みのチェックボックス（この直後にボタンを置く）
 * @param onSelectionChanged まとめて選択したあとの再描画処理
 */
function ensureSelectUpToButton(
  li: HTMLLIElement,
  checkbox: HTMLInputElement,
  onSelectionChanged: () => void
): void {
  if (safeQuery(`.${CLASS_NAME.SELECT_UP_TO_BTN}`, li)) return;
  if (!checkbox.parentNode) return;

  checkbox.insertAdjacentElement('afterend', createSelectUpToButton(li, onSelectionChanged));
}

// 共通のID推定ヘルパー
function deriveItemIdFromLi(li: HTMLLIElement, type: 'drafts' | 'listings'): string | undefined {
  const aSel = type === 'listings' ? SELECTOR.ITEM_LINK : SELECTOR.DRAFT_ITEM;
  const aTag = safeQuery<HTMLAnchorElement>(aSel, li);
  return aTag ? safeGetAttr(aTag, 'href') ?? undefined : undefined;
}

// 統一実装（DRAFTS/LISTINGS共通）
function attachCheckboxInternal(
  li: HTMLLIElement,
  onChange: (id: string, checked: boolean) => void,
  options: { type: 'drafts' | 'listings'; itemId?: string; withOrder?: boolean; withSelectUpTo?: boolean }
): HTMLInputElement | null {
  const startTime = performance.now();
  debugMethodStart('attachCheckboxInternal', { liTagName: li?.tagName, options });

  if (!li) {
    debugMethodEnd('attachCheckboxInternal', { result: null, reason: 'li element is null' });
    return null;
  }

  // すでにチェックボックスが存在するか確認
  const existingCheckbox = safeQuery(`.${CLASS_NAME.BULK_CHECKBOX}`, li);
  if (existingCheckbox) {
    const attached = existingCheckbox as HTMLInputElement;
    const attachedId = attached.dataset.itemId;

    // 列ごと失われた行（再描画で li の先頭が作り直された場合など）は列に戻す
    const gutter = ensureRowGutter(li, options.withSelectUpTo === true);
    if (attached.parentElement !== gutter) {
      gutter.prepend(attached);
    }

    // チェックボックスだけ残ってボタンが失われた行を取りこぼさない
    if (options.withSelectUpTo && attachedId) {
      ensureSelectUpToButton(li, attached, () => onChange(attachedId, true));
    }

    debugMethodEnd('attachCheckboxInternal', { result: 'existing checkbox', alreadyAttached: true });
    return attached;
  }

  // ID決定（優先: 引数 -> DOM推定）
  const resolvedId = options.itemId ?? deriveItemIdFromLi(li, options.type);
  if (!resolvedId) {
    warn('itemId could not be resolved for li:', li);
    debugMethodEnd('attachCheckboxInternal', { result: null, reason: 'could not resolve itemId' });
    return null;
  }

  const checkbox = createBulkCheckboxElement(function (this: HTMLInputElement) {
    const id = this.dataset.itemId || resolvedId;
    if (!id) {
      warn('itemId missing on change for li:', li);
      return;
    }
    onChange(id, this.checked);
  });

  // 統一: datasetに必ず設定
  checkbox.dataset.itemId = resolvedId;

  // 行の左端のチェックボックス列に置く（商品リンクの外なので、押し損じても遷移しない）
  const gutter = ensureRowGutter(li, options.withSelectUpTo === true);
  gutter.appendChild(checkbox);

  // オプション: 並び順表示もここで付与可能
  if (options.withOrder) {
    gutter.appendChild(createOrderSpan());
  }

  // まとめて選択したあとの再描画は、起点の行の変更として1回だけ呼び出し元に伝える
  // （選んだ行ごとに伝えると、行数分だけ一覧全体の再描画が走る）
  if (options.withSelectUpTo) {
    ensureSelectUpToButton(li, checkbox, () => onChange(resolvedId, true));
  }

  const duration = Math.round(performance.now() - startTime);
  debugMethodEnd('attachCheckboxInternal', {
    success: true,
    itemId: resolvedId,
    type: options.type,
    withOrder: options.withOrder,
    withSelectUpTo: options.withSelectUpTo
  }, duration);

  return checkbox;
}

/**
 * 指定したDraftItemにチェックボックスと順番表示用spanを追加（DRAFTS向け）
 * 統一実装に委譲
 */
export function addCheckboxAndOrderToLi(item: DraftItem, updateOrder: () => void): void {
  const startTime = performance.now();
  debugMethodStart('addCheckboxAndOrderToLi', { itemId: item.id });

  const { li, id } = item;
  if (!li) {
    debugMethodEnd('addCheckboxAndOrderToLi', { result: 'aborted', reason: 'li element is null' });
    return;
  }

  const checkboxChangeHandler = (resolvedId: string, checked: boolean): void => {
    if (checked) {
      selectionManager.addSelection(resolvedId);
    } else {
      selectionManager.removeSelection(resolvedId);
    }

    const items = getDraftItems();
    updateOrderDisplay(items, selectionManager);
    updateOrder();
    updateDraftCount(selectionManager.getSelectionCount(), getDraftItems().length);
  };

  const result = attachCheckboxInternal(
    li,
    checkboxChangeHandler,
    { type: 'drafts', itemId: id, withOrder: true, withSelectUpTo: true }
  );

  const duration = Math.round(performance.now() - startTime);
  debugMethodEnd('addCheckboxAndOrderToLi', { success: !!result, itemId: id }, duration);
}

/**
 * li要素にチェックボックスを追加（DRAFTS/LISTINGS共通）
 * 統一実装に委譲
 */
export function addCheckboxToLi(
  li: HTMLLIElement,
  onChange: (id: string, checked: boolean) => void,
  options?: { type?: 'drafts' | 'listings'; itemId?: string; withSelectUpTo?: boolean }
): HTMLInputElement | null {
  const startTime = performance.now();
  debugMethodStart('addCheckboxToLi', { liTagName: li?.tagName, options });

  const result = attachCheckboxInternal(
    li,
    onChange,
    {
      type: options?.type ?? 'listings',
      itemId: options?.itemId,
      withOrder: false,
      withSelectUpTo: options?.withSelectUpTo
    }
  );

  const duration = Math.round(performance.now() - startTime);
  debugMethodEnd('addCheckboxToLi', {
    success: !!result,
    type: options?.type ?? 'listings',
    itemId: options?.itemId
  }, duration);

  return result;
}
