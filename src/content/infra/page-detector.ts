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

