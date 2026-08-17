import { log, warn } from '../../../common/logger';
import { PageTypeValue } from '../infra/page-detector';
import { findDeleteLink } from './delete-clicker';
import { getCurrentPage, getMaxPage, gotoPage, navigateToPage } from './pager';

/**
 * 削除対象の商品が居るページを突き止めるモジュール。
 *
 * 削除するたびに一覧は1ページ目に戻るため、対象を探す前に
 * 開始時のページへ戻す必要がある（詳細は README「削除すると1ページ目に戻る」）。
 */

/**
 * 全ページを順に探す。想定が崩れた場合の保険。
 */
async function searchAllPages(
  pageType: PageTypeValue,
  itemId: string
): Promise<HTMLAnchorElement | null> {
  await navigateToPage(1);
  const onFirstPage = findDeleteLink(pageType, itemId);
  if (onFirstPage) return onFirstPage;

  const maxPage = getMaxPage();
  for (let page = 2; page <= maxPage; page++) {
    if (!(await gotoPage(page))) break;
    log(`${page}ページ目を確認します`);
    const link = findDeleteLink(pageType, itemId);
    if (link) return link;
  }
  return null;
}

/**
 * 指定商品の削除リンクを探す。
 *
 * 削除すると一覧は1ページ目に戻るが、対象は必ず開始時のページに居る。
 * 選択はページ送りのたびに破棄されるので対象は1ページに収まり、
 * 同じページの商品を削除しても後続はそのページ内に留まるため
 * （後ろのページから繰り上がってくるだけ）。そのページへ戻してから探す。
 */
export async function locateDeleteLink(
  pageType: PageTypeValue,
  itemId: string,
  page: number | null
): Promise<HTMLAnchorElement | null> {
  if (page !== null && getCurrentPage() !== page) {
    if (!(await navigateToPage(page))) {
      warn(`${page}ページ目へ戻れませんでした`);
    }
  }

  const onTargetPage = findDeleteLink(pageType, itemId);
  if (onTargetPage) return onTargetPage;

  warn('想定のページに見つからないため、全ページを探します');
  return searchAllPages(pageType, itemId);
}
