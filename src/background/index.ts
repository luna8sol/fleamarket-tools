// background（service worker）のエントリーポイント
import { debug, error as logError } from '../content/infra/logger';
import {
  MESSAGE_ACTION,
  ExtensionMessage,
  GenerateDescriptionRequest,
  GenerateDescriptionResponse,
} from '../common/messaging';
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

// メッセージリスナー（service worker 起動直後に同期的に登録する必要がある）
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message?.action !== MESSAGE_ACTION.GENERATE_DESCRIPTION) {
    return undefined;
  }

  handleGenerateDescription(message).then(sendResponse);

  // 非同期でsendResponseを呼ぶため true を返してメッセージチャネルを開いたままにする
  return true;
});
