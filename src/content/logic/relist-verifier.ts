import { SELL_FORM_FIELDS } from '../infra/constants';
import { debug } from '../infra/logger';
import { CompareFieldKey, CompareValues, FieldDiff, FixResult } from '../infra/types';
import { writeSellFormControl } from './sell-form';
import { fixByNavigation } from './sell-form-navigator';

/**
 * 元商品と出品フォームの比較、および差分の自動修正。
 *
 * DOM操作は sell-form.ts（入力欄への書き込み）と sell-form-navigator.ts
 * （カテゴリー等の選び直し）に委譲し、ここでは「何が食い違っているか」と
 * 「それを直せるか」の判断だけを担当します。
 */

/**
 * 元商品のスナップショットと出品フォームの現在値を比較する
 *
 * - 元商品側で取得できなかった項目は、比較の基準がないため対象外とします。
 * - 出品フォーム側で解決できなかった項目は、値を確認できない以上
 *   「問題なし」と判断してはいけないため、修正不可の差分として扱います。
 *
 * @param expected 元商品のスナップショット値
 * @param actual 出品フォームの現在値
 * @param unresolved 出品フォームで解決できなかったフィールド
 * @returns 検出された差分の配列
 */
export function compareValues(
  expected: CompareValues,
  actual: CompareValues,
  unresolved: CompareFieldKey[]
): FieldDiff[] {
  const diffs: FieldDiff[] = [];

  for (const spec of SELL_FORM_FIELDS) {
    const expectedValue = expected[spec.key];
    if (expectedValue === undefined) {
      debug(`${spec.label} は元商品側の値を取得できていないため比較しません`);
      continue;
    }

    if (unresolved.includes(spec.key)) {
      diffs.push({
        key: spec.key,
        label: spec.label,
        expected: expectedValue,
        actual: null,
        fixable: false,
      });
      continue;
    }

    const actualValue = actual[spec.key] ?? '';
    if (actualValue === expectedValue) continue;

    diffs.push({
      key: spec.key,
      label: spec.label,
      expected: expectedValue,
      actual: actualValue,
      fixable: spec.fix !== 'none',
    });
  }

  debug('元商品と出品フォームを比較しました', { diffCount: diffs.length, diffs });
  return diffs;
}

/**
 * 差分を出品フォームへ書き戻す
 *
 * 入力欄を持つ項目は直接書き込み、カテゴリー・商品の状態・配送の方法は
 * 選択ページへ遷移して選び直します。修正不可の項目（画像枚数・解決できなかった項目）は
 * 書き込みを試みず、そのまま未修正として返します。
 *
 * 遷移操作は1件ずつ直列に行います（同時に2つの選択ページへは行けないため）。
 *
 * @param diffs 検出された差分
 * @returns 修正できた差分と、できなかった差分
 */
export async function applyFixes(diffs: FieldDiff[]): Promise<FixResult> {
  const fixed: FieldDiff[] = [];
  const unfixed: FieldDiff[] = [];

  for (const diff of diffs) {
    if (!diff.fixable || diff.actual === null) {
      unfixed.push(diff);
      continue;
    }

    const spec = SELL_FORM_FIELDS.find((candidate) => candidate.key === diff.key);
    if (!spec) {
      unfixed.push(diff);
      continue;
    }

    const succeeded =
      spec.fix === 'control'
        ? writeSellFormControl(spec, diff.expected)
        : await fixByNavigation(spec, diff.expected);

    if (succeeded) {
      fixed.push(diff);
    } else {
      unfixed.push(diff);
    }
  }

  debug('差分の自動修正を実行しました', { fixed: fixed.length, unfixed: unfixed.length });
  return { fixed, unfixed };
}

/**
 * 差分を人が読める1行の文言に整形する
 * @param diff 差分
 * @returns 表示用の文言
 */
export function formatDiff(diff: FieldDiff): string {
  if (diff.actual === null) {
    return `${diff.label}: 入力欄を確認できませんでした（元商品: "${diff.expected}"）`;
  }
  return `${diff.label}: "${diff.actual}" → "${diff.expected}"`;
}
