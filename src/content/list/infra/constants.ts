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
  /** チェックボックスと選択順を入れる列（商品行の先頭に差し込む label） */
  ROW_PICK: 'rbl-pick',
  /** 選択順の数字 */
  ROW_ORDER: 'rbl-order',
  /** 拡張が手を入れた商品行 */
  ROW: 'rbl-row',
  /** 選択中の商品行 */
  ROW_SELECTED: 'rbl-row--selected',
  /** ボタンの文言（アイコンを残して文言だけ差し替えるため） */
  BTN_LABEL: 'rbl-btn__label',
  PROGRESS_HEAD: 'rbl-progress__head',
  PROGRESS_LABEL: 'rbl-progress__label',
  PROGRESS_PCT: 'rbl-progress__pct',
  PROGRESS_BAR: 'rbl-progress__bar',
  PROGRESS_DETAIL: 'rbl-progress__detail',
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
  BULK_REPLACE_BTN: 'rbl-bulk-replace-btn',
  BULK_CLEAR_BTN: 'rbl-bulk-clear-btn',
  BULK_META: 'rbl-bulk-meta',
  BULK_FAILURES: 'rbl-bulk-failures',
  BULK_DISMISS_BTN: 'rbl-bulk-dismiss-btn',
  /** ドックがページの末尾を覆わないよう、body の末尾に置く余白 */
  DOCK_SPACER: 'rbl-dock-spacer',
  TOAST: 'rbl-toast',
  THEME_STYLE: 'rbl-theme-style',
  CONFIRM_DIALOG: 'rbl-confirm-dialog',

  // 説明文の一括置換パネル（/sell のみ）
  REPLACE_PANEL: 'rbl-replace-panel',
  REPLACE_CLOSE_BTN: 'rbl-replace-close-btn',
  REPLACE_FINAL_FILE: 'rbl-replace-final-file',
  REPLACE_ORIGINAL_FILE: 'rbl-replace-original-file',
  REPLACE_WAIT_INPUT: 'rbl-replace-wait',
  REPLACE_LOAD_BTN: 'rbl-replace-load-btn',
  REPLACE_START_BTN: 'rbl-replace-start-btn',
  REPLACE_STOP_BTN: 'rbl-replace-stop-btn',
  REPLACE_EXPORT_BTN: 'rbl-replace-export-btn',
  REPLACE_SUMMARY: 'rbl-replace-summary',
  REPLACE_STATUS: 'rbl-replace-status',
  REPLACE_COUNTS: 'rbl-replace-counts',
};

/**
 * 設定値定数
 */
export const CONFIG = {
  TOAST_DURATION_MS: 3000,
  /** 失敗・警告のトーストは読み切れるよう長めに出す (ms) */
  TOAST_DURATION_LONG_MS: 6000,
  /**
   * 浮遊 UI の重なり順。ラクマ側のヘッダーやフリマアシストの注入要素より手前に出す。
   * 確認ダイアログは top layer（showModal）なのでここには含めない。
   */
  ZINDEX: {
    DOCK: 2147480000,
    PANEL: 2147480001,
    TOAST: 2147480002,
  },
  /** 確認ダイアログに並べる商品名の上限（超えた分は「ほか N 件」にまとめる） */
  CONFIRM_MAX_ITEMS: 8,
  /** ドックに並べる失敗の上限 */
  DOCK_MAX_FAILURES: 3,
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

  /** 説明文の一括置換: 説明欄の上限文字数（ラクマの編集ページの表示「N/1000」から） */
  REPLACE_MAX_DESCRIPTION_LENGTH: 1000,
  /** 説明文の一括置換: 商品間の待機の基準秒数の既定値（画面から変えられる） */
  REPLACE_WAIT_BASE_SECONDS: 60,
  /** 説明文の一括置換: 待機の下限秒数（Background の chrome.alarms が 30 秒未満を扱えない） */
  REPLACE_WAIT_MIN_SECONDS: 30,
  /** 説明文の一括置換: 待機に加算されるランダム秒数の最大（Background の WAIT_RANDOM_MS と同じ） */
  REPLACE_WAIT_RANDOM_SECONDS: 15,
};
