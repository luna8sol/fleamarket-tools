import { safeQuery, safeQueryAll } from '../../common/dom';
import { sleep } from '../../common/utils';
import { CONFIG, SELL_FORM_FIELDS, SELL_FORM_SELECTOR } from '../infra/constants';
import { debug, log, warn } from '../infra/logger';
import { CompareFieldKey, SellFormFieldSpec, SellFormReadResult } from '../infra/types';
import { normalizeFieldValue } from './value-normalizer';

/**
 * 出品フォーム（再出品タブ）のアダプタ。
 *
 * メルカリのDOMに依存する処理をこのモジュールへ閉じ込めています。
 * 画面構造が変わった場合、修正対象は constants.ts の SELL_FORM_FIELDS と
 * このファイルだけで済むようにしています。
 */

/** 値の読み書きが可能なフォーム要素 */
export type FormControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/**
 * 要素が読み書き可能なフォーム要素かどうかを判定
 * @param element 判定対象
 * @returns フォーム要素であれば true
 */
function isFormControl(element: Element | null): element is FormControl {
  if (element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) return true;
  // ファイル入力は値を設定できないため対象外
  return element instanceof HTMLInputElement && element.type !== 'file';
}

/**
 * 表示テキストを比較用に正規化する（空白と必須/任意バッジを除去）
 */
function normalizeLabelText(value: string | null | undefined): string {
  return (value ?? '').replace(/[\s　]+/g, '').replace(/[*＊]|必須|任意/g, '');
}

/**
 * ラベル文言から入力要素を辿る
 *
 * @param labelTexts 探索するラベル文言の候補
 * @returns 見つかった入力要素。見つからない場合は null
 */
function findControlByLabel(labelTexts: string[]): FormControl | null {
  if (labelTexts.length === 0) return null;

  const labelElements = safeQueryAll<HTMLElement>(SELL_FORM_SELECTOR.LABEL_CANDIDATES);

  for (const labelText of labelTexts) {
    const target = normalizeLabelText(labelText);

    for (const labelElement of labelElements) {
      if (normalizeLabelText(labelElement.textContent) !== target) continue;

      // label[for] から辿る
      if (labelElement instanceof HTMLLabelElement && labelElement.htmlFor) {
        const byFor = document.getElementById(labelElement.htmlFor);
        if (isFormControl(byFor)) return byFor;
      }

      // ラベル内部に入力要素がある場合
      const inner = safeQuery(SELL_FORM_SELECTOR.FORM_CONTROL, labelElement);
      if (isFormControl(inner)) return inner;

      // 祖先を数段さかのぼって同じブロック内の入力要素を探す
      let ancestor = labelElement.parentElement;
      for (let depth = 0; ancestor && depth < 4; depth++) {
        const control = safeQuery(SELL_FORM_SELECTOR.FORM_CONTROL, ancestor);
        if (isFormControl(control)) return control;
        ancestor = ancestor.parentElement;
      }
    }
  }

  return null;
}

/**
 * フィールド定義から入力要素を解決する
 *
 * @param spec フィールド定義
 * @returns 見つかった入力要素。見つからない場合は null
 */
export function resolveFieldControl(spec: SellFormFieldSpec): FormControl | null {
  if (spec.kind === 'count') return null;

  for (const selector of spec.selectors) {
    const element = safeQuery(selector);
    if (isFormControl(element)) return element;
  }

  return findControlByLabel(spec.labelTexts);
}

/**
 * 件数カウント型フィールド（画像枚数）の個数を数える
 *
 * @param spec フィールド定義
 * @returns 見つかった件数。どのセレクタも一致しない場合は null
 */
function countMatchingElements(spec: SellFormFieldSpec): number | null {
  for (const selector of spec.selectors) {
    const count = safeQueryAll(selector).length;
    if (count > 0) return count;
  }
  // 0件と「セレクタ不一致」を区別できないため、未解決として扱う
  return null;
}

/**
 * 入力要素から現在値を読み取る
 *
 * @param spec フィールド定義
 * @param control 入力要素
 * @returns 正規化済みの値
 */
function readControlValue(spec: SellFormFieldSpec, control: FormControl): string {
  return normalizeFieldValue(spec.key, control.value ?? '');
}

/**
 * 出品フォームの現在値をすべて読み取る
 * @returns 読み取り結果（値と未解決フィールド）
 */
export function readSellForm(): SellFormReadResult {
  const values: SellFormReadResult['values'] = {};
  const unresolved: CompareFieldKey[] = [];

  for (const spec of SELL_FORM_FIELDS) {
    if (spec.kind === 'count') {
      const count = countMatchingElements(spec);
      if (count === null) {
        unresolved.push(spec.key);
      } else {
        values[spec.key] = normalizeFieldValue(spec.key, String(count));
      }
      continue;
    }

    const control = resolveFieldControl(spec);
    if (!control) {
      unresolved.push(spec.key);
      continue;
    }

    values[spec.key] = readControlValue(spec, control);
  }

  debug('出品フォームを読み取りました', { values, unresolved });
  return { values, unresolved };
}

