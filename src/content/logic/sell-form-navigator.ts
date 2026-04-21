import { safeQueryAll, safeQueryFirst } from '../../common/dom';
import { sleep, waitFor } from '../../common/utils';
import {
  CATEGORY_PATH_SEPARATOR,
  CONFIG,
  SELL_FORM_FIELDS,
  SELL_FORM_PATH,
  SELL_FORM_SELECTOR,
} from '../infra/constants';
import { debug, log, warn } from '../infra/logger';
import { CompareFieldKey, SellFormFieldSpec } from '../infra/types';
import { toHalfWidth } from './value-normalizer';

/**
 * 「変更する」リンクで別ページへ遷移して選び直す項目（カテゴリー・商品の状態・配送の方法）の操作。
 *
 * この3項目は select ではなく `<a>` での遷移方式です。いずれも SPA 内遷移で
 * document は維持されるため、フォームの入力値・画像はそのまま保持されます
 * （2026-09-17 の実地調査で往復確認済み）。
 *
 * 3項目とも**表示名で辿れる**ため、ID のマッピングテーブルは持ちません。
 * 遷移完了・復帰完了はポーリングで待ち、待てない場合は false を返して
 * 呼び出し側に中断させます。**戻れないまま保存へ進むことはありません。**
 */

/** 選択ページのパス一覧（フォームへ戻れたかの判定に使う） */
const SELECTION_PATHS: readonly string[] = [
  SELL_FORM_PATH.CATEGORIES,
  SELL_FORM_PATH.CONDITIONS,
  SELL_FORM_PATH.SHIPPING_METHODS,
];

/**
 * 表示テキストを照合用に正規化する（空白・必須/任意バッジを除去し、全角英数字を半角化）
 *
 * 期待値は {@link ./value-normalizer} で半角化済みのため、選択肢側も同じ変換を通します。
 *
 * @param value 比較する文字列
 * @returns 正規化後の文字列
 */
function normalizeText(value: string | null | undefined): string {
  return toHalfWidth(value ?? '')
    .replace(/[\s　]+/g, '')
    .replace(/[*＊]|必須|任意/g, '');
}

/**
 * 要素の表示テキストの1行目を返す
 * @param element 対象要素
 * @returns 1行目のテキスト。取れない場合は空文字列
 */
function firstLine(element: Element): string {
  const text = (element as HTMLElement).innerText;
  if (typeof text !== 'string') return '';

  return (
    text
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line !== '') ?? ''
  );
}

/**
 * 現在が選択ページのいずれかにいるかを判定
 * @returns 選択ページにいれば true
 */
function isOnSelectionPage(): boolean {
  return SELECTION_PATHS.some((path) => window.location.pathname.startsWith(path));
}

/**
 * 指定フィールドのフィールド定義を取得する
 * @param key 比較フィールドのキー
 * @returns フィールド定義。未定義の場合は null
 */
function findSpec(key: CompareFieldKey): SellFormFieldSpec | null {
  return SELL_FORM_FIELDS.find((spec) => spec.key === key) ?? null;
}

/**
 * 「変更する」リンクを押して選択ページへ遷移する
 *
 * @param linkSelectors リンクの候補セレクタ
 * @param expectedPath 遷移先のパス
 * @returns 遷移できたか
 */
async function openSelectionPage(
  linkSelectors: readonly string[],
  expectedPath: string
): Promise<boolean> {
  const link = safeQueryFirst<HTMLElement>(linkSelectors);
  if (!link) {
    warn(`選択ページ ${expectedPath} への「変更する」リンクが見つかりません`);
    return false;
  }

  link.click();

  const arrived = await waitFor(
    () => window.location.pathname.startsWith(expectedPath),
    CONFIG.SELL_FORM_NAV_TIMEOUT_MS,
    CONFIG.SELL_FORM_POLL_INTERVAL_MS
  );

  if (!arrived) {
    warn(`選択ページ ${expectedPath} へ遷移できませんでした`);
    return false;
  }

  debug(`選択ページへ遷移しました: ${expectedPath}`);
  return true;
}

