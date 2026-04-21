import {
  MESSAGE_ACTION,
  DescriptionContext,
  GenerateDescriptionRequest,
  GenerateDescriptionResponse,
} from '../../common/messaging';
import { debugMethodStart, debugMethodEnd, warn } from '../infra/logger';

/**
 * background 経由で Claude API を呼び出し、商品説明文を生成するモジュール。
 *
 * - APIキーは background 側でのみ扱うため、content script からは直接 API を呼びません。
 * - 例外は投げず、必ず {@link GenerateDescriptionResponse} 形式で結果を返します。
 */

/**
 * 商品情報から説明文を生成する。
 *
 * @param context 商品名・カテゴリ・状態・画像URLなどの商品情報
 * @returns {Promise<GenerateDescriptionResponse>} 生成結果、または日本語のエラーメッセージ
 * @example
 *   const result = await requestDescription(readDescriptionContext());
 *   if (result.ok) applyDescription(result.description);
 */
export async function requestDescription(
  context: DescriptionContext
): Promise<GenerateDescriptionResponse> {
  const startTime = performance.now();
  debugMethodStart('requestDescription', {
    name: context.name,
    imageCount: context.imageSources.length,
  });

  const request: GenerateDescriptionRequest = {
    action: MESSAGE_ACTION.GENERATE_DESCRIPTION,
    payload: context,
  };

  try {
    const response = (await chrome.runtime.sendMessage(request)) as
      | GenerateDescriptionResponse
      | undefined;

    if (!response) {
      // background が応答を返さなかった場合（service workerの停止など）
      warn('backgroundから応答がありませんでした');
      return {
        ok: false,
        message:
          '拡張機能の内部処理が応答しませんでした。ページを再読み込みして再実行してください。',
      };
    }

    const duration = Math.round(performance.now() - startTime);
    debugMethodEnd('requestDescription', { ok: response.ok }, duration);
    return response;
  } catch (e) {
    warn('説明文生成メッセージの送信に失敗しました', e);
    debugMethodEnd('requestDescription', { ok: false });
    return {
      ok: false,
      message: `拡張機能の内部処理でエラーが発生しました: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
