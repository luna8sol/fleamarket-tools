import {
  BackgroundBoundMessage,
  ContentBoundMessage,
  MessageResponses,
  ResponseTo,
} from './messaging';
import { createMessaging } from '@fleamarket/core/messaging';

/**
 * content script / popup → background / content のメッセージ送信。
 *
 * chrome.runtime.sendMessage / chrome.tabs.sendMessage の戻り値は any のため、
 * 呼び出し側でそれぞれ型アサーションを書くと、送ったメッセージと受け取る型が
 * 食い違っていてもコンパイラが検査できない。応答型の対応は messaging.ts の
 * MessageResponses に一元化し、アサーションは共有部品 `@fleamarket/core/messaging`
 * に閉じ込める（判別キー `action` と対応表を型で渡す）。
 *
 * 送信の失敗（受け手が居ない・チャネルが閉じた等）はここでは握り潰さない。
 * chrome API の reject はそのまま呼び出し側へ伝える。
 *
 * 引数のメッセージは送信方向ごとのユニオンで制約する。逆向きのメッセージ
 * （例: sendToTab に GENERATE_DESCRIPTION）を渡すとコンパイルエラーになる。
 */
const messaging = createMessaging<'action', MessageResponses>();

/**
 * background へ送る（content script から使う）。
 *
 * background が応答を返す前に service worker が破棄された場合は reject する。
 */
export async function sendToRuntime<M extends BackgroundBoundMessage>(
  message: M
): Promise<ResponseTo<M> | undefined> {
  return messaging.sendToRuntime(message);
}

/**
 * 指定タブの content script へ送る（popup から使う）。
 *
 * タブが閉じている・content script が注入されていない場合は reject する。
 */
export async function sendToTab<M extends ContentBoundMessage>(
  tabId: number,
  message: M
): Promise<ResponseTo<M> | undefined> {
  return messaging.sendToTab(tabId, message);
}
