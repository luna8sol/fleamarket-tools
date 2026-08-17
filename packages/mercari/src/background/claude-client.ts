import Anthropic from '@anthropic-ai/sdk';
import { DescriptionContext } from '../common/messaging';
import { ExtStorageKey, getExtStorage } from '../common/ext-storage';
import { DESCRIPTION_SYSTEM_PROMPT, buildDescriptionMessages } from './prompt';

/**
 * Claude API の呼び出しを担当するモジュール。
 *
 * - background（service worker）からのみ利用します。APIキーを content script に渡さないための構成です。
 * - APIキーは {@link getExtStorage} 経由で chrome.storage.local から読み込み、
 *   このモジュールの外へは出しません（戻り値・例外メッセージ・ログのいずれにも含めない）。
 */

/**
 * 利用するモデルID
 */
const MODEL = 'claude-opus-5';

/**
 * 1リクエストあたりの最大出力トークン数
 */
const MAX_TOKENS = 16000;

/**
 * 思考の深さ。説明文生成は定型作業のため medium で十分。
 */
const EFFORT = 'medium';

/**
 * APIキー未設定時に投げる例外
 *
 * - {@link toJapaneseErrorMessage} ではなく、呼び出し側でそのままメッセージを表示します。
 */
export class ApiKeyNotConfiguredError extends Error {
  constructor() {
    super('Claude APIキーが設定されていません。拡張機能のオプション画面から設定してください。');
    this.name = 'ApiKeyNotConfiguredError';
  }
}

/**
 * Claude クライアントを生成する。
 *
 * @returns {Promise<Anthropic>} 生成したクライアント
 * @throws {ApiKeyNotConfiguredError} APIキーが未設定の場合
 */
async function createClient(): Promise<Anthropic> {
  const apiKey = await getExtStorage<string>(ExtStorageKey.CLAUDE_API_KEY, '');
  if (apiKey.trim() === '') {
    throw new ApiKeyNotConfiguredError();
  }
  return new Anthropic({ apiKey: apiKey.trim() });
}

/**
 * レスポンスからテキストブロックを連結して取り出す。
 *
 * @param message Claude API のレスポンス
 * @returns {string} 生成されたテキスト
 */
function extractText(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();
}

/**
 * 商品情報から商品説明文を生成する。
 *
 * @param context 商品名・カテゴリ・状態・画像URLなどの商品情報
 * @returns {Promise<string>} 生成された説明文
 * @throws {ApiKeyNotConfiguredError} APIキーが未設定の場合
 * @throws {Anthropic.APIError} API 呼び出しに失敗した場合
 * @example
 *   const description = await generateDescription({ name: 'Tシャツ', attributes: [], imageSources: [] });
 */
export async function generateDescription(context: DescriptionContext): Promise<string> {
  const client = await createClient();

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    thinking: { type: 'adaptive' },
    output_config: { effort: EFFORT },
    system: DESCRIPTION_SYSTEM_PROMPT,
    messages: buildDescriptionMessages(context),
  });

  if (message.stop_reason === 'refusal') {
    throw new Error(
      'この商品については説明文の生成が拒否されました。商品情報や画像を見直してください。'
    );
  }

  const text = extractText(message);
  if (text === '') {
    throw new Error('説明文を生成できませんでした。時間をおいて再実行してください。');
  }

  if (message.stop_reason === 'max_tokens') {
    throw new Error('説明文が長くなりすぎたため生成を中断しました。再実行してください。');
  }

  return text;
}
