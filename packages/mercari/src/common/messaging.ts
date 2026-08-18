/**
 * content script / background / popup 間でやり取りするメッセージの型定義。
 *
 * - `chrome.runtime.sendMessage` / `chrome.tabs.sendMessage` の payload をここで一元管理します。
 * - 新たなメッセージを追加する場合は MESSAGE_ACTION と型定義の両方を更新してください。
 *
 * - 送信は src/common/send-message.ts の sendToRuntime / sendToTab を使い、応答型は
 *   下の MessageResponses で解決します（chrome API を直接呼ぶと応答が any になる）。
 *
 * @example
 *   const res = await sendToRuntime({ action: MESSAGE_ACTION.GENERATE_DESCRIPTION, payload: context });
 *   // res: GenerateDescriptionResponse | undefined
 */

/**
 * 説明文生成で Claude に渡す画像の最大枚数
 *
 * - メルカリの出品画像は最大10枚だが、トークン量と応答速度のバランスから上限を設けています。
 * - content script 側の収集数と background 側の送信数を揃えるため、
 *   メッセージの契約としてここに定義しています（content script 専用の CONFIG とは別）。
 */
export const MAX_IMAGE_COUNT = 6;

/**
 * メッセージ種別定数
 */
export const MESSAGE_ACTION = {
  /** デバッグモードの変更通知（popup → content） */
  UPDATE_DEBUG_MODE: 'updateDebugMode',
  /** 商品説明文の生成依頼（content → background） */
  GENERATE_DESCRIPTION: 'generateDescription',
  /** このタブを「下書き保存後に閉じる」と印を付ける（content → background） */
  MARK_TAB_FOR_CLOSE: 'markTabForClose',
  /** 印が付いていればこのタブを閉じる（content → background） */
  CLOSE_TAB_IF_MARKED: 'closeTabIfMarked',
} as const;

/**
 * 「下書き保存後に閉じる」印の有効期限
 *
 * 保存に失敗して遷移しなかった場合、印が残り続けます。期限を設けて、
 * あとから開いた無関係なタブを閉じてしまわないようにします。
 */
export const PENDING_TAB_CLOSE_TTL_MS = 5 * 60 * 1000;

/**
 * カテゴリ固有の商品属性（ブランド・サイズ・シリーズなど）
 *
 * - メルカリの出品フォームはカテゴリによって入力項目が変わるため、
 *   決め打ちの項目ではなくラベルと値の組で受け渡します。
 */
export interface ItemAttribute {
  /** 属性名（例: ブランド、サイズ、シリーズ） */
  label: string;
  /** 選択されている値 */
  value: string;
}

/**
 * 商品説明文の生成に必要な商品情報
 */
export interface DescriptionContext {
  /** 商品名 */
  name: string;
  /** カテゴリ（例: レディース > トップス > Tシャツ） */
  category?: string;
  /** 商品の状態（例: 目立った傷や汚れなし） */
  condition?: string;
  /** 配送方法（例: らくらくメルカリ便） */
  shippingMethod?: string;
  /** カテゴリ固有の属性一覧 */
  attributes: ItemAttribute[];
  /** 既存の説明文（あれば参考情報として渡す） */
  currentDescription?: string;
  /**
   * 商品画像のソース一覧
   *
   * - メルカリの編集ページでは出品画像が data:image/jpeg;base64,... 形式のデータURIで保持されています。
   *   https のURLも受け付けられるよう、どちらの形式も許容します。
   */
  imageSources: string[];
}

/**
 * 商品説明文の生成依頼メッセージ
 */
export interface GenerateDescriptionRequest {
  action: typeof MESSAGE_ACTION.GENERATE_DESCRIPTION;
  payload: DescriptionContext;
}

/**
 * 商品説明文の生成結果メッセージ
 *
 * - 成功時は `ok: true` と生成された説明文、失敗時は `ok: false` と日本語のエラーメッセージを返します。
 */
export type GenerateDescriptionResponse =
  | { ok: true; description: string }
  | { ok: false; message: string };

/**
 * デバッグモード変更通知メッセージ
 */
export interface UpdateDebugModeRequest {
  action: typeof MESSAGE_ACTION.UPDATE_DEBUG_MODE;
  debugMode: boolean;
}

/**
 * このタブを「下書き保存後に閉じる」と印を付ける依頼
 *
 * 再出品タブは下書き保存に成功すると下書き一覧へ遷移し、開いたまま残ります。
 * content script は自分のタブIDを知らず、`window.close()` も確実ではないため、
 * タブIDを知っている background に閉じてもらいます。
 */
export interface MarkTabForCloseRequest {
  action: typeof MESSAGE_ACTION.MARK_TAB_FOR_CLOSE;
}

/**
 * 印が付いていればこのタブを閉じる依頼
 *
 * 下書き一覧ページの読み込み時に送ります。印の付いたタブIDと一致したときだけ閉じるので、
 * ユーザーが自分で開いた下書き一覧のタブが閉じることはありません。
 */
export interface CloseTabIfMarkedRequest {
  action: typeof MESSAGE_ACTION.CLOSE_TAB_IF_MARKED;
}

/**
 * タブ操作の結果
 */
export interface TabCloseResponse {
  /** 印を付けた／タブを閉じたか */
  ok: boolean;
}

/**
 * content script → background へ送るメッセージ。
 * 送信には sendToRuntime を使う（src/common/send-message.ts）。
 */
export type BackgroundBoundMessage =
  | GenerateDescriptionRequest
  | MarkTabForCloseRequest
  | CloseTabIfMarkedRequest;

/**
 * popup → content script へ送るメッセージ。
 * 送信には sendToTab を使う（src/common/send-message.ts）。
 */
export type ContentBoundMessage = UpdateDebugModeRequest;

/**
 * 拡張機能内でやり取りされるメッセージの総称
 *
 * 送信側は方向ごとのユニオンで制約するため、ここを直接使うのは方向を問わず
 * 扱う箇所（応答型の対応表、background の受信ハンドラ）に限る。
 */
export type ExtensionMessage = BackgroundBoundMessage | ContentBoundMessage;

/**
 * MessageResponses の書き漏れを防ぐための制約。
 * ExtensionMessage のすべての種別に応答型を書くことを強制する。
 */
type ResponseMap<T extends Record<ExtensionMessage['action'], unknown>> = T;

/**
 * メッセージ種別ごとの応答の型。
 *
 * chrome.runtime.sendMessage / chrome.tabs.sendMessage の戻り値は any のため、
 * 送ったメッセージと受け取る型の対応はここでだけ定義する（送信は
 * src/common/send-message.ts の sendToRuntime / sendToTab を使う）。
 * ExtensionMessage に種別を足してここに書き忘れると、ResponseMap の制約で
 * コンパイルエラーになる。
 */
export type MessageResponses = ResponseMap<{
  [MESSAGE_ACTION.GENERATE_DESCRIPTION]: GenerateDescriptionResponse;
  [MESSAGE_ACTION.MARK_TAB_FOR_CLOSE]: TabCloseResponse;
  [MESSAGE_ACTION.CLOSE_TAB_IF_MARKED]: TabCloseResponse;
  /** content script は受け取るだけで応答を返さない */
  [MESSAGE_ACTION.UPDATE_DEBUG_MODE]: undefined;
}>;

/** メッセージ M を送ったときに返ってくる応答の型 */
export type ResponseTo<M extends ExtensionMessage> = MessageResponses[M['action']];
