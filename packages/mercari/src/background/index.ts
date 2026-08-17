// background（service worker）のエントリーポイント
import { debug, error as logError } from '../content/infra/logger';
import {
  MESSAGE_ACTION,
  ExtensionMessage,
  GenerateDescriptionRequest,
  GenerateDescriptionResponse,
  PENDING_TAB_CLOSE_TTL_MS,
  TabCloseResponse,
} from '../common/messaging';
import { ExtStorageKey, getExtStorage, setExtStorage } from '../common/ext-storage';
import { generateDescription, ApiKeyNotConfiguredError } from './claude-client';
import { toJapaneseErrorMessage } from './api-error';

/**
 * 説明文生成リクエストを処理し、結果を返す。
 *
 * - 例外はすべて捕捉し、日本語メッセージに変換して `ok: false` で返します。
 *   （例外をそのまま throw すると content script 側では原因がわからないため）
 *
 * @param request 説明文生成リクエスト
 * @returns {Promise<GenerateDescriptionResponse>} 生成結果
 */
async function handleGenerateDescription(
  request: GenerateDescriptionRequest
): Promise<GenerateDescriptionResponse> {
  debug('説明文の生成を開始します', {
    name: request.payload.name,
    imageCount: request.payload.imageSources.length,
  });

  try {
    const description = await generateDescription(request.payload);
    debug('説明文の生成が完了しました', { length: description.length });
    return { ok: true, description };
  } catch (e) {
    logError('説明文の生成に失敗しました', e);
    if (e instanceof ApiKeyNotConfiguredError) {
      return { ok: false, message: e.message };
    }
    return { ok: false, message: toJapaneseErrorMessage(e) };
  }
}

/**
 * 「下書き保存後に閉じる」印
 *
 * service worker は停止しうるためメモリではなくストレージに置きます。
 */
interface PendingTabClose {
  tabId: number;
  markedAt: number;
}

/**
 * このタブを「下書き保存後に閉じる」と印を付ける
 *
 * @param tabId 送信元のタブID
 * @returns 印を付けられたか
 */
async function markTabForClose(tabId: number | undefined): Promise<TabCloseResponse> {
  if (tabId === undefined) {
    debug('送信元のタブIDが取得できないため、閉じる印を付けません');
    return { ok: false };
  }

  const saved = await setExtStorage<PendingTabClose>(ExtStorageKey.PENDING_TAB_CLOSE, {
    tabId,
    markedAt: Date.now(),
  });
  debug('タブに閉じる印を付けました', { tabId, saved });
  return { ok: saved };
}

/**
 * 印の付いたタブなら閉じる
 *
 * **印のタブIDと送信元が一致したときだけ閉じます。** ユーザーが自分で開いた
 * 下書き一覧のタブを巻き添えにしないためです。
 *
 * @param tabId 送信元のタブID
 * @returns 閉じたか
 */
async function closeTabIfMarked(tabId: number | undefined): Promise<TabCloseResponse> {
  const pending = await getExtStorage<PendingTabClose | null>(
    ExtStorageKey.PENDING_TAB_CLOSE,
    null
  );

  if (!pending || tabId === undefined || pending.tabId !== tabId) {
    return { ok: false };
  }

  // 印を先に消す。閉じる処理が失敗しても、古い印が残り続けないようにする
  await setExtStorage<PendingTabClose | null>(ExtStorageKey.PENDING_TAB_CLOSE, null);

  if (Date.now() - pending.markedAt > PENDING_TAB_CLOSE_TTL_MS) {
    debug('閉じる印の有効期限が切れています', { tabId });
    return { ok: false };
  }

  try {
    await chrome.tabs.remove(tabId);
    debug('下書き保存後のタブを閉じました', { tabId });
    return { ok: true };
  } catch (e) {
    logError('タブを閉じられませんでした', e);
    return { ok: false };
  }
}

// メッセージリスナー（service worker 起動直後に同期的に登録する必要がある）
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  switch (message?.action) {
    case MESSAGE_ACTION.GENERATE_DESCRIPTION:
      handleGenerateDescription(message).then(sendResponse);
      break;
    case MESSAGE_ACTION.MARK_TAB_FOR_CLOSE:
      markTabForClose(sender.tab?.id).then(sendResponse);
      break;
    case MESSAGE_ACTION.CLOSE_TAB_IF_MARKED:
      closeTabIfMarked(sender.tab?.id).then(sendResponse);
      break;
    default:
      return undefined;
  }

  // 非同期でsendResponseを呼ぶため true を返してメッセージチャネルを開いたままにする
  return true;
});