/**
 * 選択を終えて出品フォームへ戻るのを待つ
 *
 * 選択ページから抜けていること、かつ対象項目の表示要素が再び現れていることを
 * 復帰の条件とします。戻れない場合は false を返し、呼び出し側が中断します。
 *
 * @param spec 対象フィールドの定義
 * @returns 戻れたか
 */
async function waitForFormReturn(spec: SellFormFieldSpec): Promise<boolean> {
  const returned = await waitFor(
    () => !isOnSelectionPage() && safeQueryFirst(spec.selectors) !== null,
    CONFIG.SELL_FORM_NAV_TIMEOUT_MS,
    CONFIG.SELL_FORM_POLL_INTERVAL_MS
  );

  if (!returned) {
    warn(`${spec.label} の選択後、出品フォームへ戻れませんでした`, {
      pathname: window.location.pathname,
    });
    return false;
  }

  return true;
}

/**
 * 表示名が一致する選択肢を探す
 *
 * 直前にクリックした要素は、再描画前の同じ要素を二重にクリックしないよう除外します。
 *
 * @param selector 選択肢のセレクタ
 * @param label 探す表示名
 * @param exclude 除外する要素
 * @returns 見つかった選択肢。無ければ null
 */
function findOptionByLabel(
  selector: string,
  label: string,
  exclude: Element | null
): HTMLElement | null {
  const target = normalizeText(label);

  return (
    safeQueryAll<HTMLElement>(selector).find(
      (option) => option !== exclude && normalizeText(firstLine(option)) === target
    ) ?? null
  );
}

/**
 * カテゴリーを選び直す
 *
 * 階層の深さは可変のため、期待値を区切り文字で分解し、各階層で表示名が一致する
 * リンクを順にクリックします。最深階層をクリックすると自動でフォームへ戻ります。
 *
 * @param expected 期待するカテゴリー（`大分類 > 中分類 > 小分類` 形式）
 * @returns 選び直せたか
 */
async function fixCategory(expected: string): Promise<boolean> {
  const spec = findSpec('category');
  if (!spec) return false;

  const levels = expected
    .split(CATEGORY_PATH_SEPARATOR)
    .map((level) => level.trim())
    .filter((level) => level !== '');

  if (levels.length === 0) {
    warn('カテゴリーの期待値が空のため修正できません');
    return false;
  }

  if (!(await openSelectionPage(SELL_FORM_SELECTOR.CATEGORY_LINK, SELL_FORM_PATH.CATEGORIES))) {
    return false;
  }

  let previous: Element | null = null;

  for (const level of levels) {
    const option = await waitFor(
      () => findOptionByLabel(SELL_FORM_SELECTOR.CATEGORY_OPTION, level, previous),
      CONFIG.SELL_FORM_NAV_TIMEOUT_MS,
      CONFIG.SELL_FORM_POLL_INTERVAL_MS
    );

    if (!option) {
      warn(`カテゴリー階層 "${level}" の選択肢が見つかりませんでした`, { expected });
      return false;
    }

    option.click();
    previous = option;

    // SPA の再描画を1ティック待ってから次の階層を探す
    await sleep(CONFIG.SELL_FORM_POLL_INTERVAL_MS / 1000);
  }

  return waitForFormReturn(spec);
}

/**
 * 商品の状態を選び直す
 *
 * 選択ページで表示名が一致する行をクリックすると、自動でフォームへ戻ります。
 *
 * @param expected 期待する商品の状態（例: 目立った傷や汚れなし）
 * @returns 選び直せたか
 */
async function fixCondition(expected: string): Promise<boolean> {
  const spec = findSpec('condition');
  if (!spec) return false;

  if (!(await openSelectionPage(SELL_FORM_SELECTOR.CONDITION_LINK, SELL_FORM_PATH.CONDITIONS))) {
    return false;
  }

  const option = await waitFor(
    () => findOptionByLabel(SELL_FORM_SELECTOR.CONDITION_OPTION, expected, null),
    CONFIG.SELL_FORM_NAV_TIMEOUT_MS,
    CONFIG.SELL_FORM_POLL_INTERVAL_MS
  );

  if (!option) {
    warn(`商品の状態 "${expected}" の選択肢が見つかりませんでした`);
    return false;
  }

  option.click();

  return waitForFormReturn(spec);
}

