import { CLASS_NAME, PageType, SELECTOR } from '../infra/constants';
import { safeQuery, safeGetAttr } from '../../common/dom';
import { debug } from '../infra/logger';

/**
 * 一覧ページ（下書き / 出品中）の各商品に「AIで説明文を作る」リンクを追加するモジュール。
 *
 * - 一覧上で直接生成はせず、編集ページを開いてそこで生成する導線だけを提供します。
 *   （一括生成はフェーズ4のスコープ）
 */

/**
 * 商品リンクのhrefから編集ページのURLを求める。
 *
 * - 下書きの一覧リンクは既に編集ページを指しているためそのまま使います。
 * - 出品中商品の一覧リンクは商品ページ（/item/{id}）を指すため、編集ページ（/sell/edit/{id}）に変換します。
 *
 * @param href 一覧の商品リンクのhref
 * @param pageType 現在のページタイプ
 * @returns {string} 編集ページのURL
 */
export function toEditPageUrl(href: string, pageType: PageType): string {
  if (pageType !== PageType.LISTINGS) {
    return href;
  }

  const itemId = href.replace(/^\/item\//, '');
  return `/sell/edit/${itemId}`;
}

/**
 * li要素に「AIで説明文を作る」リンクを追加する。
 *
 * - 既にリンクが追加されている場合は何もしません（再描画対策）。
 * - 一覧ページ以外では何もしません（想定外のDOMに要素を差し込まないため）。
 *
 * @param li 商品のli要素
 * @param pageType 現在のページタイプ
 * @returns {HTMLAnchorElement | null} 追加したリンク、追加しなかった場合はnull
 * @example
 *   addAiDescriptionLink(li, PageType.DRAFTS);
 */
export function addAiDescriptionLink(
  li: HTMLLIElement,
  pageType: PageType
): HTMLAnchorElement | null {
  if (pageType !== PageType.DRAFTS && pageType !== PageType.LISTINGS) {
    return null;
  }
  if (!li || safeQuery(`.${CLASS_NAME.AI_DESCRIPTION_LINK}`, li)) {
    return null;
  }

  const itemSelector = pageType === PageType.LISTINGS ? SELECTOR.ITEM_LINK : SELECTOR.DRAFT_ITEM;
  const itemAnchor = safeQuery<HTMLAnchorElement>(itemSelector, li);
  const href = safeGetAttr(itemAnchor, 'href');
  if (href === '') {
    return null;
  }

  const link = document.createElement('a');
  link.className = CLASS_NAME.AI_DESCRIPTION_LINK;
  link.textContent = 'AIで説明文を作る';
  link.href = toEditPageUrl(href, pageType);
  link.target = '_blank';
  link.rel = 'noopener';

  const style = link.style;
  style.display = 'inline-block';
  style.marginTop = '4px';
  style.fontSize = '12px';
  style.color = '#ea352d';
  style.textDecoration = 'underline';
  style.position = 'relative';
  style.zIndex = '99999';

  // 商品リンク（li全体を覆うaタグ）より前面に出すため、li直下に追加する
  li.appendChild(link);

  debug('AI説明文生成リンクを追加しました', { href: link.href });
  return link;
}
