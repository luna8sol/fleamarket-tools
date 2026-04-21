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

import { SellFormFieldSpec } from './types';

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

  // 一括削除
  BULK_DELETE_BTN: 'bulk-delete-btn',

  // フィルターバー
  FILTER_BAR: 'listing-filter-bar',
  FILTER_LIKES_BTN: 'filter-likes-btn',
  FILTER_COMMENTS_BTN: 'filter-comments-btn',

  // リスト読み込み失敗の通知
  LIST_LOAD_ERROR: 'list-load-error',
  LIST_LOAD_RETRY_BTN: 'list-load-retry-btn',

  // 説明文の一括置換
  DESCRIPTION_REPLACE_BTN: 'description-replace-btn',
  DESCRIPTION_REPLACE_PANEL: 'description-replace-panel',
  DESCRIPTION_REPLACE_FIXED_FILE: 'description-replace-fixed-file',
  DESCRIPTION_REPLACE_ORIGINAL_FILE: 'description-replace-original-file',
  DESCRIPTION_REPLACE_INTERVAL: 'description-replace-interval',
  DESCRIPTION_REPLACE_LOAD_BTN: 'description-replace-load-btn',
  DESCRIPTION_REPLACE_SUMMARY: 'description-replace-summary',
  DESCRIPTION_REPLACE_START_BTN: 'description-replace-start-btn',
  DESCRIPTION_REPLACE_ABORT_BTN: 'description-replace-abort-btn',
  DESCRIPTION_REPLACE_EXPORT_BTN: 'description-replace-export-btn',
  DESCRIPTION_REPLACE_CLOSE_BTN: 'description-replace-close-btn',
  DESCRIPTION_REPLACE_STATUS: 'description-replace-status',
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
  SELECT_UP_TO_BTN: 'bulk-select-up-to-btn',
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

  // 一括削除の設定
  // 削除は出品を作らないので再出品ほど間隔を空けないが、連続実行が目立たないよう間は置く
  DELETE_WAIT_BASE_MS: 5000,
  DELETE_WAIT_RANDOM_MS: 5000,
  DELETE_PAGE_TIMEOUT_MS: 30000, // 編集ページが開くのを待つ上限
  DELETE_DIALOG_TIMEOUT_MS: 10000, // 削除確認ダイアログが出るのを待つ上限
  DELETE_RESULT_TIMEOUT_MS: 30000, // 削除後にページが切り替わるのを待つ上限

  // 再出品タブでの自動保存設定
  // メルカリのフォームは React で遅延描画されるため、いずれも「現れるまで待つ」ためのもの。
  // 待てない場合は黙って先へ進まず、必ずタイムアウトして中断する。
  SELL_FORM_POLL_INTERVAL_MS: 250,   // 要素・ページ遷移待ちのポーリング間隔
  // 再出品タブでコピー内容が入るのを待つ上限。
  // 待っている相手は外部ツールによる prefill で、メルカリ側の描画の遅さも重なる。
  // 実測で20秒では足りなかった。再出品の間隔（RELIST_WAIT_BASE_MS）に収まる範囲で長めに取る。
  SELL_FORM_READY_TIMEOUT_MS: 60000,
  SELL_FORM_NAV_TIMEOUT_MS: 15000,   // カテゴリー等の選択ページへの遷移・復帰を待つ上限
  // 画像サムネイルが出そろうのを待つ上限。
  // 再出品フォームの画像は外部ツールが1枚ずつアップロードし直すため、
  // 枚数が時間をかけて増えていく（実測でprefill全体に約31秒）。
  SELL_FORM_IMAGE_TIMEOUT_MS: 30000,
  // 枚数がこの時間変わらなければ出そろったとみなす
  SELL_FORM_IMAGE_SETTLE_MS: 1500,
  // 「商品の特徴」を書き込み直す最大回数。
  // 「セット」が「シリーズ」に連動するように、親を選んで初めて現れる欄があるため、
  // 1周では書き終わらない。欄が増えなくなるまで繰り返す。
  SELL_FORM_ATTRIBUTE_MAX_PASSES: 5,
  SELL_FORM_FIX_SETTLE_MS: 300,      // 差分修正後、再読み取りまでの待機時間
  SNAPSHOT_IFRAME_TIMEOUT_MS: 30000, // 元商品の編集フォームを隠しiframeで読み込む上限
  RELIST_QUEUE_TTL_MS: 30 * 60 * 1000, // キューに残った古いエントリを破棄するまでの時間

  // 説明文の一括置換の設定
  // 説明欄だけを書き換えて保存する。出品は作らないので再出品ほど間隔は空けないが、
  // 100件超を連続で保存するため、連続アクセスが目立たない程度の間は置く。
  // 待機の基準値は画面から変えられる（既定値がこれ）。ランダム分は固定。
  DESCRIPTION_REPLACE_WAIT_BASE_MS: 8000,
  DESCRIPTION_REPLACE_WAIT_RANDOM_MS: 7000,
  DESCRIPTION_REPLACE_PAGE_TIMEOUT_MS: 30000, // 編集ページの説明欄・確定ボタンが現れるのを待つ上限
  DESCRIPTION_REPLACE_INPUT_SETTLE_MS: 300, // 説明欄へ書き込んでから読み直すまでの待機
  DESCRIPTION_REPLACE_SAVE_TIMEOUT_MS: 30000, // 保存後に商品ページへ遷移して説明文が出るのを待つ上限
  // メルカリの説明欄の上限文字数。textarea に maxlength 属性が無いのでこちらで弾く
  DESCRIPTION_REPLACE_MAX_LENGTH: 1000,

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
 * 出品フォーム（`/sell/create` / `/sell/edit/{itemId}` 共通）のフィールド定義
 *
 * 2026-09-17 にログイン状態で実地調査した DOM に合わせています。
 * name 属性を持つ実コントロールは `name` `description` `price` `shippingPayer`
 * `shippingFromArea` `shippingDuration` `listingType` の 7 つだけで、
 * カテゴリー・商品の状態・配送の方法は select ではなく「変更する」リンクで
 * 別ページへ遷移する方式です。そのため後者は表示テキストとして読み取ります。
 *
 * **ラベル文言からのフォールバック探索は持ちません。** セレクタが外れた場合は
 * 未解決として扱い、自動保存を中断します（別項目を誤って掴んで上書きするより安全なため）。
 */
