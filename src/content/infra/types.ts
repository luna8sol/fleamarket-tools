/**
 * ユーザー設定の型定義
 */
export interface UserSettings {
  waitTimeBetweenRelists: number; // ms
  randomizeWaitTime: boolean;
  maxRandomTime: number; // ms
  autoSelectLatest: boolean;
  maxSelectCount: number;
  debugMode: boolean;
}

/**
 * 再出品後の自動保存に関する設定
 *
 * UserSettings（localStorage）とは別に chrome.storage.local へ保存します。
 * 出品フォームは別タブ・別ページで開かれるため、拡張機能全体で共有できる
 * ストレージに置く必要があるためです。
 */
export interface AutoSaveSettings {
  /** 再出品タブでの自動保存を有効にするか */
  autoSaveAfterRelist: boolean;
  /**
   * ドライラン（比較・差分修正まで行い、最後の保存ボタンは押さない）
   * 出品フォームのセレクタが実環境と一致しているか検証するための安全弁です。
   */
  autoSaveDryRun: boolean;
}

/**
 * 比較対象となるフィールドのキー
 *
 * 出品フォームと編集フォームは同じ部品でできているため、比較はフォーム対フォームで行います。
 * カテゴリー・商品の状態・配送の方法は select ではなく画面上の表示テキストとして読み取るため、
 * ID ではなく表示名で保持します。
 */
export type CompareFieldKey =
  | 'name'
  | 'price'
  | 'description'
  | 'category'
  | 'condition'
  | 'shippingPayer'
  | 'shippingMethod'
  | 'shippingFromArea'
  | 'shippingDuration'
  | 'imageCount'
  | 'attributes';

/**
 * 比較用に正規化した値の集合
 * すべて文字列として保持し、比較を単純化します（未取得のキーは持たない）。
 */
export type CompareValues = Partial<Record<CompareFieldKey, string>>;

/**
 * 再出品元となる既存商品のスナップショット
 */
export interface ItemSnapshot {
  /** 元商品のID */
  itemId: string;
  /** 元商品の商品名（ログ・通知用） */
  itemName: string;
  /** 取得に成功したか（失敗時は自動保存を行わない） */
  captured: boolean;
  /** 取得失敗時の理由 */
  captureError?: string;
  /** 取得時刻（epoch ms） */
  capturedAt: number;
  /** 比較対象の値 */
  values: CompareValues;
}

/**
 * 出品フォームから読み取った値と、その解決状況
 */
export interface SellFormReadResult {
  values: CompareValues;
  /** 解決できなかったフィールド（セレクタ不一致の可能性） */
  unresolved: CompareFieldKey[];
}

/**
 * 1フィールド分の差分
 */
export interface FieldDiff {
  key: CompareFieldKey;
  /** 表示用のフィールド名 */
  label: string;
  /** 元商品の値 */
  expected: string;
  /** 出品フォームの現在値（未解決の場合は null） */
  actual: string | null;
  /** 自動修正が可能なフィールドか */
  fixable: boolean;
}

/**
 * 差分修正の結果
 */
export interface FixResult {
  /** 修正に成功した差分 */
  fixed: FieldDiff[];
  /** 修正できなかった差分 */
  unfixed: FieldDiff[];
}

/**
 * 自動保存処理の結果種別
 */
export enum AutoSaveOutcome {
  /** 自動保存が無効、または対象エントリなし */
  SKIPPED = 'skipped',
  /** 比較・修正の結果、保存まで完了した */
  SAVED = 'saved',
  /** ドライランのため保存はしていないが、検証は通過した */
  DRY_RUN = 'dryRun',
  /** 修正できない差分が残ったため中断した */
  ABORTED = 'aborted',
  /** 処理中にエラーが発生した */
  FAILED = 'failed',
}

/**
 * 自動保存処理の結果
 */
export interface AutoSaveResult {
  outcome: AutoSaveOutcome;
  itemId: string | null;
  diffs: FieldDiff[];
  fixed: FieldDiff[];
  unfixed: FieldDiff[];
  message: string;
}

/**
 * 出品フォームの値の読み取り方
 *
 * - `control`: input / textarea / select の value を読む
 * - `text`: 「変更する」リンク方式の項目。画面上の表示テキストを読む
 * - `count`: 該当要素の個数を数える（画像枚数）
 * - `attributes`: カテゴリー固有の「商品の特徴」（可変個の select）をまとめて1つの文字列にする
 */
export type SellFormReadKind = 'control' | 'text' | 'count' | 'attributes';

/**
 * `text` 読み取りで innerText のどの行を値とするか
 *
 * - `first`: 1行目（商品の状態。2行目以降は説明文）
 * - `last`: 最終行（配送の方法。見出しと「変更する」を含むため）
 * - `join`: 全行を ` > ` で連結（カテゴリーの階層）
 */
export type SellFormTextLine = 'first' | 'last' | 'join';

/**
 * 出品フォームの値の直し方
 *
 * - `control`: 入力欄へ直接書き込む
 * - `category` / `condition` / `shippingMethod`: 別ページへ遷移して選び直す
 * - `attributes`: 「商品の特徴」の各 select を選び直す
 * - `none`: 自動修正できない（画像枚数）
 */
export type SellFormFixKind =
  | 'control'
  | 'category'
  | 'condition'
  | 'shippingMethod'
  | 'attributes'
  | 'none';

/**
 * 出品フォーム上の1フィールドの探索・比較定義
 *
 * メルカリ側の DOM は変更されうるため、セレクタは候補を配列で持ち、
 * 先頭から順に試して最初に見つかったものを採用します。
 *
 * **ラベル文言からのフォールバック探索は行いません。** 実地検証で
 * 「配送の方法」が近くの shippingPayer の select を掴むことが確認されており、
 * 別項目を上書きする事故につながるためです。セレクタが全て外れた場合は
 * 未解決として扱い、自動保存を中断します。
 */
export interface SellFormFieldSpec {
  key: CompareFieldKey;
  /** 表示用のフィールド名 */
  label: string;
  /** 値の読み取り方 */
  read: SellFormReadKind;
  /** 値の直し方 */
  fix: SellFormFixKind;
  /** 要素の候補セレクタ（優先順） */
  selectors: readonly string[];
  /** `read: 'text'` のときに使う行の取り方 */
  textLine?: SellFormTextLine;
}
