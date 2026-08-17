/**
 * Background ⇔ Content Script 間のメッセージ定義。
 *
 * - すべてのメッセージはこのファイルの型を経由して送受信する。
 * - 新しいメッセージを追加する場合は必ずここに型を追加すること。
 * - 型は送信方向ごとに BackgroundBoundMessage / ListBoundMessage に分かれている。
 *   追加したメッセージは、どちら向きかを決めてそちらのユニオンに入れること
 *   （逆向きへ送ると送信側でコンパイルエラーになる）。
 */

/**
 * キューの処理モード
 * - relist:  /sell でフリマアシストの再出品ボタンをクリックし、
 *            開かれた新規出品ページ (/item/new) を下書きとして保存する。
 *            この段階では出品しない（公開は publish で行う）。
 * - publish: /draft の下書きの編集ページ (/drafts/{hash}/edit) を開いて出品する
 * - delete:  一覧ページの削除リンクを順にクリックして削除する。
 *            /sell・/draft の双方で使える。取り消せない操作である点に注意。
 * - replace: 出品中の商品の編集ページ (/item/{hash}/edit) を開き、説明欄だけを
 *            確定版へ置き換えて「確認する」→「更新する」で保存する。
 *            説明欄以外（価格・画像・商品名・カテゴリ・配送）には触れない。
 */
export type QueueMode = 'relist' | 'publish' | 'delete' | 'replace';

/**
 * 出品フォームを操作するモード。
 * delete は一覧ページ内で完結するためフォームを持たない。
 */
export type FormMode = Exclude<QueueMode, 'delete'>;

/**
 * replace モードで 1 商品に持たせる本文。
 * 原本は「開いた時点の説明欄がこれと一致するとき」だけ書き換えるための照合基準。
 */
export interface ReplaceText {
  /** 取得時点のラクマの本文（原本） */
  original: string;
  /** 置き換え後の本文（確定版） */
  final: string;
}

/**
 * キューに積む商品1件分の情報
 */
export interface QueueItem {
  /** 商品ID（URLのhash部分） */
  id: string;
  /** 商品名（進捗表示用。replace では編集ページの商品名との照合にも使う） */
  title: string;
  /** replace モードのときだけ入る本文 */
  replace?: ReplaceText;
}

/**
 * replace の 1 件の結果種別。
 * - applied:    保存し、保存後の商品ページの本文が確定版と一致した
 * - already:    開いた時点で確定版だった（保存していない）
 * - skipped:    照合が通らず保存しなかった（商品名不一致・原本と不一致）
 * - failed:     保存に至れなかった（要素未検出・書き込み失敗・タイムアウト等）
 * - unverified: 保存ボタンは押したが、保存後の本文を確認できなかった
 */
export type ReplaceOutcome = 'applied' | 'already' | 'skipped' | 'failed' | 'unverified';

/** 結果種別ごとの件数 */
export type ReplaceCounts = Record<ReplaceOutcome, number>;

/**
 * replace の処理記録（`chrome.storage.local` に商品IDごとの最新 1 件を持つ）
 */
export interface ReplaceRecord {
  id: string;
  name: string;
  outcome: ReplaceOutcome;
  /** スキップ・失敗・未確認の理由 */
  reason?: string;
  /** 「更新する」を押したか（押したあとの結果が不明でも true） */
  saved: boolean;
  /** 開いた時点の説明欄の文字数・ハッシュ（読めなかったときは null） */
  currentLength: number | null;
  currentHash: string | null;
  /** 確定版の文字数・ハッシュ。次回「同じ確定版で適用済み」かの判定に使う */
  expectedLength: number;
  expectedHash: string;
  /** 保存後に商品ページから読んだ本文の文字数・ハッシュ（確認できなかったときは null） */
  liveLength: number | null;
  liveHash: string | null;
  /** 記録した日時（ISO 8601） */
  at: string;
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
  /** 失敗した商品のリスト（replace ではスキップ・未確認も理由付きでここに入る） */
  failed: FailedItem[];
  /** replace のときだけ入る、結果種別ごとの件数 */
  replaceCounts?: ReplaceCounts;
  /**
   * 残りを開かずに止めた理由（replace）。
   * 説明欄や確定ボタンが見つからないのは商品固有の事情ではなく
   * ラクマ側の変更を疑うべき状況なので、1 件ずつ失敗を積まずに止める。
   */
  haltedReason?: string | null;
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
  /** bg → list: 指定商品の削除リンクをクリックせよ */
  CLICK_DELETE: 'CLICK_DELETE',
  /** list → bg: 一覧の描画が終わり、現在表示中の商品IDが確定した */
  LIST_READY: 'LIST_READY',
  /** bg → list: 進捗更新の通知 */
  QUEUE_PROGRESS: 'QUEUE_PROGRESS',
  /** form → bg: このタブは自動処理対象か問い合わせ */
  CHECK_AUTO_TAB: 'CHECK_AUTO_TAB',
  /** form → bg: 「出品する」「更新する」までクリックした（完了判定はbg側がURL遷移で行う） */
  FORM_SUBMITTED: 'FORM_SUBMITTED',
  /** form → bg: 出品・保存に失敗した（ボタン未検出・タイムアウト等） */
  FORM_FAILED: 'FORM_FAILED',
  /** form → bg: replace で、開いた時点ですでに確定版だった（保存せずに完了扱い） */
  FORM_ALREADY_APPLIED: 'FORM_ALREADY_APPLIED',
} as const;

