import { debugMethodStart, debugMethodEnd } from '../infra/logger';

/**
 * DOM操作のユーティリティ関数群
 * - 要素取得
 * - 属性抽出
 */

/**
 * li要素からitemIdを取得
 * @param li li要素
 * @returns itemId文字列 or null
 */
export function getItemIdFromLi(li: Element): string | null {
  const startTime = performance.now();
  debugMethodStart('getItemIdFromLi', { element: li.tagName });

  const cb = li.querySelector('.bulk-checkbox');
  if (!(cb instanceof HTMLInputElement)) {
    debugMethodEnd('getItemIdFromLi', { result: null, reason: 'checkbox not found' });
    return null;
  }

  const itemId = cb.dataset.itemId ?? null;

  const duration = Math.round(performance.now() - startTime);
  debugMethodEnd('getItemIdFromLi', { result: itemId }, duration);
  return itemId;
}

/**
 * li要素から再出品ボタンを取得
 * @param li li要素
 * @returns 再出品ボタン or null
 */
export function getRelistButton(li: Element): HTMLButtonElement | null {
  const startTime = performance.now();
  debugMethodStart('getRelistButton', { element: li.tagName });

  const btn = li.querySelector('#clone-item');
  const result = btn instanceof HTMLButtonElement ? btn : null;

  const duration = Math.round(performance.now() - startTime);
  debugMethodEnd('getRelistButton', {
    found: !!result,
    buttonType: result ? result.type : null
  }, duration);

  return result;
}

/**
 * li要素から商品名を取得
 * @param li li要素
 * @returns 商品名文字列
 */
export function getItemName(li: Element): string {
  const startTime = performance.now();
  debugMethodStart('getItemName', { element: li.tagName });

  const labelElem = li.querySelector('[data-testid="item-label"]');
  const name = labelElem instanceof HTMLElement ? (labelElem.textContent?.trim() ?? '') : '';

  const duration = Math.round(performance.now() - startTime);
  debugMethodEnd('getItemName', {
    name,
    nameLength: name.length,
    labelFound: !!labelElem
  }, duration);

  return name;
}

/**
 * ul内からitemIdに一致するli要素を検索
 * @param ul 商品リストul
 * @param id itemId
 * @returns 一致するli要素 or undefined
 */
export function findLiByItemId(ul: HTMLUListElement, id: string): HTMLLIElement | undefined {
  const startTime = performance.now();
  debugMethodStart('findLiByItemId', { listElement: ul.tagName, itemId: id });

  const items = ul.querySelectorAll<HTMLLIElement>('li');
  debugMethodStart('findLiByItemId.itemsSearch', { totalItems: items.length });

  const result = Array.from(items).find(li => getItemIdFromLi(li) === id);

  const duration = Math.round(performance.now() - startTime);
  debugMethodEnd('findLiByItemId', {
    found: !!result,
    searchedItems: items.length,
    itemId: id
  }, duration);

  return result;
}
