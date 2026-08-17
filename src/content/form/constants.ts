/**
 * 出品フォームページ用の定数の一元管理モジュール。
 * 新たなラベル・設定値はこのファイルに追加すること。
 */

/**
 * 操作するボタンのラベル。
 *
 * ラクマの出品フォームは React / Chakra UI 製で css-* クラスがビルドごとに
 * 変わるため、ボタンはこのテキストの完全一致で特定する
 * （src/content/form/button-finder.ts）。実機の表記と 1 文字でも違うと
 * ボタンが見つからず自動処理が止まるので、値は実機を確認せずに変えないこと。
 *
 * NOTE: /item/new と /drafts/{hash}/edit はどちらも「下書きに保存する」と
 *       「確認する」を持つ。押すボタンはページの中身ではなくキューのモードで
 *       決めること（ラベルからページを判別してはいけない）。
 */
export const LABEL = {
  DRAFT_SAVE: '下書きに保存する',
  CONFIRM: '確認する',
  PUBLISH: '出品する',
  /** 出品中商品の編集ページ (/item/{hash}/edit) で「確認する」のあとに出る確定ボタン（replace 用） */
  UPDATE: '更新する',
};

/**
 * 出品フォームの入力欄のセレクタ（name 属性で特定する。css-* クラスは使わない）。
 * 2026-09-28 に /item/{hash}/edit で実機確認。
 */
export const FIELD = {
  /** 商品名 */
  ITEM_NAME: 'input[name="itemName"]',
  /** 商品説明（ラベル「商品説明」。maxLength 属性は無く、隣に「N/1000」の文字数表示が出る） */
  DESCRIPTION: 'textarea[name="detail"]',
};

/**
 * 設定値定数
 */
export const CONFIG = {
  /** 各ボタンの出現を待つ最大時間 (ms) */
  BUTTON_TIMEOUT_MS: 30000,
  /** フォームの内容がこの時間だけ変化しなければ入力完了とみなす (ms) */
  FORM_STABLE_MS: 5000,
  /** 入力完了を待つ最大時間 (ms)。画像のアップロードを待つため長めにとる */
  FORM_SETTLE_TIMEOUT_MS: 120000,
  /** ボタンクリック間の待機時間 (ms) — 人間的な間を空ける */
  CLICK_DELAY_MS: 1500,
  /** 自動処理対象かの問い合わせ回数 */
  CHECK_ATTEMPTS: 3,
  /** 問い合わせのリトライ間隔 (ms) */
  CHECK_RETRY_MS: 700,
  /**
   * 入力完了を待つあいだにフォームを読み直す間隔 (ms)。
   *
   * src/content/wait.ts の pollUntil の既定値と同値だが、入力完了の待機は
   * 「変化が止まったか」を自前のループで見ており pollUntil を通らないため、
   * 既定値に頼らずここで明示する。
   */
  POLL_INTERVAL_MS: 500,
  /** 失敗理由に添えるエラー文言の最大件数 */
  MAX_ERRORS: 4,
  /** 失敗理由に載せるエラー文言の最大文字数。これを超えるものは説明文とみなして捨てる */
  MAX_ERROR_LENGTH: 60,
  /** 失敗時の手がかりに載せるボタンラベルの最大文字数。これを超えるものはボタン以外とみなして捨てる */
  MAX_BUTTON_LABEL_LENGTH: 24,

  // replace（説明文の置換）用
  /** 編集ページに値が入るまで待つ最大時間 (ms)。値は SSR に無くクライアントで流し込まれる */
  REPLACE_PAGE_READY_TIMEOUT_MS: 30000,
  /** 書き込みが React の状態に反映されるのを待つ時間 (ms) */
  REPLACE_INPUT_SETTLE_MS: 500,
  /** 説明欄の上限文字数（編集ページの表示「N/1000」から。maxLength 属性は無い） */
  REPLACE_MAX_DESCRIPTION_LENGTH: 1000,
};
