import { SELECTOR } from '../infra/constants';
import { safeQuery, safeQueryAll } from '../../common/dom';

/**
 * 下書き商品li要素とその主要情報を型で表現
 */
export type DraftItem = {
  li: HTMLLIElement;
  id: string;
  anchor?: HTMLAnchorElement;  // オプショナル
};

/**
 * 下書きリスト(ul)要素を取得
 *
 * - ページ内の下書きリストul要素を安全に取得します。
 * - 存在しない場合はnullを返します。
 *
 * @returns {HTMLUListElement | null} 下書きリストul要素
 */
export function getDraftList(): HTMLUListElement | null {
  const el = safeQuery(SELECTOR.DRAFT_LIST);
  return el instanceof HTMLUListElement ? el : null;
}

/**
 * 下書きリスト内のli要素を取得し、DraftItem型で返す
 *
 * @returns {DraftItem[]} DraftItem型配列
 */
export function getDraftItems(): DraftItem[] {
  const draftList: HTMLUListElement | null = getDraftList();
  if (!draftList) return [];

  // map と filter の部分を修正
  const items: DraftItem[] = [];

  safeQueryAll<HTMLLIElement>('li', draftList).forEach(li => {
    const anchor = safeQuery<HTMLAnchorElement>(SELECTOR.DRAFT_ITEM, li);
    const id = anchor?.getAttribute('href') ?? '';

    if (id) {
      items.push({
        li,
        id,
        anchor: anchor ?? undefined
      });
    }
  });

  return items;
}

/**
 * 指定idの下書きDraftItemを取得
 *
 * @param id 下書き商品のid
 * @returns {DraftItem | undefined} 対象DraftItem
 */
export function findDraftItemById(id: string): DraftItem | undefined {
  return getDraftItems().find(item => item.id === id);
}
