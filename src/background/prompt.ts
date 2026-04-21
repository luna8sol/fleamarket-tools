import type Anthropic from '@anthropic-ai/sdk';
import { DescriptionContext, MAX_IMAGE_COUNT } from '../common/messaging';

/**
 * Claude に渡すプロンプトの組み立てを担当するモジュール。
 *
 * - システムプロンプトと、商品情報・画像から成るユーザーメッセージを生成します。
 * - プロンプトの文言を変更したい場合はこのファイルだけを編集すれば済むようにしています。
 */

/**
 * データURI（data:image/jpeg;base64,...）を分解する正規表現
 */
const DATA_URI_PATTERN = /^data:(image\/(?:jpeg|png|gif|webp));base64,(.+)$/;

/**
 * 説明文生成のシステムプロンプト
 */
export const DESCRIPTION_SYSTEM_PROMPT = [
  'あなたはフリマアプリ「メルカリ」の出品を支援するアシスタントです。',
  '商品画像と商品情報をもとに、購入者が安心して購入できる日本語の商品説明文を作成してください。',
  '',
  '## 出力ルール',
  '- 商品説明文の本文だけを出力してください。前置き・後書き・タイトル・マークダウン記法は一切含めないでください。',
  '- 全体で300〜600文字程度、スマートフォンで読みやすいよう短い段落と箇条書きで構成してください。',
  '- 過度な装飾記号や絵文字は使わないでください。',
  '',
  '## 構成',
  '次の順序で記載してください。該当する情報がない項目は省略して構いません。',
  '1. 商品の概要（ブランド・商品名・特徴を1〜3行）',
  '2. サイズ・仕様',
  '3. 商品の状態',
  '4. 付属品の有無',
  '5. 発送について',
  '6. 注意事項（自宅保管品である旨、見落としの可能性など）',
  '',
  '## 事実の扱い',
  '- 画像や入力情報から読み取れないことを断定しないでください。実寸・型番・製造年などが不明な場合はその項目を省略してください。',
  '- 「確実に正規品です」のような真贋保証や、根拠のない誇大表現は書かないでください。',
  '- 既存の説明文が与えられている場合は、そこに書かれた事実（実寸・付属品・キズの箇所など）を尊重して活かしてください。',
].join('\n');

/**
 * 商品情報をプロンプト用のテキストに整形する。
 *
 * @param context 商品情報
 * @param imageCount 実際に添付した画像の枚数
 * @returns {string} プロンプトに埋め込むテキスト
 */
function buildContextText(context: DescriptionContext, imageCount: number): string {
  const lines: string[] = ['以下の商品の説明文を作成してください。', ''];

  const fields: Array<[string, string | undefined]> = [
    ['商品名', context.name],
    ['カテゴリ', context.category],
    ['商品の状態', context.condition],
    ['配送方法', context.shippingMethod],
  ];

  fields.forEach(([label, value]) => {
    if (value && value.trim() !== '') {
      lines.push(`- ${label}: ${value.trim()}`);
    }
  });

  context.attributes.forEach(({ label, value }) => {
    lines.push(`- ${label}: ${value}`);
  });

  if (context.currentDescription && context.currentDescription.trim() !== '') {
    lines.push('', '## 現在の説明文（参考）', context.currentDescription.trim());
  }

  if (imageCount > 0) {
    lines.push('', `添付した${imageCount}枚の画像は、この商品の出品画像です。`);
  }

  return lines.join('\n');
}

/**
 * 画像のソース文字列を Claude API の image ブロックに変換する。
 *
 * - メルカリの編集ページの出品画像はデータURI（data:image/jpeg;base64,...）なので base64 ソースに変換します。
 * - https のURLはそのまま url ソースとして渡します。
 * - どちらでもない場合（blob: など、APIから参照できないもの）は null を返して除外します。
 *
 * @param source 画像のソース文字列
 * @returns {Anthropic.ImageBlockParam | null} 変換した image ブロック、変換できない場合はnull
 */
function toImageBlock(source: string): Anthropic.ImageBlockParam | null {
  const dataUri = DATA_URI_PATTERN.exec(source);
  if (dataUri) {
    const [, mediaType, data] = dataUri;
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
        data,
      },
    };
  }

  if (source.startsWith('https://')) {
    return { type: 'image', source: { type: 'url', url: source } };
  }

  return null;
}

/**
 * 説明文生成リクエストのユーザーメッセージを組み立てる。
 *
 * - 画像ブロックを先に並べ、その後にテキストブロックを置きます（画像の解釈精度が上がるため）。
 * - 画像は最大 {@link MAX_IMAGE_COUNT} 枚に制限します。
 *
 * @param context 商品情報
 * @returns {Anthropic.MessageParam[]} messages パラメータに渡す配列
 */
export function buildDescriptionMessages(context: DescriptionContext): Anthropic.MessageParam[] {
  const imageBlocks = context.imageSources
    .slice(0, MAX_IMAGE_COUNT)
    .map(toImageBlock)
    .filter((block): block is Anthropic.ImageBlockParam => block !== null);

  const content: Anthropic.ContentBlockParam[] = [
    ...imageBlocks,
    { type: 'text', text: buildContextText(context, imageBlocks.length) },
  ];

  return [{ role: 'user', content }];
}
