import { SourceItem } from '../../common/messages';
import { FormSnapshot } from './form-state';

/**
 * 出品フォームの内容を、再出品元の商品の内容と突き合わせるモジュール。
 *
 * フリマアシストの流し込みが途中の状態で保存してしまうと、内容が欠けた
 * 下書きができる。保存の直前にここで突き合わせ、揃っていなければ保存しない。
 *
 * 検出したいのは**内容の欠落**なので、比較には向きを持たせる。
 * フォーム側が元より多い・書式が違うぶんには問題にしない。
 * JSON-LD とフォームは別々のシリアライズ経路であり、同じ内容でも数文字
 * ずれることが実際にある（実測: 元779文字に対しフォーム782文字）。
 * 厳密一致を求めると、内容は揃っているのに永久に保存できなくなる。
 */

/** 正規化しきれないゆらぎを吸収する許容差（文字） */
const DESCRIPTION_TOLERANCE = 5;

export interface Difference {
  field: string;
  expected: string;
  actual: string;
}

/** 改行コードと行末の空白のゆらぎを吸収する */
function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

/** 書式のゆらぎを完全に落として中身だけを比べる */
function normalizeCompact(text: string): string {
  return normalizeText(text).replace(/\s+/g, '');
}

/** 「¥7,199」のような表記から数値を取り出す */
function parsePrice(value: string): number | null {
  const digits = value.replace(/[^\d]/g, '');
  if (digits === '') return null;
  const price = Number(digits);
  return Number.isFinite(price) ? price : null;
}

/**
 * フォームの内容と再出品元を比較し、足りていない項目を返す。
 * 再出品元で取得できなかった項目（null）は比較しない。
 */
export function diffAgainstSource(snapshot: FormSnapshot, expected: SourceItem): Difference[] {
  const differences: Difference[] = [];

  if (expected.name !== null) {
    // 空白の入り方だけの違いで止めないよう、書式を落として比べる
    if (normalizeCompact(snapshot.itemName) !== normalizeCompact(expected.name)) {
      differences.push({
        field: '商品名',
        expected: expected.name.trim(),
        actual: snapshot.itemName.trim() || '(空)',
      });
    }
  }

  if (expected.description !== null) {
    const actual = normalizeText(snapshot.description);
    const want = normalizeText(expected.description);
    // 欠落だけを見る。フォーム側が長いぶんには問題にしない
    if (actual.length + DESCRIPTION_TOLERANCE < want.length) {
      differences.push({
        field: '商品説明',
        expected: `${want.length}文字`,
        actual: `${actual.length}文字(不足)`,
      });
    }
  }

  if (expected.price !== null) {
    const actual = parsePrice(snapshot.sellPrice);
    if (actual !== expected.price) {
      differences.push({
        field: '価格',
        expected: String(expected.price),
        actual: actual === null ? '(空)' : String(actual),
      });
    }
  }

  if (expected.imageCount !== null) {
    // アップロード途中の不足だけを見る。多いぶんには問題にしない
    if (snapshot.imageCount < expected.imageCount) {
      differences.push({
        field: '画像枚数',
        expected: `${expected.imageCount}枚`,
        actual: `${snapshot.imageCount}枚(不足)`,
      });
    }
  }

  return differences;
}

/** 失敗理由に載せるため、差分を1行にまとめる */
export function formatDifferences(differences: Difference[]): string {
  return differences.map((d) => `${d.field}: 元=${d.expected} / フォーム=${d.actual}`).join(' , ');
}
