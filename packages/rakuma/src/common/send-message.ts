import { BackgroundBoundMessage, ListBoundMessage, MessageResponses, ResponseTo } from './messages';
import { createMessaging } from '@fleamarket/core/messaging';

/**
 * Background ⇔ Content Script のメッセージ送信。
 *
 * chrome.tabs.sendMessage / chrome.runtime.sendMessage の戻り値は any のため、
 * 呼び出し側でそれぞれ型アサーションを書くと、送ったメッセージと受け取る型が
 * 食い違っていてもコンパイラが検査できない。応答型の対応は
 * messages.ts の MessageResponses に一元化し、アサーションは共有部品
 * `@fleamarket/core/messaging` に閉じ込める（判別キー `type` と対応表を型で渡す）。
 *
 * 送信の失敗（受け手が居ない・チャネルが閉じた等）はここでは握り潰さない。
 * 通信できなかったことを失敗として扱うか無視してよいかは呼び出し側の判断のため、
 * chrome API の reject はそのまま呼び出し側へ伝える。
 *
 * 引数のメッセージは送信方向ごとのユニオンで制約する。逆向きのメッセージ
 * （例: sendToTab に START_QUEUE）を渡すとコンパイルエラーになる。
 */
const messaging = createMessaging<'type', MessageResponses>();

/**
 * 指定タブのContent Scriptへ送る（Backgroundから使う）。
 *
 * タブが閉じている・Content Scriptが注入されていない場合は reject する。
 */
export async function sendToTab<M extends ListBoundMessage>(
  tabId: number,
  message: M
): Promise<ResponseTo<M> | undefined> {
  return messaging.sendToTab(tabId, message);
}

/**
 * Backgroundへ送る（Content Scriptから使う）。
 *
 * Backgroundが応答を返す前にService Workerが破棄された場合は reject する。
 */
export async function sendToRuntime<M extends BackgroundBoundMessage>(
  message: M
): Promise<ResponseTo<M> | undefined> {
  return messaging.sendToRuntime(message);
}