export type MessageTypeValue = (typeof MessageType)[keyof typeof MessageType];

export interface StartQueueMessage {
  type: typeof MessageType.START_QUEUE;
  mode: QueueMode;
  items: QueueItem[];
  /**
   * 開始時に表示していた一覧のページ番号。
   * deleteモードで、削除のたびに1ページ目へ戻されたあと元のページへ復帰するために使う。
   */
  listPage?: number;
  /**
   * replace で商品間に挟む待機の基準時間 (ms)。画面から変えられる。
   * Background 側で下限（chrome.alarms が扱える 30 秒）に丸める。
   */
  waitBaseMs?: number;
}

/**
 * START_QUEUE への応答。
 *
 * Background は既にキューが実行中のとき開始を受け付けない。
 * ACK だけを返すと一覧側が開始したと誤解して実行中表示になるため、
 * 受け付けたかどうかと、受け付けなかった理由（ユーザーへ提示する文言）を返す。
 */
export interface StartQueueResponse {
  started: boolean;
  /** started が false のときの理由 */
  reason?: string;
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

export interface ClickDeleteMessage {
  type: typeof MessageType.CLICK_DELETE;
  item: QueueItem;
  /** 対象が居るはずのページ番号。クリック前にこのページへ戻る */
  page?: number | null;
}

/** CLICK_RELIST への応答 */
export interface ClickRelistResponse {
  clicked: boolean;
}

/**
 * CLICK_DELETE への応答。
 *
 * totalCount は削除の成否判定（件数が減ったか）に使うため必須にしている。
 * 省略できると、書き忘れたときに Background が弱い判定（一覧に残っていないか）へ
 * 黙ってフォールバックする。
 */
export interface ClickDeleteResponse {
  clicked: boolean;
  /**
   * クリック直前の一覧全体の件数。
   * 読み取れないページ・クリックしなかった場合は null。
   */
  totalCount: number | null;
}

/**
 * 一覧の描画完了通知。
 * deleteモードでは削除の成否判定に使う。件数が読めるページでは件数の減少で、
 * 読めないページでは表示中の商品IDに対象が残っていないかで判定する。
 */
export interface ListReadyMessage {
  type: typeof MessageType.LIST_READY;
  ids: string[];
  /** 一覧全体の件数。読み取れないページでは null */
  totalCount?: number | null;
}

export interface QueueProgressMessage {
  type: typeof MessageType.QUEUE_PROGRESS;
  progress: QueueProgress;
}

export interface CheckAutoTabMessage {
  type: typeof MessageType.CHECK_AUTO_TAB;
}

/**
 * 再出品元の商品ページから取得した、フォームに入っているべき内容。
 * 取得できなかった項目は null（その項目は差分チェックの対象外になる）。
 */
export interface SourceItem {
  name: string | null;
  description: string | null;
  price: number | null;
  brand: string | null;
  imageCount: number | null;
}

/** CHECK_AUTO_TAB への応答 */
export interface CheckAutoTabResponse {
  isAutoTab: boolean;
  /**
   * relistモードのとき、再出品元の商品情報。
   * フォームの内容がこれと一致するまで保存しないために使う。
   * 取得できなかった場合は null（差分チェックは省略される）。
   */
  expected?: SourceItem | null;
  /**
   * replaceモードのとき、処理中の商品（商品名・原本・確定版）。
   * Content Script はこれと編集ページの内容を照合してから書き換える。
   */
  replaceItem?: QueueItem | null;
}

export interface FormSubmittedMessage {
  type: typeof MessageType.FORM_SUBMITTED;
  /** replace: 開いた時点の説明欄の文字数・ハッシュ（記録用） */
  currentLength?: number;
  currentHash?: string;
}

export interface FormFailedMessage {
  type: typeof MessageType.FORM_FAILED;
  reason: string;
  /**
   * replace: 保存しなかった理由の種別。
   * skipped は照合が通らなかった商品固有の事情、failed はそれ以外。省略時は failed。
   */
  outcome?: 'skipped' | 'failed';
  /**
   * replace: 残りの商品を開かずにキューを止めるべきか。
   * 説明欄や確定ボタンが見つからないなど、ラクマ側の構造変更を疑う状況で true。
   */
  fatal?: boolean;
  /** replace: 開いた時点の説明欄の文字数・ハッシュ（記録用） */
  currentLength?: number;
  currentHash?: string;
}

export interface FormAlreadyAppliedMessage {
  type: typeof MessageType.FORM_ALREADY_APPLIED;
  currentLength: number;
  currentHash: string;
}

/**
 * list / form → bg へ送るメッセージ。
 * 送信には sendToRuntime を使う（src/common/send-message.ts）。
 */
export type BackgroundBoundMessage =
  | StartQueueMessage
  | StopQueueMessage
  | GetProgressMessage
  | ListReadyMessage
  | CheckAutoTabMessage
  | FormSubmittedMessage
  | FormFailedMessage
  | FormAlreadyAppliedMessage;

/**
 * bg → list へ送るメッセージ。
 * 送信には sendToTab を使う（src/common/send-message.ts）。
 */
export type ListBoundMessage = ClickRelistMessage | ClickDeleteMessage | QueueProgressMessage;

/**
 * 方向を問わないメッセージ全体。
 *
 * 送信側は方向ごとのユニオンで制約するため、ここを直接使うのは方向を問わず
 * 扱う箇所（応答型の対応表、Background の受信ハンドラ）に限る。
 */
export type ExtensionMessage = BackgroundBoundMessage | ListBoundMessage;

/** 応答内容を持たないメッセージへのACK */
export interface AckResponse {
  ok: boolean;
}

/**
 * MessageResponses の書き漏れを防ぐための制約。
 * ExtensionMessage のすべての種別に応答型を書くことを強制する。
 */
type ResponseMap<T extends Record<ExtensionMessage['type'], unknown>> = T;

/**
 * メッセージ種別ごとの応答の型。
 *
 * chrome.runtime.sendMessage / chrome.tabs.sendMessage の戻り値は any のため、
 * 送ったメッセージと受け取る型の対応はここでだけ定義する（送信は
 * src/common/send-message.ts の sendToRuntime / sendToTab を使う）。
 * ExtensionMessage に種別を足してここに書き忘れると、ResponseMap の制約で
 * コンパイルエラーになる。
 *
 * NOTE: ここに書くのは処理が成功したときの応答。Background がメッセージの処理に
 *       失敗した場合は種別によらず { ok: false } を返すため（src/background/index.ts）、
 *       応答を使う側は期待した内容が入っていない場合に耐えること。
 */
export type MessageResponses = ResponseMap<{
  [MessageType.START_QUEUE]: StartQueueResponse;
  [MessageType.STOP_QUEUE]: AckResponse;
  [MessageType.GET_PROGRESS]: QueueProgress;
  [MessageType.CLICK_RELIST]: ClickRelistResponse;
  [MessageType.CLICK_DELETE]: ClickDeleteResponse;
  [MessageType.LIST_READY]: AckResponse;
  [MessageType.QUEUE_PROGRESS]: AckResponse;
  [MessageType.CHECK_AUTO_TAB]: CheckAutoTabResponse;
  [MessageType.FORM_SUBMITTED]: AckResponse;
  [MessageType.FORM_FAILED]: AckResponse;
  [MessageType.FORM_ALREADY_APPLIED]: AckResponse;
}>;

/** メッセージ M を送ったときに返ってくる応答の型 */
export type ResponseTo<M extends ExtensionMessage> = MessageResponses[M['type']];
