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
  BASE_SECONDS: 60, // 標準待機秒数
  EXTRA_MIN: 10,   // 追加待機の最小値（秒）
  EXTRA_MAX: 45,   // 追加待機の最大値（秒）
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
};

/**
 * CSS クラス名定数
 */
export const CLASS_NAME = {
  BULK_CHECKBOX: 'bulk-checkbox',
  BULK_ORDER_SPAN: 'bulk-order-span',
  SELECTED_ITEM: 'selected-item',
  DRAFT_ORDER: 'draft-order',
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
  DEBOUNCE_INTERVAL: 300, // ms
  RELIST_WAIT_BASE: 75000, // ms
  RELIST_WAIT_RANDOM: 10000, // ms
  TOAST_DURATION: 3000, // ms

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
  UNKNOWN = 'unknown',
}
