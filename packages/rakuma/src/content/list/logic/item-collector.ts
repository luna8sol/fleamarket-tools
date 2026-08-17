import { SELECTOR } from '../infra/constants';
import { PageType, PageTypeValue } from '../infra/page-detector';
import { warn } from '../../../common/logger';

/**
 * 一覧ページの商品1件分の情報
 */
export interface ListItem {
  /** 商品コンテナ要素 */
  el: HTMLElement;
  /** 商品ID（URLのhash部分） */
  id: string;
  /** 商品名 */
  title: string;
}

/**
 * /sell の商品要素からIDを抽出する。
 * href="https://item.fril.jp/{hash}" のhash部分。
 */
function extractSellItemId(el: HTMLElement): string | null {
  const link = el.querySelector<HTMLAnchorElement>(SELECTOR.SELL_ITEM_LINK);
  const match = link?.href.match(/item\.fril\.jp\/([0-9a-f]+)/);
  return match?.[1] ?? null;
}

/**
 * /draft の商品要素からIDを抽出する。
 * href="/drafts/{hash}/edit" のhash部分。
 */
function extractDraftItemId(el: HTMLElement): string | null {
  const link = el.querySelector<HTMLAnchorElement>(SELECTOR.DRAFT_EDIT_LINK);
  const match = link?.getAttribute('href')?.match(/^\/drafts\/([0-9a-f]+)\/edit$/);
  return match?.[1] ?? null;
}

/**
 * ページ内の商品一覧を収集する。
 * IDが取得できない商品はスキップする。
 */
export function collectItems(pageType: PageTypeValue): ListItem[] {
  const elements = Array.from(document.querySelectorAll<HTMLElement>(SELECTOR.ITEM));
  const items: ListItem[] = [];

  for (const el of elements) {
    const id = pageType === PageType.SELL ? extractSellItemId(el) : extractDraftItemId(el);
    if (!id) {
      warn('商品IDを取得できない要素をスキップしました', el);
      continue;
    }
    const title = el.querySelector(SELECTOR.ITEM_HEADING)?.textContent?.trim() ?? '';
    items.push({ el, id, title });
  }

  return items;
}

/**
 * 商品IDから /sell の商品要素を探し、フリマアシストの再出品ボタンを返す
 */
export function findRelistButton(itemId: string): HTMLElement | null {
  const elements = Array.from(document.querySelectorAll<HTMLElement>(SELECTOR.ITEM));
  const target = elements.find((el) => extractSellItemId(el) === itemId);
  if (!target) return null;
  return target.querySelector<HTMLElement>(SELECTOR.RELIST_BUTTON);
}
