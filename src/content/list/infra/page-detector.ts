/**
 * 現在のページタイプを判定するモジュール。
 */

export const PageType = {
  /** 出品中一覧 (/sell) — フリマアシストの再出品ボタンで一括再出品 */
  SELL: 'sell',
  /** 下書き一覧 (/draft) — 編集ページを開いて一括出品 */
  DRAFT: 'draft',
  UNKNOWN: 'unknown',
} as const;

export type PageTypeValue = (typeof PageType)[keyof typeof PageType];

/**
 * URLから現在のページタイプを判定する。
 *
 * NOTE: manifestのmatchesパターン "https://fril.jp/draft*" は
 * /drafts/{hash}/edit（編集ページ）にもマッチしてしまうため、
 * /drafts/ 配下はUNKNOWNとして除外する。
 *
 * /drafts 配下のパス判定を変える場合は src/common/form-page.ts の
 * DRAFT_EDIT_PATH も合わせて確認すること。片方だけ変えると、
 * 一覧側とフォーム側のどちらも担当しないページができる。
 */
export function detectCurrentPage(): PageTypeValue {
  const path = window.location.pathname;

  if (path === '/sell' || path.startsWith('/sell/')) {
    return PageType.SELL;
  }
  // /drafts/... は編集ページ側のContent Scriptの担当
  if (path.startsWith('/drafts')) {
    return PageType.UNKNOWN;
  }
  if (path === '/draft' || path.startsWith('/draft/')) {
    return PageType.DRAFT;
  }
  return PageType.UNKNOWN;
}