export const SELL_FORM_FIELDS: readonly SellFormFieldSpec[] = [
  {
    key: 'name',
    label: '商品名',
    read: 'control',
    fix: 'control',
    selectors: ['[data-testid="input-name"] input', 'input[name="name"]'],
  },
  {
    key: 'price',
    label: '販売価格',
    read: 'control',
    fix: 'control',
    // [data-testid="price-text-input"] 配下の input は値が空なので使わない
    selectors: ['input[name="price"]'],
  },
  {
    key: 'description',
    label: '商品の説明',
    read: 'control',
    fix: 'control',
    // 自動リサイズ用の非表示 textarea が併存するため name 属性で特定する
    selectors: ['textarea[name="description"]'],
  },
  {
    key: 'category',
    label: 'カテゴリー',
    read: 'text',
    textLine: 'join',
    fix: 'category',
    selectors: ['[data-testid="sell-category"]'],
  },
  {
    key: 'condition',
    label: '商品の状態',
    read: 'text',
    // 1つ目のp要素が状態名、2つ目はその説明文
    textLine: 'first',
    fix: 'condition',
    selectors: ['[data-testid="item-condition"] p'],
  },
  {
    key: 'shippingPayer',
    label: '配送料の負担',
    read: 'control',
    fix: 'control',
    selectors: ['select[name="shippingPayer"]'],
  },
  {
    key: 'shippingMethod',
    label: '配送の方法',
    read: 'text',
    // 見出しと「変更する」を含むため最終行が値
    textLine: 'last',
    fix: 'shippingMethod',
    selectors: ['[data-testid="shipping-method-link"]'],
  },
  {
    key: 'shippingFromArea',
    label: '発送元の地域',
    read: 'control',
    fix: 'control',
    selectors: ['select[name="shippingFromArea"]'],
  },
  {
    key: 'shippingDuration',
    label: '発送までの日数',
    read: 'control',
    fix: 'control',
    selectors: ['select[name="shippingDuration"]'],
  },
  {
    key: 'attributes',
    label: '商品の特徴',
    read: 'attributes',
    fix: 'attributes',
    selectors: ['[data-testid="attribute-select"]'],
  },
  {
    // 画像はファイル実体を持たないため再アップロードできず、自動修正は不可
    key: 'imageCount',
    label: '画像枚数',
    read: 'count',
    fix: 'none',
    selectors: ['[data-testid="photo-thumbnail"] img', '[data-testid^="image-list-item-"] img'],
  },
];

/**
 * 出品フォーム関連のセレクタ
 *
 * カテゴリー・商品の状態・配送の方法は「変更する」= `<a>` で別ページへ遷移します。
 * いずれも SPA 内遷移で document は維持され、入力値・画像も保持されます。
 */