/**
 * 配送の方法のラジオボタンを表示名から探す
 *
 * ラジオ自体はテキストを持たないため、数段さかのぼった行の表示テキストで判定します。
 *
 * @param expected 期待する配送の方法
 * @returns 見つかったラジオボタン。無ければ null
 */
function findShippingMethodRadio(expected: string): HTMLInputElement | null {
  const target = normalizeText(expected);

  return (
    safeQueryAll<HTMLInputElement>(SELL_FORM_SELECTOR.SHIPPING_METHOD_RADIO).find((radio) => {
      let container: HTMLElement | null = radio.closest('label') ?? radio.parentElement;

      for (let depth = 0; container && depth < 4; depth++) {
        if (normalizeText(container.innerText).includes(target)) return true;
        container = container.parentElement;
      }

      return false;
    }) ?? null
  );
}

/**
 * 配送の方法を選び直す
 *
 * 他の2項目と違い、ラジオを選んだあと「更新する」ボタンを押して初めて
 * フォームへ戻ります。ラジオに出ていない配送方法
 * （`[data-testid="shipping-service-trigger-button"]` の先にある種別）は
 * 自動修正の対象外とし、false を返して中断させます。
 *
 * @param expected 期待する配送の方法（例: らくらくメルカリ便）
 * @returns 選び直せたか
 */
async function fixShippingMethod(expected: string): Promise<boolean> {
  const spec = findSpec('shippingMethod');
  if (!spec) return false;

  if (
    !(await openSelectionPage(
      SELL_FORM_SELECTOR.SHIPPING_METHOD_LINK,
      SELL_FORM_PATH.SHIPPING_METHODS
    ))
  ) {
    return false;
  }

  const radio = await waitFor(
    () => findShippingMethodRadio(expected),
    CONFIG.SELL_FORM_NAV_TIMEOUT_MS,
    CONFIG.SELL_FORM_POLL_INTERVAL_MS
  );

  if (!radio) {
    warn(`配送の方法 "${expected}" のラジオボタンが見つかりませんでした`);
    return false;
  }

  radio.click();

  const confirmButton = await waitFor(
    () =>
      safeQueryAll<HTMLButtonElement>('button').find(
        (button) =>
          normalizeText(button.textContent) ===
          normalizeText(SELL_FORM_SELECTOR.SHIPPING_METHOD_CONFIRM_TEXT)
      ) ?? null,
    CONFIG.SELL_FORM_NAV_TIMEOUT_MS,
    CONFIG.SELL_FORM_POLL_INTERVAL_MS
  );

  if (!confirmButton) {
    warn(
      `配送の方法の「${SELL_FORM_SELECTOR.SHIPPING_METHOD_CONFIRM_TEXT}」ボタンが見つかりませんでした`
    );
    return false;
  }

  confirmButton.click();

  return waitForFormReturn(spec);
}

/**
 * 遷移操作でフィールドを選び直す
 *
 * @param spec 対象フィールドの定義
 * @param expected 期待する表示名
 * @returns 選び直せたか
 */
export async function fixByNavigation(spec: SellFormFieldSpec, expected: string): Promise<boolean> {
  if (isOnSelectionPage()) {
    warn('選択ページに留まっているため、遷移操作を開始できません', {
      pathname: window.location.pathname,
    });
    return false;
  }

  let fixed = false;

  switch (spec.fix) {
    case 'category':
      fixed = await fixCategory(expected);
      break;
    case 'condition':
      fixed = await fixCondition(expected);
      break;
    case 'shippingMethod':
      fixed = await fixShippingMethod(expected);
      break;
    default:
      warn(`${spec.label} は遷移操作での修正に対応していません`);
      return false;
  }

  if (fixed) {
    log(`${spec.label} を選び直しました: "${expected}"`);
  }

  return fixed;
}

/**
 * 出品フォームのページに戻っているかを確認する（保存前の最終確認用）
 *
 * @returns 選択ページに留まっていなければ true
 */
export function isBackOnSellForm(): boolean {
  return !isOnSelectionPage();
}
