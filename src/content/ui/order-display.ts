import { CLASS_NAME } from '../infra/constants';
import { safeQuery } from '../../common/dom';
import { SelectionManager } from '../logic/selection-manager';
import { DraftItem } from './list';
import { warn } from '../infra/logger';
import { ensureTheme } from './theme';

/**
 * 出品順バッジの数字を更新する
 *
 * 見た目は数字だけの丸いバッジにし、読み上げには「出品順 N番目」を渡す。
 * 同じ番号のときは触らない（触るとバッジの出現アニメーションが毎回かかる）。
 *
 * @param orderSpan 出品順バッジ
 * @param order 1始まりの順番
 */
function setOrderBadge(orderSpan: HTMLSpanElement, order: number): void {
  if (orderSpan.textContent === String(order)) return;
  orderSpan.textContent = String(order);
  orderSpan.setAttribute('aria-label', `出品順 ${order}番目`);
  orderSpan.title = `${order}番目に処理します`;
}

ensureTheme();

/**
 * SelectionManagerの状態に応じてli内の順番表示を更新する。
 *
 * @param items DraftItem[]
 * @param selection SelectionManagerインスタンス
 */
export function updateOrderDisplay(
  items: DraftItem[],
  selection: SelectionManager
): void {
  items.forEach(item => {
    const { li, id } = item;
    const cb = li.querySelector('.bulk-checkbox') as HTMLInputElement | null;
    let orderSpan = li.querySelector(`.${CLASS_NAME.BULK_ORDER_SPAN}`) as HTMLSpanElement | null;

    // スパンが存在しない場合は作成
    if (!orderSpan) {
      orderSpan = document.createElement('span');
      orderSpan.className = CLASS_NAME.BULK_ORDER_SPAN;
      // チェックボックスのすぐ隣に置く（どの行の番号か一目で対応が取れるように）
      if (cb?.parentNode) {
        cb.insertAdjacentElement('afterend', orderSpan);
      } else {
        li.insertBefore(orderSpan, li.firstChild?.nextSibling || li.firstChild);
      }
    }

    // 選択中のアイテムを視覚的に強調
    if (cb && cb.checked) {
      li.classList.add(CLASS_NAME.SELECTED_ITEM);
      const idx = selection.getOrderIndex(id);
      if (idx >= 0) {
        setOrderBadge(orderSpan, idx + 1);
      } else {
        // チェック済みだが選択リストにない場合は追加して番号を表示
        warn(`checked item not in selection list: ${id}`);
        selection.addSelection(id);
        const newIdx = selection.getOrderIndex(id);
        setOrderBadge(orderSpan, newIdx + 1);
      }
    } else {
      li.classList.remove(CLASS_NAME.SELECTED_ITEM);
      if (orderSpan.textContent !== '') {
        orderSpan.textContent = '';
        orderSpan.removeAttribute('aria-label');
        orderSpan.removeAttribute('title');
      }
    }
  });
}

/**
 * 下書きリストのすべてのアイテムの順番表示を更新する
 * @param ul HTMLUListElement
 * @param selection SelectionManagerインスタンス
 */
export function renderOrderNumbers(
  ul: HTMLUListElement,
  selection: SelectionManager
): void {
  if (!ul) return;
  const items = Array.from(ul.querySelectorAll('li')).map(li => {
    // まずはチェックボックスの data-item-id を優先
    const cb = li.querySelector<HTMLInputElement>(`.${CLASS_NAME.BULK_CHECKBOX}`);
    const aTag = safeQuery<HTMLAnchorElement>('a[data-testid="draft-item"]', li);
    const id = cb?.dataset.itemId || aTag?.getAttribute('href') || '';
    return { li, id, anchor: aTag ?? undefined };
  });
  updateOrderDisplay(items, selection);
}
