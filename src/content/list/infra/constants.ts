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

  // ページ送り用（/sell にのみ存在。/draft は全件表示でページャが無い）
  /** 現在表示中のページ番号 */
  PAGER_CURRENT: '.pagination .page.current',
  /** 他ページへのリンク */
  PAGER_LINK: '.pagination a',
  /** 「122件中 31 - 60件」の情報行。タブごとに存在するため表示中のものだけ使う */
  PAGE_INFO: '.page-info',

  /**
   * 削除リンク（jquery_ujs）。/sell・/draft の双方で同じ形。
   * ラベルではなく data-method で特定する。
   */
  DELETE_LINK: 'a.deal-item__button[data-method="delete"]',

  // /draft（下書き一覧）用
  /** 下書き編集ページへのリンク（hrefから下書きIDを取得） */
  DRAFT_EDIT_LINK: 'a.deal-item__button[href^="/drafts/"][href$="/edit"]',
};

/**
 * ラクマ側の表記に依存するラベル。
 *
 * セレクタと同じくラクマの変更で崩れる値なので、ここに集めて一覧できるようにする。
 * 実機の表記と 1 文字でも違うと要素が見つからなくなるため、
 * 値は実機を確認せずに変えないこと。
 */
export const LABEL = {
  /** 削除リンクのラベル。取り消せない操作なのでクリック前に必ず一致を確認する */
  DELETE: '削除',
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
  BULK_DELETE_BTN: 'rbl-bulk-delete-btn',
  BULK_STOP_BTN: 'rbl-bulk-stop-btn',
  BULK_STATUS_SPAN: 'rbl-bulk-status',
  TOAST: 'rbl-toast',
};

/**
 * 設定値定数
 */
export const CONFIG = {
  TOAST_DURATION_MS: 3000,
  /** 削除リンクをクリックするまでの基本待機時間 (ms) */
  DELETE_DELAY_MS: 2000,
  /** 削除の待機時間に加算するランダム値の最大 (ms) */
  DELETE_RANDOM_MS: 2000,
  /** ページ移動が反映されるまでの最大待機時間 (ms) */
  PAGE_CHANGE_TIMEOUT_MS: 15000,
  /** ページ移動の確認間隔 (ms) */
  PAGE_POLL_INTERVAL_MS: 300,
  /** ページ移動を諦めるまでの試行回数（リンクが飛び飛びのとき複数回かかる） */
  MAX_NAVIGATION_STEPS: 10,
  /** 一覧の連続するDOM変化をまとめる待ち時間 (ms) */
  LIST_DEBOUNCE_MS: 300,
};
