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

import { CompareFieldKey, SellFormFieldSpec } from './types';

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

  // リスト読み込み失敗の通知
  LIST_LOAD_ERROR: 'list-load-error',
  LIST_LOAD_RETRY_BTN: 'list-load-retry-btn',
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

  // 一覧リスト（ul）の出現を待つ上限時間
  // メルカリ側はスケルトン表示のまま20秒以上かかることがある（出品中207件のアカウントで実測）。
  // 出現の検知自体はMutationObserverが担うので、ここは「いつ諦めてユーザーに知らせるか」の締め切り。
  LIST_WAIT_TIMEOUT_MS: 30000,

  // AI説明文生成パネルの描画待ち設定
  // 出品フォームはReactで遅延描画されるため、説明欄が現れるまで待つ必要がある
  EDIT_PANEL_MAX_RETRY_COUNT: 20,
  EDIT_PANEL_RETRY_INTERVAL_MS: 500,

  // 再出品タブでの自動保存設定
  SELL_FORM_MAX_RETRY_COUNT: 40,     // 出品フォームの初期表示待ちの最大リトライ回数
  SELL_FORM_RETRY_INTERVAL_MS: 500,  // 出品フォーム待ちのポーリング間隔
  SELL_FORM_FIX_SETTLE_MS: 300,      // 差分修正後、再読み取りまでの待機時間
  RELIST_QUEUE_TTL_MS: 30 * 60 * 1000, // キューに残った古いエントリを破棄するまでの時間

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
 * 再出品後の自動保存のデフォルト設定
 *
 * autoSaveDryRun は既定で true です。出品フォームのセレクタは実環境での
 * 検証が必要なため、まずはドライランで差分検出の妥当性を確認してから
 * 保存を有効化してください。
 */
export const DEFAULT_AUTO_SAVE_SETTINGS = {
  autoSaveAfterRelist: true,
  autoSaveDryRun: true,
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
  /** 新規出品ページ（再出品ボタンから開かれる出品フォーム） */
  SELL = 'sell',
  UNKNOWN = 'unknown',
}

/**
 * 出品フォーム（再出品タブ）のセレクタ・比較定義
 *
 * メルカリのDOMは予告なく変わるため、各フィールドは複数の候補セレクタと
 * 画面上のラベル文言によるフォールバック探索を持ちます。
 * 実環境と合わない場合は、まずこのテーブルを修正してください。
 */
