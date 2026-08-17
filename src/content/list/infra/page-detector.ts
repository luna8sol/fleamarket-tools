/**
 * 現在のページタイプを判定するモジュール。
 */

import { FormMode } from '../../../common/messages';

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

/**
 * 一覧ページの種別ごとの性質。
 *
 * 種別から主モードを導く分岐（`pageType === PageType.SELL ? 'relist' : 'publish'`）は、
 * PageType に種別を足したとき黙って publish 側へ落ちる。Record にしておくと
 * 種別を足した時点で**全性質の記入が型で強制される**。
 * src/common/queue-mode-traits.ts の QUEUE_MODE_TRAITS と同じ考え方。
 *
 * NOTE: このファイルは URL 判定のモジュールだが、この表のために
 * src/common/messages.ts の FormMode に依存する。表を PageType の隣へ置くのは、
 * 種別を足す作業と性質を書き足す作業を同じファイルで完結させるため。
 */
export interface ListPageTraits {
  /** このページの主モード。削除はどちらのページでも使えるため含めない */
  primaryMode: FormMode;

  /** 一括操作バーの開始ボタンに出す文言 */
  startLabel: string;

  /**
   * 説明文の一括置換（replace）を使えるか。
   * 対象は出品中の商品（編集ページ /item/{hash}/edit）だけなので /sell のみ true。
   */
  supportsReplace: boolean;
}

/**
 * 種別ごとの性質。UNKNOWN は一覧用 Content Script の担当外なので除く。
 *
 * Record なので種別を足すと記入漏れがコンパイルエラーになる。
 */
export const LIST_PAGE_TRAITS: Record<
  Exclude<PageTypeValue, typeof PageType.UNKNOWN>,
  ListPageTraits
> = {
  [PageType.SELL]: {
    primaryMode: 'relist',
    startLabel: '選択した商品を下書きに保存',
    supportsReplace: true,
  },
  [PageType.DRAFT]: {
    primaryMode: 'publish',
    startLabel: '選択した下書きをまとめて出品',
    supportsReplace: false,
  },
};
