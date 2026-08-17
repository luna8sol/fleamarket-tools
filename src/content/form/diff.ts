import { SourceItem } from '../../common/messages';
import { FormSnapshot } from './form-state';

/**
 * 出品フォームの内容を、再出品元の商品の内容と突き合わせるモジュール。
 *
 * フリマアシストの流し込みが途中の状態で保存してしまうと、内容が欠けた
 * 下書きができる。保存の直前にここで突き合わせ、一致しない場合は保存しない。
 *
 * 実機で、商品ページのJSON-LDとフォームの値は商品名・説明とも完全一致する
 * ことを確認済み。そのため文字列は厳密に比較する。
 */

export interface Difference {
  field: string;
  expected: string;
  actual: string;
}

/** 改行表現の違いだけを吸収する */
function normalizeText(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

/** 「¥7,199」のような表記から数値を取り出す */
function parsePrice(value: string): number | null {
  const digits = value.replace(/[^\d]/g, '');
  if (digits === '') return null;
  const price = Number(digits);
  return Number.isFinite(price) ? price : null;
}

/**
 * フォームの内容と再出品元を比較し、一致しない項目を返す。
 * 再出品元で取得できなかった項目（null）は比較しない。
 */
export function diffAgainstSource(snapshot: FormSnapshot, expected: SourceItem): Difference[] {
  const differences: Difference[] = [];

  if (expected.name !== null) {
    const actual = snapshot.itemName.trim();
    const want = expected.name.trim();
    if (actual !== want) {
      differences.push({ field: '商品名', expected: want, actual: actual || '(空)' });
    }
  }

  if (expected.description !== null) {
    const actual = normalizeText(snapshot.description);
    const want = normalizeText(expected.description);
    if (actual !== want) {
      differences.push({
        field: '商品説明',
        expected: `${want.length}文字`,
        // 文字数が同じで中身だけ違う場合に、文字数の表示だけでは分からないため区別する
        actual:
          actual.length === want.length
            ? `${actual.length}文字(内容が不一致)`
            : `${actual.length}文字`,
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
    if (snapshot.imageCount !== expected.imageCount) {
      differences.push({
        field: '画像枚数',
        expected: `${expected.imageCount}枚`,
        actual: `${snapshot.imageCount}枚`,
      });
    }
  }

  return differences;
}

/** 失敗理由に載せるため、差分を1行にまとめる */
export function formatDifferences(differences: Difference[]): string {
  return differences.map((d) => `${d.field}: 元=${d.expected} / フォーム=${d.actual}`).join(' , ');
}
