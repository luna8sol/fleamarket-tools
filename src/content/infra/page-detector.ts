import { PageType } from './constants';

/**
 * 現在のページタイプを検出
 * @returns 検出されたページタイプ
 */
export function detectCurrentPage(): PageType {
  const { pathname } = window.location;

  if (pathname.startsWith('/mypage/drafts')) {
    return PageType.DRAFTS;
  }

  if (pathname.startsWith('/mypage/listings')) {
    return PageType.LISTINGS;
  }

  return PageType.UNKNOWN;
}

/**
 * 特定のページタイプかどうかを判定
 * @param pageType 判定するページタイプ
 * @returns ページタイプが一致するか
 */
export function isPageType(pageType: PageType): boolean {
  return detectCurrentPage() === pageType;
}
