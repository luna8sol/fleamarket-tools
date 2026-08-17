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

  // 下書きの編集ページ（/sell/draft/{draftId}）
  // ※ /sell/drafts（複数形）は下書き一覧なので編集ページには含めない
  if (/^\/sell\/draft\/[^/]+/.test(pathname)) {
    return PageType.EDIT_DRAFT;
  }

  // 出品中商品の編集ページ（/sell/edit/{itemId}）
  if (/^\/sell\/edit\/[^/]+/.test(pathname)) {
    return PageType.EDIT_LISTING;
  }

  // 新規出品ページ（/sell/create）
  // ※ /sell は出品トップ（ランディング）でフォームがないため含めない
  if (pathname.startsWith('/sell/create')) {
    return PageType.SELL;
  }

  return PageType.UNKNOWN;
}

/**
 * 出品フォームを持つページ（新規出品・下書き編集・出品中商品の編集）かどうかを判定
 *
 * - AI説明文生成UIを表示してよいページかどうかの判定に使います。
 *
 * @returns {boolean} 出品フォームのあるページならtrue
 */
export function isSellFormPage(): boolean {
  const pageType = detectCurrentPage();
  return (
    pageType === PageType.EDIT_DRAFT ||
    pageType === PageType.EDIT_LISTING ||
    pageType === PageType.SELL
  );
}

