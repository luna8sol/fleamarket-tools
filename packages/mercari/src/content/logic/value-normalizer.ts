import { CompareFieldKey } from '../infra/types';

/**
 * 比較用の値の正規化。
 *
 * 元商品のJSONと出品フォームの入力値では、改行コードや全角数字、
 * 通貨記号の有無などの表記ゆれが出ます。同じ規則で正規化してから
 * 比較することで、実質的に同一の値を差分として誤検出しないようにします。
 */

/**
 * 全角英数字を半角へ変換する
 *
 * 比較値の正規化と、選択ページで表示名を照合するときの両方で使います。
 * 片方だけ半角化すると「Ｔシャツ」と「Tシャツ」が一致せず、
 * 選び直しの選択肢を見つけられなくなるためです。
 *
 * @param value 変換対象の文字列
 * @returns 半角化した文字列
 */
export function toHalfWidth(value: string): string {
  return value.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0)
  );
}

/**
 * 数値文字列を正規化する（数字以外を除去し、先頭の0を落とす）
 * @param value 変換対象の文字列
 * @returns 正規化した数値文字列。数字が含まれない場合は空文字列
 */
function normalizeNumber(value: string): string {
  const digits = toHalfWidth(value).replace(/[^0-9]/g, '');
  if (digits === '') return '';
  const trimmed = digits.replace(/^0+/, '');
  return trimmed === '' ? '0' : trimmed;
}

/**
 * 複数行テキストを正規化する（改行コード統一・行末空白除去）
 * @param value 変換対象の文字列
 * @returns 正規化した文字列
 */
function normalizeMultiline(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t\u3000]+$/, ''))
    .join('\n')
    .trim();
}

/**
 * 単一行テキストを正規化する（連続空白を1つに畳む）
 * @param value 変換対象の文字列
 * @returns 正規化した文字列
 */
function normalizeSingleLine(value: string): string {
  return value.replace(/[\s\u3000]+/g, ' ').trim();
}

/**
 * フィールド種別に応じて値を正規化する
 * @param key 比較フィールドのキー
 * @param value 正規化前の値
 * @returns 正規化後の値
 */
export function normalizeFieldValue(key: CompareFieldKey, value: string): string {
  switch (key) {
    case 'price':
    case 'imageCount':
      return normalizeNumber(value);
    case 'description':
      return normalizeMultiline(value);
    case 'name':
      return normalizeSingleLine(value);
    default:
      // カテゴリ・状態・配送系のIDは文字列としてそのまま比較する
      return toHalfWidth(value).trim();
  }
}
