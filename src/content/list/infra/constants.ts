/**
 * 一覧ページ用の定数・セレクタの一元管理モジュール。
 * 新たな定数・セレクタはこのファイルに追加すること。
 */

/**
 * DOM要素セレクタ定数
 */
export const SELECTOR = {
  /** 商品1件分のコンテナ */
  ITEM: 'div.deal-item',
  /** 商品情報部分 */
  ITEM_ROW: '[data-test="item-row"]',
  /** 商品名 */
  ITEM_HEADING: 'h4.deal-item__heading',

  // /sell（出品中一覧）用
  /** 商品ページへのリンク（hrefから商品IDを取得） */
  SELL_ITEM_LINK: 'a[href^="https://item.fril.jp/"]',
  /** フリマアシストが注入する再出品ボタン */
  RELIST_BUTTON: 'a#clone-item',
  /** いいね数 */
  LIKE_COUNT: '[data-test="item_like_count"]',
  /** コメント数 */
  COMMENT_COUNT: '[data-test="item_comment_count"]',

  // /draft（下書き一覧）用
  /** 下書き編集ページへのリンク（hrefから下書きIDを取得） */
  DRAFT_EDIT_LINK: 'a.deal-item__button[href^="/drafts/"][href$="/edit"]',
};

/**
 * CSSクラス名定数（この拡張が付与するもの）
 */
export const CLASS_NAME = {
  BULK_CHECKBOX: 'rbl-bulk-checkbox',
};

/**
 * 要素ID定数（この拡張が付与するもの）
 */
export const ID_NAME = {
  BULK_BAR: 'rbl-bulk-bar',
  BULK_COUNT_SPAN: 'rbl-bulk-count',
  BULK_START_BTN: 'rbl-bulk-start-btn',
  BULK_STOP_BTN: 'rbl-bulk-stop-btn',
  BULK_STATUS_SPAN: 'rbl-bulk-status',
  TOAST: 'rbl-toast',
};

/**
 * 設定値定数
 */
export const CONFIG = {
  TOAST_DURATION_MS: 3000,
};