export const SELL_FORM_SELECTOR = {
  /**
   * 下書き保存ボタン。**再出品の自動処理が押すのはこれだけ。**
   *
   * 「出品する」（`[data-testid="list-item-button"]`）は**押さない**。
   * 流し込みが途中の内容でも世に出てしまい、取り消せないため。
   * 公開は下書き一覧からの一括出品で、人が見てから行う。
   */
  SAVE_DRAFT_BUTTON: ['[data-testid="save-draft"]'],

  /**
   * 編集ページ（`/sell/edit/{itemId}`）の確定ボタン「変更する」
   *
   * **押すのは説明文の一括置換だけ。** 再出品の自動保存では押さない（下書き保存に留める）。
   * 押すと出品中の商品がその場で更新されるため、押す前に説明欄の値が確定版と
   * 一字一句一致することと、商品名が変わっていないことを確認する。
   * 同じページの `[data-testid="delete-button"]`（この商品を削除する）には触れない。
   */
  EDIT_SAVE_BUTTON: ['[data-testid="edit-button"]'],
  /** 編集ページの確定ボタンの文言。data-testid だけで決めず、これも一致してから押す */
  EDIT_SAVE_TEXT: '変更する',

  /**
   * 編集ページの「この商品を削除する」ボタン
   *
   * 同じページの `[data-testid="suspend-button"]`（出品を一時停止する）と
   * 間違えないこと。一時停止は取り消せるが、削除は取り消せない。
   */
  DELETE_BUTTON: ['[data-testid="delete-button"]'],
  /**
   * 削除確認ダイアログの確定ボタン
   *
   * ダイアログには「キャンセル」と「削除する」が並ぶが、
   * この data-testid を持つのは「削除する」だけ（2026-09-21 実地確認）。
   * それでも**テキストが一致することも必ず確認してから**押す。
   */
  DELETE_CONFIRM_BUTTON: ['[data-testid="dialog-action-button"]'],
  /** 削除確認ダイアログの確定ボタンの文言 */
  DELETE_CONFIRM_TEXT: '削除する',

  /** カテゴリー選択ページへの「変更する」リンク */
  CATEGORY_LINK: [
    'a[href^="/sell/categories"]',
    '[data-testid="category-link"]',
    '[data-testid="sell-category"] a',
  ],
  /** 商品の状態の選択ページへの「変更する」リンク */
  CONDITION_LINK: ['a[href^="/sell/conditions"]', '[data-testid="item-condition"] a'],
  /** 配送の方法の選択ページへの「変更する」リンク */
  SHIPPING_METHOD_LINK: [
    'a[href^="/sell/shipping_methods"]',
    '[data-testid="shipping-method-link"] a',
  ],

  /** カテゴリー選択ページの選択肢。中間階層・最深階層のどちらもリンク */
  CATEGORY_OPTION: 'a[href^="/sell/"]',
  /** 商品の状態の選択ページの選択肢 */
  CONDITION_OPTION: 'a[data-testid^="condition-"]',
  /** 配送の方法の選択ページのラジオボタン */
  SHIPPING_METHOD_RADIO: 'input[type="radio"][name="selectedShippingMethod"]',
  /** 配送の方法を確定するボタンの文言。これを押して初めてフォームへ戻る */
  SHIPPING_METHOD_CONFIRM_TEXT: '更新する',
} as const;

/**
 * 商品ページ（`/item/{itemId}`）のセレクタ
 *
 * 説明文の一括置換が、保存後に商品ページ側の本文を読み直して照合するために使う。
 */
export const ITEM_PAGE_SELECTOR = {
  /**
   * 商品説明の表示要素
   *
   * `innerText` で読むと行頭の全角スペースも保持される（2026-09-22 実地確認）。
   * `textContent` は使わない。また表示されていない要素の `innerText` は
   * `textContent` と同じ扱いになるため、読み込む隠し iframe は `display: none` にしない。
   *
   * **改行は CRLF（`
`）で返ってくる**（2026-09-22 実地確認。手作業で保存した商品も
   * 未変更の商品も同じ）。LF で持っている本文と比べるときは改行コードを揃えること。
   */
  DESCRIPTION: ['[data-testid="description"]'],
} as const;

/**
 * カテゴリー固有の「商品の特徴」（ブランド・シリーズ・サイズなど）の扱い
 *
 * 項目数も内容もカテゴリーによって変わるため、`ラベル=選択値` の組を
 * 1つの文字列にまとめて比較します。順序の違いを差分と誤認しないよう、
 * ラベルで並べ替えてから連結します。
 */
export const ATTRIBUTE = {
  /** 未選択を表す選択肢の文言 */
  UNSELECTED_LABEL: '選択してください',
  /** 組と組の区切り */
  PAIR_SEPARATOR: '｜',
  /** ラベルと選択値の区切り */
  KEY_VALUE_SEPARATOR: '=',
} as const;

/**
 * 「変更する」リンクで遷移する選択ページのパス
 */
export const SELL_FORM_PATH = {
  CATEGORIES: '/sell/categories',
  CONDITIONS: '/sell/conditions',
  SHIPPING_METHODS: '/sell/shipping_methods',
} as const;

/**
 * カテゴリー階層の区切り文字
 *
 * `[data-testid="sell-category"]` の innerText は階層が改行区切りで入るため、
 * 比較しやすいようこの区切りで1行に連結します。
 */
export const CATEGORY_PATH_SEPARATOR = ' > ';
