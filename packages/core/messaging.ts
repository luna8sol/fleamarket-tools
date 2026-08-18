/**
 * 型付きメッセージ送信（両拡張で共通の骨格）。
 *
 * `chrome.runtime.sendMessage` / `chrome.tabs.sendMessage` の戻り値は any なので、
 * 呼び出し側ごとに型アサーションを書くと、送ったメッセージと受け取る型の食い違いを
 * コンパイラが検査できない。判別キー（メルカリは `action`、ラクマは `type`）と
 * 「種別 → 応答型」の対応表を型パラメータで受け取り、アサーションをここに閉じ込める。
 * 送信方向ごとの制約（background 行き / content 行き）は各パッケージのラッパーで付ける。
 *
 * 送信の失敗（受け手が居ない・チャネルが閉じた等）は握り潰さない。通信できなかったことを
 * 失敗として扱うか無視してよいかは呼び出し側の判断なので、chrome API の reject はそのまま
 * 呼び出し側へ伝える。受け手が応答を返さなかった場合は undefined になるので、
 * 戻り値は常に `| undefined`。
 */

/** 判別キー `K` の値が応答表 `Responses` のキーであるメッセージ */
export type KeyedMessage<K extends string, Responses> = Record<K, keyof Responses & string>;

/** メッセージ `M` を送ったときに返ってくる応答の型 */
export type ResponseOf<
  K extends string,
  Responses,
  M extends KeyedMessage<K, Responses>,
> = Responses[M[K]];

export interface Messaging<K extends string, Responses> {
  /**
   * 拡張の runtime（service worker）へ送る。
   *
   * 受け手が応答を返す前に service worker が破棄された場合は reject する。
   */
  sendToRuntime<M extends KeyedMessage<K, Responses>>(
    message: M
  ): Promise<ResponseOf<K, Responses, M> | undefined>;
  /**
   * 指定タブの content script へ送る。
   *
   * タブが閉じている・content script が注入されていない場合は reject する。
   */
  sendToTab<M extends KeyedMessage<K, Responses>>(
    tabId: number,
    message: M
  ): Promise<ResponseOf<K, Responses, M> | undefined>;
}

export function createMessaging<K extends string, Responses>(): Messaging<K, Responses> {
  return {
    async sendToRuntime<M extends KeyedMessage<K, Responses>>(
      message: M
    ): Promise<ResponseOf<K, Responses, M> | undefined> {
      return (await chrome.runtime.sendMessage(message)) as ResponseOf<K, Responses, M> | undefined;
    },

    async sendToTab<M extends KeyedMessage<K, Responses>>(
      tabId: number,
      message: M
    ): Promise<ResponseOf<K, Responses, M> | undefined> {
      return (await chrome.tabs.sendMessage(tabId, message)) as
        | ResponseOf<K, Responses, M>
        | undefined;
    },
  };
}
