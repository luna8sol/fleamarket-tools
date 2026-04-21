/**
 * アプリ全体で利用する定数・設定値の一元管理モジュール。
 *
 * - セレクタ・クラス名・ID名・待機時間などをグループ化して管理します。
 * - どのレイヤーからもimportして利用可能です。
 * - 新たな定数・設定値はこのファイルに追加してください。
 *
 * @example
 *   import { WAIT, SELECTOR, CLASS_NAME, ID_NAME } from '../infra/constants';
 */
// =============================
// 定数・設定値 一元管理モジュール
// =============================

/**
 * 各種待機時間（秒）
 */
export const WAIT = {
  BASE_SECONDS: 60,        // 標準待機秒数
  EXTRA_MIN_SECONDS: 10,   // 追加待機の最小値（秒）
  EXTRA_MAX_SECONDS: 45,   // 追加待機の最大値（秒）
} as const;

/**
 * DOM要素セレクタ定数
 */
export const SELECTOR = {
  // ページ構造セレクタ
  ROOT_CONTAINER: '__next',
  MYPAGE_MAIN: '#__next main',

  // 下書き関連
  DRAFTS_LIST_DIV: 'div[data-testid="drafts-list"]',
  DRAFT_LIST: 'ul[data-testid="draft-list"]',
  DRAFT_ITEM: 'a[data-testid="draft-item"]',

  // 出品中商品関連
  ITEMS_LIST: 'ul[data-testid="listed-item-list"]',
  ITEM_LIST_ITEM: 'li',
  ITEM_LINK: 'a[data-testid="listed-item"]',

  // ボタン・ラベル
  RELIST_BUTTON: '#clone-item',
  ITEM_LABEL: '[data-testid="item-label"]',

  // 出品中商品のカウント表示（いいね・コメント・閲覧数）
  // li内のSVGアイコン直後のspanが順に いいね・コメント・閲覧数 に対応する
  ITEM_COUNT_SPAN: 'svg[aria-hidden="true"] + span',
};

/**
 * 出品・下書き編集フォームのセレクタ定数
 *
 * - 実際のメルカリ編集ページ（/sell/draft/{id}）のDOMを確認して決定したセレクタです。
 * - メルカリ側のDOM変更に耐えられるよう、項目ごとに候補を優先度順の配列で保持します。
 *   data-testid ベースのセレクタを先頭に置き、見つからない場合は name 属性などにフォールバックします。
 * - 取得には {@link safeQueryFirst} / {@link safeQueryAllFirst} を使ってください。
 *
 * @example
 *   const textarea = safeQueryFirst<HTMLTextAreaElement>(EDIT_SELECTOR.DESCRIPTION);
 */
export const EDIT_SELECTOR = {
  /** 商品名の入力欄 */
  NAME: [
    '[data-testid="input-name"] input',
    'input[name="name"]',
  ],
  /**
   * 商品説明の入力欄
   *
   * - 自動リサイズ用の非表示textareaが併存するため、name属性で表示中のものを特定します。
   */
  DESCRIPTION: [
    'textarea[name="description"]',
  ],
  /**
   * カテゴリの表示要素
   *
   * - 「ゲーム・おもちゃ・グッズ / トレーディングカード / ポケモンカードゲーム」のように
   *   階層が改行区切りで入っています。
   */
  CATEGORY: [
    '[data-testid="sell-category"]',
  ],
  /**
   * 商品の状態の表示要素
   *
   * - 1つ目のp要素が状態名（例: 目立った傷や汚れなし）、2つ目がその説明文です。
   */
  CONDITION: [
    '[data-testid="item-condition"] p',
  ],
  /**
   * 配送方法の表示要素
   *
   * - 「配送の方法 / 変更する / らくらくメルカリ便」のように見出しを含むため、最終行が値になります。
   */
  SHIPPING_METHOD: [
    '[data-testid="shipping-method-link"]',
  ],
  /**
   * カテゴリ固有の属性（ブランド・サイズ・シリーズなど）の選択欄
   *
   * - カテゴリによって項目が変わるため、ラベルと選択値をまとめて読み取ります。
   */
  ATTRIBUTE: [
    '[data-testid="attribute-select"]',
  ],
  /**
   * 出品画像
   *
   * - src は https のURLではなく data:image/jpeg;base64,... 形式のデータURIです。
   */
  IMAGES: [
    '[data-testid="photo-thumbnail"] img',
    '[data-testid^="image-list-item-"] img',
  ],
};