/**
 * React管理下の入力要素にも反映される形で値を設定する
 *
 * value プロパティへ直接代入すると React の内部状態と食い違うため、
 * プロトタイプ側の setter を使ったうえで input/change を発火させます。
 *
 * @param control 入力要素
 * @param value 設定する値
 */
function setControlValue(control: FormControl, value: string): void {
  const prototype = Object.getPrototypeOf(control) as object;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

  if (descriptor?.set) {
    descriptor.set.call(control, value);
  } else {
    control.value = value;
  }

  control.dispatchEvent(new Event('input', { bubbles: true }));
  control.dispatchEvent(new Event('change', { bubbles: true }));
  control.dispatchEvent(new Event('blur', { bubbles: true }));
}

/**
 * select要素に指定値の選択肢が存在するかを確認する
 * @param control select要素
 * @param value 設定したい値
 * @returns 選択肢が存在すれば true
 */
function hasOption(control: HTMLSelectElement, value: string): boolean {
  return Array.from(control.options).some((option) => option.value === value);
}

/**
 * フィールドに値を書き込む
 *
 * @param spec フィールド定義
 * @param value 設定する値
 * @returns 書き込みに成功したか
 */
export function writeSellFormField(spec: SellFormFieldSpec, value: string): boolean {
  if (!spec.fixable) {
    warn(`${spec.label} は自動修正に対応していません`);
    return false;
  }

  const control = resolveFieldControl(spec);
  if (!control) {
    warn(`${spec.label} の入力欄が見つかりません`);
    return false;
  }

  if (control instanceof HTMLSelectElement && !hasOption(control, value)) {
    warn(`${spec.label} に値 "${value}" の選択肢がありません`);
    return false;
  }

  setControlValue(control, value);

  const applied = readControlValue(spec, control);
  const expected = normalizeFieldValue(spec.key, value);
  if (applied !== expected) {
    warn(`${spec.label} の値が反映されませんでした`, { expected, applied });
    return false;
  }

  log(`${spec.label} を修正しました: "${applied}"`);
  return true;
}

/**
 * 出品（保存）ボタンを探す
 * @returns 見つかったボタン。見つからない場合は null
 */
export function findSubmitButton(): HTMLButtonElement | null {
  for (const selector of SELL_FORM_SELECTOR.SUBMIT_BUTTON) {
    const button = safeQuery<HTMLButtonElement>(selector);
    if (button instanceof HTMLButtonElement) return button;
  }

  // セレクタで見つからない場合はボタン文言から探す
  const buttons = safeQueryAll<HTMLButtonElement>('button');
  return (
    buttons.find((button) =>
      SELL_FORM_SELECTOR.SUBMIT_BUTTON_TEXTS.some(
        (text) => normalizeLabelText(button.textContent) === normalizeLabelText(text)
      )
    ) ?? null
  );
}

/**
 * 出品フォームの初期表示（コピー内容の反映）を待つ
 *
 * 商品名が解決でき、かつ値が入っている状態をフォーム準備完了とみなします。
 *
 * @returns 準備完了になれば true、タイムアウトすれば false
 */
export async function waitForSellFormReady(): Promise<boolean> {
  const nameSpec = SELL_FORM_FIELDS.find((spec) => spec.key === 'name');
  if (!nameSpec) return false;

  for (let attempt = 0; attempt < CONFIG.SELL_FORM_MAX_RETRY_COUNT; attempt++) {
    const control = resolveFieldControl(nameSpec);
    if (control && control.value.trim() !== '') {
      debug('出品フォームの準備が完了しました', { attempt });
      return true;
    }
    await sleep(CONFIG.SELL_FORM_RETRY_INTERVAL_MS / 1000);
  }

  warn('出品フォームの準備完了を待機中にタイムアウトしました');
  return false;
}

/**
 * 出品フォームの解決状況をログへ出力する（セレクタ調整用の診断）
 */
export function dumpSellFormStructure(): void {
  const report = SELL_FORM_FIELDS.map((spec) => {
    if (spec.kind === 'count') {
      const count = countMatchingElements(spec);
      return { field: spec.label, key: spec.key, resolved: count !== null, value: count };
    }

    const control = resolveFieldControl(spec);
    return {
      field: spec.label,
      key: spec.key,
      resolved: !!control,
      tagName: control?.tagName ?? null,
      id: control?.id ?? null,
      name: control?.getAttribute('name') ?? null,
      value: control ? readControlValue(spec, control) : null,
    };
  });

  log('出品フォームの解決状況', report);
  log('出品ボタンの解決状況', { found: !!findSubmitButton() });
}
