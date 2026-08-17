/**
 * Background ⇔ Content Script 間のメッセージ定義。
 *
 * - すべてのメッセージはこのファイルの型を経由して送受信する。
 * - 新しいメッセージを追加する場合は必ずここに型を追加すること。
 */

/**
 * キューの処理モード
 * - relist:  /sell でフリマアシストの再出品ボタンをクリックし、
 *            開かれた新規出品ページ (/item/new) で出品する
 * - publish: /draft の下書きの編集ページ (/drafts/{hash}/edit) を開いて出品する
 */
export type QueueMode = 'relist' | 'publish';

/**
 * キューに積む商品1件分の情報
 */
export interface QueueItem {
  /** 商品ID（URLのhash部分） */
  id: string;
  /** 商品名（進捗表示用） */
  title: string;
}

/**
 * 処理に失敗した商品と、その理由
 */
export interface FailedItem {
  item: QueueItem;
  reason: string;
}

/**
 * キュー全体の進捗情報
 */
export interface QueueProgress {
  mode: QueueMode;
  total: number;
  /** 完了した件数（成功・失敗の合計） */
  done: number;
  /** 処理中の商品（なければnull） */
  current: QueueItem | null;
  running: boolean;
  /** 失敗した商品のリスト */
  failed: FailedItem[];
}

/** メッセージ種別 */
export const MessageType = {
  /** list → bg: キュー開始 */
  START_QUEUE: 'START_QUEUE',
  /** list → bg: キュー停止 */
  STOP_QUEUE: 'STOP_QUEUE',
  /** list → bg: 現在の進捗を要求（ページ再読込時のUI復元用） */
  GET_PROGRESS: 'GET_PROGRESS',
  /** bg → list: 指定商品の再出品ボタンをクリックせよ */
  CLICK_RELIST: 'CLICK_RELIST',
  /** bg → list: 進捗更新の通知 */
  QUEUE_PROGRESS: 'QUEUE_PROGRESS',
  /** form → bg: このタブは自動処理対象か問い合わせ */
  CHECK_AUTO_TAB: 'CHECK_AUTO_TAB',
  /** form → bg: 「出品する」までクリックした（完了判定はbg側がURL遷移で行う） */
  FORM_SUBMITTED: 'FORM_SUBMITTED',
  /** form → bg: 出品に失敗した（ボタン未検出・タイムアウト等） */
  FORM_FAILED: 'FORM_FAILED',
} as const;

export type MessageTypeValue = (typeof MessageType)[keyof typeof MessageType];

export interface StartQueueMessage {
  type: typeof MessageType.START_QUEUE;
  mode: QueueMode;
  items: QueueItem[];
}

export interface StopQueueMessage {
  type: typeof MessageType.STOP_QUEUE;
}

export interface GetProgressMessage {
  type: typeof MessageType.GET_PROGRESS;
}

export interface ClickRelistMessage {
  type: typeof MessageType.CLICK_RELIST;
  item: QueueItem;
}

export interface QueueProgressMessage {
  type: typeof MessageType.QUEUE_PROGRESS;
  progress: QueueProgress;
}

export interface CheckAutoTabMessage {
  type: typeof MessageType.CHECK_AUTO_TAB;
}

/** CHECK_AUTO_TAB への応答 */
export interface CheckAutoTabResponse {
  isAutoTab: boolean;
}

export interface FormSubmittedMessage {
  type: typeof MessageType.FORM_SUBMITTED;
}

export interface FormFailedMessage {
  type: typeof MessageType.FORM_FAILED;
  reason: string;
}

export type ExtensionMessage =
  | StartQueueMessage
  | StopQueueMessage
  | GetProgressMessage
  | ClickRelistMessage
  | QueueProgressMessage
  | CheckAutoTabMessage
  | FormSubmittedMessage
  | FormFailedMessage;