/**
 * 要素ID定数
 */
export const ID_NAME = {
  // ボタン・コントロール
  BULK_RELIST_BTN: 'bulk-relist-btn',
  BULK_RELIST_CONTAINER: 'bulk-relist-container',
  BULK_COUNT_SPAN: 'bulk-selected-count',
  BULK_PROCESSING_SPAN: 'bulk-processing',
  BULK_ORDER_SPAN: 'bulk-order-span',

  // 下書き関連UI
  BULK_PUBLISH_BTN: 'bulk-publish-btn',
  DRAFT_COUNT: 'draft-count',
  DRAFT_TOTAL: 'draft-total',
  BULK_TOTAL_COUNT: 'bulk-total-count',

  // UI要素
  TOAST: 'toast-notification',
  CONFIRM_DIALOG: 'confirm-dialog',

  // AI説明文生成UI
  AI_DESCRIPTION_PANEL: 'ai-description-panel',
  AI_DESCRIPTION_BTN: 'ai-description-btn',
  AI_DESCRIPTION_PREVIEW: 'ai-description-preview',
  AI_DESCRIPTION_APPLY_BTN: 'ai-description-apply-btn',
  AI_DESCRIPTION_CANCEL_BTN: 'ai-description-cancel-btn',
  AI_DESCRIPTION_STATUS: 'ai-description-status',

  // フィルターバー
  FILTER_BAR: 'listing-filter-bar',
  FILTER_LIKES_BTN: 'filter-likes-btn',
  FILTER_COMMENTS_BTN: 'filter-comments-btn',
};

/**
 * CSS クラス名定数
 */
export const CLASS_NAME = {
  BULK_CHECKBOX: 'bulk-checkbox',
  BULK_ORDER_SPAN: 'bulk-order-span',
  SELECTED_ITEM: 'selected-item',
  DRAFT_ORDER: 'draft-order',
  AI_DESCRIPTION_LINK: 'ai-description-link',
};

/**
 * セレクタ定数（複合セレクタ）
 */
export const COMPOSITE_SELECTOR = {
  BULK_CHECKBOX_INPUT: 'input.bulk-checkbox',
  CHECKED_BULK_CHECKBOX: 'li input.bulk-checkbox:checked',
  BULK_CHECKBOX_WITH_ITEM_ID: 'li input.bulk-checkbox[data-item-id="{0}"]',
};

/**
 * 設定値定数
 */
export const CONFIG = {
  // タイミング設定
  DEBOUNCE_INTERVAL_MS: 300,
  RELIST_WAIT_BASE_MS: 75000,
  RELIST_WAIT_RANDOM_MS: 10000,
  TOAST_DURATION_MS: 3000,

  // DOM要素待機設定
  OBSERVER_MAX_RETRY_COUNT: 10, // 要素が見つかるまでの最大リトライ回数
  OBSERVER_RETRY_INTERVAL_MS: 500,

  // AI説明文生成パネルの描画待ち設定
  // 出品フォームはReactで遅延描画されるため、説明欄が現れるまで待つ必要がある
  EDIT_PANEL_MAX_RETRY_COUNT: 20,
  EDIT_PANEL_RETRY_INTERVAL_MS: 500,

  // UI設定
  ZINDEX: {
    TOAST: 10000,
    CONTROL_PANEL: 9999,
  },
};

/**
 * デフォルトのユーザー設定
 */
export const DEFAULT_USER_SETTINGS = {
  waitTimeBetweenRelists: 90000, // ms
  randomizeWaitTime: true,
  maxRandomTime: 10000, // ms
  autoSelectLatest: false,
  maxSelectCount: 100,
  debugMode: true, // デバッグモード
};

/**
 * ページタイプ定数
 */
export enum PageType {
  DRAFTS = 'drafts',
  LISTINGS = 'listings',
  /** 下書きの編集ページ */
  EDIT_DRAFT = 'editDraft',
  /** 出品中商品の編集ページ */
  EDIT_LISTING = 'editListing',
  /** 新規出品ページ */
  SELL = 'sell',
  UNKNOWN = 'unknown',
}