export const SELL_FORM_FIELDS: SellFormFieldSpec[] = [
  {
    key: 'name',
    label: '商品名',
    kind: 'text',
    fixable: true,
    selectors: ['#name', 'input[name="name"]', '[data-testid="name"] input', 'input[data-testid="name"]'],
    labelTexts: ['商品名'],
  },
  {
    key: 'price',
    label: '販売価格',
    kind: 'number',
    fixable: true,
    selectors: ['#price', 'input[name="price"]', '[data-testid="price"] input', 'input[data-testid="price"]'],
    labelTexts: ['販売価格', '価格'],
  },
  {
    key: 'description',
    label: '商品の説明',
    kind: 'textarea',
    fixable: true,
    selectors: [
      '#description',
      'textarea[name="description"]',
      '[data-testid="description"] textarea',
      'textarea[data-testid="description"]',
    ],
    labelTexts: ['商品の説明'],
  },
  {
    key: 'categoryId',
    label: 'カテゴリー',
    kind: 'select',
    fixable: true,
    selectors: [
      '#category',
      'select[name="categoryId"]',
      'select[name="category"]',
      '[data-testid="category"] select',
      'select[data-testid="category"]',
    ],
    labelTexts: ['カテゴリー', 'カテゴリ'],
  },
  {
    key: 'conditionId',
    label: '商品の状態',
    kind: 'select',
    fixable: true,
    selectors: [
      '#condition',
      'select[name="conditionId"]',
      'select[name="condition"]',
      '[data-testid="condition"] select',
      'select[data-testid="condition"]',
    ],
    labelTexts: ['商品の状態'],
  },
  {
    key: 'shippingPayerId',
    label: '配送料の負担',
    kind: 'select',
    fixable: true,
    selectors: [
      '#shipping-payer',
      'select[name="shippingPayerId"]',
      'select[name="shippingPayer"]',
      '[data-testid="shipping-payer"] select',
    ],
    labelTexts: ['配送料の負担'],
  },
  {
    key: 'shippingMethodId',
    label: '配送の方法',
    kind: 'select',
    fixable: true,
    selectors: [
      '#shipping-method',
      'select[name="shippingMethodId"]',
      'select[name="shippingMethod"]',
      'select[name="shippingClassId"]',
      '[data-testid="shipping-method"] select',
    ],
    labelTexts: ['配送の方法'],
  },
  {
    key: 'shippingFromAreaId',
    label: '発送元の地域',
    kind: 'select',
    fixable: true,
    selectors: [
      '#shipping-from-area',
      'select[name="shippingFromAreaId"]',
      'select[name="shippingFromArea"]',
      '[data-testid="shipping-from-area"] select',
    ],
    labelTexts: ['発送元の地域'],
  },
  {
    key: 'shippingDurationId',
    label: '発送までの日数',
    kind: 'select',
    fixable: true,
    selectors: [
      '#shipping-duration',
      'select[name="shippingDurationId"]',
      'select[name="shippingDuration"]',
      '[data-testid="shipping-duration"] select',
    ],
    labelTexts: ['発送までの日数'],
  },
  {
    // 画像はファイル実体を持たないため再アップロードできず、自動修正は不可
    key: 'imageCount',
    label: '画像枚数',
    kind: 'count',
    fixable: false,
    selectors: [
      '[data-testid="image-preview"]',
      '[data-testid="sell-image-preview"]',
      '[data-testid="image-container"] img',
      'figure[data-testid^="image"]',
    ],
    labelTexts: [],
  },
];

/**
 * 出品フォーム関連のセレクタ
 */
export const SELL_FORM_SELECTOR = {
  /** 出品（保存）ボタンの候補セレクタ */
  SUBMIT_BUTTON: [
    '#submit-button',
    'button[data-testid="submit-button"]',
    'button[data-testid="sell-submit-button"]',
    'button[type="submit"]',
  ],
  /** 出品ボタンをテキストで探す場合の文言候補 */
  SUBMIT_BUTTON_TEXTS: ['出品する', '変更する', '保存する'],
  /** ラベル文言からフィールドを辿るときに走査する要素 */
  LABEL_CANDIDATES: 'label, legend, h2, h3, dt, [class*="label"], [class*="Label"]',
  /** ラベルから入力要素を辿るときに探す入力要素 */
  FORM_CONTROL: 'input, select, textarea',
};

/**
 * 元商品のJSONから値を取り出すためのキー候補（ドット区切りパス）
 *
 * メルカリの商品ページ（__NEXT_DATA__）の構造変化に備え、
 * 1フィールドにつき複数のパスを先頭から順に試します。
 */
export const ITEM_JSON_PATHS: Record<CompareFieldKey, string[]> = {
  name: ['name', 'title'],
  price: ['price', 'itemPrice'],
  description: ['description', 'itemDescription'],
  categoryId: ['itemCategoryId', 'categoryId', 'itemCategory.id', 'category.id'],
  conditionId: ['itemConditionId', 'conditionId', 'itemCondition.id', 'condition.id'],
  shippingPayerId: ['shippingPayerId', 'shippingPayer.id'],
  shippingMethodId: ['shippingMethodId', 'shippingMethod.id', 'shippingClassId', 'shippingClass.id'],
  shippingFromAreaId: ['shippingFromAreaId', 'shippingFromArea.id'],
  shippingDurationId: ['shippingDurationId', 'shippingDuration.id'],
  imageCount: [],
};

/**
 * 元商品のJSONから画像枚数を数えるための配列プロパティ候補
 */
export const ITEM_JSON_IMAGE_PATHS = ['photos', 'images', 'thumbnails', 'itemPhotos'];
