import { CLASS_NAME } from '../infra/constants';
import { safeQuery } from '../../common/dom';
import { SelectionManager } from '../logic/selection-manager';
import { DraftItem } from './list';
import { warn } from '../infra/logger';

/**
 * 選択状態の強調表示に使うCSSをdocument.headに一度だけ注入する
 */
function injectOrderStyles(): void {
  if (document.getElementById('bulk-selection-style')) return;
  const style = document.createElement('style');
  style.id = 'bulk-selection-style';
  style.textContent = `
    .selected-item {
      background-color: rgba(255, 2, 17, 0.05);
      border-left: 3px solid #ff0211;
    }
    .${CLASS_NAME.BULK_ORDER_SPAN} {
      display: inline-block;
      min-width: 24px;
      text-align: center;
    }
  `;
  document.head.appendChild(style);
}

injectOrderStyles();

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
      orderSpan.style.marginRight = '4px';
      orderSpan.style.fontWeight = 'bold';
      orderSpan.style.color = '#ff0211';
      li.insertBefore(orderSpan, li.firstChild?.nextSibling || li.firstChild);
    }

    // 選択中のアイテムを視覚的に強調
    if (cb && cb.checked) {
      li.classList.add('selected-item');
      const idx = selection.getOrderIndex(id);
      if (idx >= 0) {
        orderSpan.textContent = `${idx + 1}番`;
      } else {
        // チェック済みだが選択リストにない場合は追加して番号を表示
        warn(`checked item not in selection list: ${id}`);
        selection.addSelection(id);
        const newIdx = selection.getOrderIndex(id);
        orderSpan.textContent = `${newIdx + 1}番`;
      }
    } else {
      li.classList.remove('selected-item');
      if (orderSpan.textContent !== '') {
        orderSpan.textContent = '';
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
