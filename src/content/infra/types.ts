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
 */
export type CompareFieldKey =
  | 'name'
  | 'price'
  | 'description'
  | 'categoryId'
  | 'conditionId'
  | 'shippingPayerId'
  | 'shippingMethodId'
  | 'shippingFromAreaId'
  | 'shippingDurationId'
  | 'imageCount';

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
 * 出品フォームから読み取った値と、その入力要素
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
 * 出品フォームの入力欄の種別
 */
export type SellFormFieldKind = 'text' | 'number' | 'textarea' | 'select' | 'count';

/**
 * 出品フォーム上の1フィールドの探索・比較定義
 *
 * メルカリ側のDOMは変更されうるため、セレクタは候補を配列で持ち、
 * 先頭から順に試して最初に見つかったものを採用します。
 * すべて外れた場合は labelTexts（画面上のラベル文言）から要素を辿ります。
 */
export interface SellFormFieldSpec {
  key: CompareFieldKey;
  /** 表示用のフィールド名 */
  label: string;
  kind: SellFormFieldKind;
  /** 差分が出たときに自動修正できるフィールドか */
  fixable: boolean;
  /** 入力要素の候補セレクタ（優先順） */
  selectors: string[];
  /** セレクタで見つからない場合に使うラベル文言の候補 */
  labelTexts: string[];
}
