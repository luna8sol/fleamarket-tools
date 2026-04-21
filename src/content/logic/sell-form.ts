import { safeQuery, safeQueryAll, setReactInputValue } from '../../common/dom';
import { sleep, waitFor } from '../../common/utils';
import {
  ATTRIBUTE,
  CATEGORY_PATH_SEPARATOR,
  CONFIG,
  SELL_FORM_FIELDS,
  SELL_FORM_SELECTOR,
} from '../infra/constants';
import { debug, log, warn } from '../infra/logger';
import { CompareFieldKey, SellFormFieldSpec, SellFormReadResult } from '../infra/types';
import { normalizeFieldValue, toHalfWidth } from './value-normalizer';

/**
 * 出品フォーム（`/sell/create` / `/sell/edit/{itemId}`）のアダプタ。
 *
 * メルカリのDOMに依存する読み書きをこのモジュールへ閉じ込めています。
 * 読み取りは Document を引数に取るため、現在のページだけでなく
 * 元商品を読み込んだ隠しiframeの Document に対しても同じ処理を使えます。
 *
 * **ラベル文言から入力欄を辿るフォールバックは持ちません。** 実地検証で
 * 「配送の方法」の見出しから近傍の `select[name="shippingPayer"]` を掴んで
 * しまうことが確認されており、別項目を上書きする事故につながるためです。
 * セレクタが全て外れた項目は未解決として返し、呼び出し側が中断します。
 */

/** 値の読み書きが可能なフォーム要素 */
export type FormControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/**
 * 要素が読み書き可能なフォーム要素かどうかを判定
 *
 * **`instanceof` で判定してはいけません。** スナップショット用の iframe の中の要素は
 * 別レルム（別 window）に属し、`HTMLInputElement` などのコンストラクタが親ページと
 * 別物になるため、`instanceof` は必ず false になります（実機で確認済み）。
 * 判定は tagName で行います。
 *
 * @param element 判定対象
 * @returns フォーム要素であれば true
 */
function isFormControl(element: Element | null): element is FormControl {
  if (!element) return false;

  switch (element.tagName) {
    case 'SELECT':
    case 'TEXTAREA':
      return true;
    case 'INPUT':
      // ファイル入力は値を設定できないため対象外
      return (element as HTMLInputElement).type !== 'file';
    default:
      return false;
  }
}

/**
 * 要素が select かどうかを判定（レルムに依存しない）
 * @param control 判定対象
 * @returns select であれば true
 */
function isSelect(control: FormControl): control is HTMLSelectElement {
  return control.tagName === 'SELECT';
}

/**
 * 要素のテキストを行単位に分解する
 * @param element 対象要素
 * @returns 空行を除いた行の配列
 */
function toLines(element: Element | null): string[] {
  // iframe 内の要素は別レルムのため instanceof HTMLElement では判定できない
  const text = (element as HTMLElement | null)?.innerText;
  if (typeof text !== 'string') return [];

  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

/**
 * フィールド定義から入力要素を解決する
 *
 * @param spec フィールド定義
 * @param root 探索対象の Document（省略時は現在のページ）
 * @returns 見つかった入力要素。見つからない場合は null
 */
function resolveFieldControl(
  spec: SellFormFieldSpec,
  root: Document = document
): FormControl | null {
  if (spec.read !== 'control') return null;

  for (const selector of spec.selectors) {
    const element = safeQuery(selector, root);
    if (isFormControl(element)) return element;
  }

  return null;
}

/**
 * 表示テキスト型フィールド（カテゴリー・商品の状態・配送の方法）の値を読み取る
 *
 * @param spec フィールド定義
 * @param root 探索対象の Document
 * @returns 読み取った値。要素が見つからない・空の場合は null
 */
function readTextField(spec: SellFormFieldSpec, root: Document): string | null {
  for (const selector of spec.selectors) {
    const element = safeQuery(selector, root);
    const lines = toLines(element);
    if (lines.length === 0) continue;

    switch (spec.textLine) {
      case 'join':
        return lines.join(CATEGORY_PATH_SEPARATOR);
      case 'last':
        return lines[lines.length - 1];
      default:
        return lines[0];
    }
  }

  return null;
}

/**
 * 選択肢の表示テキストを照合用に正規化する
 * @param value 比較する文字列
 * @returns 正規化後の文字列
 */
function normalizeOptionText(value: string | null | undefined): string {
  return toHalfWidth(value ?? '')
    .replace(/[\s　]+/g, ' ')
    .trim();
}

/**
 * カテゴリー固有の「商品の特徴」の欄をすべて取得する
 *
 * @param spec フィールド定義
 * @param root 探索対象の Document
 * @returns 各欄の要素の配列
 */
function findAttributeContainers(spec: SellFormFieldSpec, root: Document): HTMLElement[] {
  for (const selector of spec.selectors) {
    const containers = safeQueryAll<HTMLElement>(selector, root);
    if (containers.length > 0) return containers;
  }
  return [];
}

/**
 * 「商品の特徴」の1欄からラベルと選択中の表示テキストを取り出す
 *
 * label 要素は中に select を含むため innerText に選択肢が全部入ります。
 * ラベル名は**1行目**だけを使います。
 *
 * @param container 1欄分の要素
 * @returns ラベルと選択値。select が無い場合は null
 */
function readAttribute(container: HTMLElement): { label: string; value: string } | null {
  const select = safeQuery<HTMLSelectElement>('select', container);
  if (!select) return null;

  const label = toLines(safeQuery('label', container))[0] ?? '';
  if (label === '') return null;

  const selected = normalizeOptionText(select.selectedOptions[0]?.textContent);
  const value = selected === ATTRIBUTE.UNSELECTED_LABEL ? '' : selected;

  return { label: normalizeOptionText(label), value };
}

/**
 * 「商品の特徴」をまとめて1つの比較用文字列にする
 *
 * 未選択の欄は含めません。欄の並び順の違いを差分と誤認しないよう、
 * ラベルで並べ替えてから連結します。
 *
 * @param spec フィールド定義
 * @param root 探索対象の Document
 * @returns `ラベル=値｜ラベル=値` 形式の文字列。欄が1つも無い場合は null
 */
function readAttributes(spec: SellFormFieldSpec, root: Document): string | null {
  const containers = findAttributeContainers(spec, root);
  if (containers.length === 0) return null;

  return containers
    .map(readAttribute)
    .filter((entry): entry is { label: string; value: string } => entry !== null)
    .filter((entry) => entry.value !== '')
    .map((entry) => `${entry.label}${ATTRIBUTE.KEY_VALUE_SEPARATOR}${entry.value}`)
    .sort()
    .join(ATTRIBUTE.PAIR_SEPARATOR);
}

/**
 * 件数カウント型フィールド（画像枚数）の個数を数える
 *
 * @param spec フィールド定義
 * @param root 探索対象の Document
 * @returns 見つかった件数。どのセレクタも一致しない場合は null
 */
function countMatchingElements(spec: SellFormFieldSpec, root: Document): number | null {
  for (const selector of spec.selectors) {
    const count = safeQueryAll(selector, root).length;
    if (count > 0) return count;
  }
  // 0件と「セレクタ不一致」を区別できないため、未解決として扱う
  return null;
}

/**
 * 出品フォームの現在値をすべて読み取る
 *
 * @param root 読み取り対象の Document（省略時は現在のページ）
 * @returns 読み取り結果（値と未解決フィールド）
 */
export function readSellForm(root: Document = document): SellFormReadResult {
  const values: SellFormReadResult['values'] = {};
  const unresolved: CompareFieldKey[] = [];

  for (const spec of SELL_FORM_FIELDS) {
    const raw = readFieldRaw(spec, root);

    if (raw === null) {
      unresolved.push(spec.key);
      continue;
    }

    values[spec.key] = normalizeFieldValue(spec.key, raw);
  }

  debug('出品フォームを読み取りました', { values, unresolved });
  return { values, unresolved };
}

/**
 * 1フィールド分の生値を読み取る
 *
 * @param spec フィールド定義
 * @param root 読み取り対象の Document
 * @returns 正規化前の値。解決できない場合は null
 */
function readFieldRaw(spec: SellFormFieldSpec, root: Document): string | null {
  switch (spec.read) {
    case 'count': {
      const count = countMatchingElements(spec, root);
      return count === null ? null : String(count);
    }
    case 'text':
      return readTextField(spec, root);
    case 'attributes':
      return readAttributes(spec, root);
    default: {
      const control = resolveFieldControl(spec, root);
      return control ? (control.value ?? '') : null;
    }
  }
}

/**
 * 1フィールド分の正規化済みの値を読み取る
 *
 * @param key 読み取るフィールド
 * @param root 読み取り対象の Document（省略時は現在のページ）
 * @returns 正規化済みの値。解決できない場合は null
 */
export function readSellFormField(key: CompareFieldKey, root: Document = document): string | null {
  const spec = SELL_FORM_FIELDS.find((candidate) => candidate.key === key);
  if (!spec) return null;

  const raw = readFieldRaw(spec, root);
  return raw === null ? null : normalizeFieldValue(key, raw);
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
 * React管理下の入力要素にも反映される形で値を設定する
 *
 * value プロパティへ直接代入すると React の内部状態と食い違うため、
 * プロトタイプ側の setter を使ったうえで input/change を発火させます。
 *
 * @param control 入力要素
 * @param value 設定する値
 */
function setControlValue(control: FormControl, value: string): void {
  if (isSelect(control)) {
    const prototype = Object.getPrototypeOf(control) as object;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

    if (setter) {
      setter.call(control, value);
    } else {
      control.value = value;
    }

    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }

  setReactInputValue(control, value);
  control.dispatchEvent(new Event('blur', { bubbles: true }));
}

/**
 * 入力欄へ直接書き込めるフィールドに値を設定する
 *
 * 遷移操作が必要なカテゴリー・商品の状態・配送の方法は
 * {@link ./sell-form-navigator} 側が担当します。
 *
 * @param spec フィールド定義
 * @param value 設定する値
 * @returns 書き込みに成功したか
 */
export function writeSellFormControl(spec: SellFormFieldSpec, value: string): boolean {
  if (spec.fix !== 'control') {
    warn(`${spec.label} は入力欄への直接書き込みに対応していません`);
    return false;
  }

  const control = resolveFieldControl(spec);
  if (!control) {
    warn(`${spec.label} の入力欄が見つかりません`);
    return false;
  }

  if (isSelect(control) && !hasOption(control, value)) {
    warn(`${spec.label} に値 "${value}" の選択肢がありません`);
    return false;
  }

  setControlValue(control, value);

  const applied = normalizeFieldValue(spec.key, control.value ?? '');
  const expected = normalizeFieldValue(spec.key, value);
  if (applied !== expected) {
    warn(`${spec.label} の値が反映されませんでした`, { expected, applied });
    return false;
  }

  log(`${spec.label} を修正しました: "${applied}"`);
  return true;
}

/**
 * 「商品の特徴」を元商品の内容へ揃える
 *
 * 各欄の select を、期待する選択肢の**表示テキスト**で選び直します。
 * 期待値に含まれない欄は「選択してください」へ戻し、フォーム全体が
 * 元商品と同じ状態になるようにします（余分な値が残ると差分が消えないため）。
 *
 * **カテゴリーを直した直後は欄が作り直されます。** 遷移から戻ってすぐ書こうとすると
 * まだ描画されておらず「入力欄が見つかりません」になるため、出そろうのを待ってから書きます。
 *
 * @param spec フィールド定義
 * @param expected `ラベル=値｜ラベル=値` 形式の期待値
 * @returns すべて設定できたか
 */
export async function writeSellFormAttributes(
  spec: SellFormFieldSpec,
  expected: string
): Promise<boolean> {
  await waitForSellFormAttributes();

  const containers = findAttributeContainers(spec, document);
  if (containers.length === 0) {
    warn(`${spec.label} の入力欄が見つかりません`);
    return false;
  }

  const wanted = new Map<string, string>();
  for (const pair of expected.split(ATTRIBUTE.PAIR_SEPARATOR)) {
    if (pair === '') continue;
    const index = pair.indexOf(ATTRIBUTE.KEY_VALUE_SEPARATOR);
    if (index < 0) continue;
    wanted.set(pair.slice(0, index), pair.slice(index + 1));
  }

  let allApplied = true;

  for (const container of containers) {
    const current = readAttribute(container);
    const select = safeQuery<HTMLSelectElement>('select', container);
    if (!current || !select) continue;

    const target = wanted.get(current.label) ?? '';
    if (current.value === target) continue;

    // 未選択へ戻す場合も含め、表示テキストで選択肢を探す
    const option = Array.from(select.options).find((candidate) =>
      target === ''
        ? normalizeOptionText(candidate.textContent) === ATTRIBUTE.UNSELECTED_LABEL
        : normalizeOptionText(candidate.textContent) === target
    );

    if (!option) {
      warn(`${spec.label}「${current.label}」に "${target}" の選択肢がありません`);
      allApplied = false;
      continue;
    }

    setControlValue(select, option.value);

    const applied = readAttribute(container);
    if (applied?.value !== target) {
      warn(`${spec.label}「${current.label}」の値が反映されませんでした`, {
        target,
        applied: applied?.value,
      });
      allApplied = false;
      continue;
    }

    log(
      `${spec.label}「${current.label}」を修正しました: "${target || ATTRIBUTE.UNSELECTED_LABEL}"`
    );
  }

  // 期待値にあるのにフォームへ欄が無いものは、カテゴリーが違う可能性がある
  const presentLabels = new Set(
    containers
      .map(readAttribute)
      .filter((entry): entry is { label: string; value: string } => entry !== null)
      .map((entry) => entry.label)
  );

  for (const label of wanted.keys()) {
    if (!presentLabels.has(label)) {
      warn(`${spec.label}「${label}」の欄がフォームにありません`);
      allApplied = false;
    }
  }

  return allApplied;
}

/**
 * 「商品の特徴」の欄が出そろうのを待つ
 *
 * 欄はカテゴリーが決まってから描画されるため、画像と同じく遅れて増えます。
 * 欄数が変わらなくなった時点で待機を終えます。
 *
 * @param root 対象の Document（省略時は現在のページ）
 * @param timeoutMs 待機の上限（ミリ秒）
 * @returns 最後に数えた欄数
 */
export async function waitForSellFormAttributes(
  root: Document = document,
  timeoutMs: number = CONFIG.SELL_FORM_IMAGE_TIMEOUT_MS
): Promise<number> {
  const spec = SELL_FORM_FIELDS.find((candidate) => candidate.key === 'attributes');
  if (!spec) return 0;

  const deadline = Date.now() + timeoutMs;
  let lastCount = -1;
  let unchangedSince = Date.now();

  for (;;) {
    const count = findAttributeContainers(spec, root).length;

    if (count !== lastCount) {
      lastCount = count;
      unchangedSince = Date.now();
    } else if (Date.now() - unchangedSince >= CONFIG.SELL_FORM_IMAGE_SETTLE_MS) {
      debug('商品の特徴の欄が出そろいました', { count });
      return count;
    }

    if (Date.now() >= deadline) {
      debug('商品の特徴の待機を打ち切りました', { count });
      return count;
    }

    await sleep(CONFIG.SELL_FORM_POLL_INTERVAL_MS / 1000);
  }
}

/**
 * 出品（確定）ボタンを探す
 *
 * 出品フォームは `[data-testid="list-item-button"]`（「出品する」）、
 * 編集フォームは `[data-testid="edit-button"]`（「変更する」）です。
 *
 * @param root 探索対象の Document（省略時は現在のページ）
 * @returns 見つかったボタン。見つからない場合は null
 */
export function findSubmitButton(root: Document = document): HTMLButtonElement | null {
  const selectors = [...SELL_FORM_SELECTOR.SUBMIT_BUTTON, ...SELL_FORM_SELECTOR.EDIT_BUTTON];

  for (const selector of selectors) {
    const button = safeQuery<HTMLButtonElement>(selector, root);
    // ここも instanceof ではなく tagName で判定する（iframe 対応）
    if (button && button.tagName === 'BUTTON') return button;
  }

  return null;
}

/**
 * 出品フォームの初期表示（コピー内容の反映）が済んでいるかを判定する
 *
 * 商品名の入力欄が解決でき、かつ値が入っている状態を準備完了とみなします。
 * 商品名が空のままなら、フォームが描画されていないかコピー内容の反映が
 * 終わっていないため、他の項目を読んではいけません。
 *
 * @param root 対象の Document
 * @returns 準備完了なら true
 */
export function isSellFormReady(root: Document): boolean {
  const nameSpec = SELL_FORM_FIELDS.find((spec) => spec.key === 'name');
  if (!nameSpec) return false;

  const control = resolveFieldControl(nameSpec, root);
  return control !== null && control.value.trim() !== '';
}

/**
 * 出品フォームの初期表示（コピー内容の反映）を待つ
 *
 * @param root 対象の Document（省略時は現在のページ）
 * @param timeoutMs 待機の上限（ミリ秒）
 * @returns 準備完了になれば true、タイムアウトすれば false
 */
export async function waitForSellFormReady(
  root: Document = document,
  timeoutMs: number = CONFIG.SELL_FORM_READY_TIMEOUT_MS
): Promise<boolean> {
  const startTime = performance.now();
  const ready = await waitFor(
    () => isSellFormReady(root),
    timeoutMs,
    CONFIG.SELL_FORM_POLL_INTERVAL_MS
  );
  const elapsedMs = Math.round(performance.now() - startTime);

  if (!ready) {
    const nameSpec = SELL_FORM_FIELDS.find((spec) => spec.key === 'name');
    // 入力欄が無い＝フォームがまだ描画されていない。
    // 入力欄はあるが空＝描画は済んでいてコピー内容だけが入っていない。
    // どちらかで原因が変わるため区別して残す。
    const nameInputFound = nameSpec !== undefined && resolveFieldControl(nameSpec, root) !== null;

    warn('出品フォームの準備完了を待機中にタイムアウトしました', {
      elapsedMs,
      nameInputFound,
      pathname: root.location.pathname,
    });
    return false;
  }

  debug('出品フォームの準備が完了しました', { elapsedMs });
  return true;
}

/**
 * 画像サムネイルが出そろうのを待つ
 *
 * **1枚現れた時点で読んではいけません。** 再出品フォームの画像は外部ツールが
 * 1枚ずつアップロードし直すため、枚数は時間をかけて増えていきます。
 * 途中で読むと「元商品5枚 / フォーム1枚」のような差分になり、画像枚数は
 * 自動修正できないため自動保存が中断します（実機で確認）。
 *
 * 期待枚数が分かっている場合はその枚数に達した時点で、分からない場合は
 * 枚数が増えなくなった時点で待機を終えます。いずれも上限で打ち切ります。
 *
 * 画像が1枚も無いフォームも正常にありうるため、時間切れでも失敗にはしません。
 *
 * @param root 対象の Document（省略時は現在のページ）
 * @param expectedCount 期待する枚数。不明な場合は null
 * @param timeoutMs 待機の上限（ミリ秒）
 * @returns 最後に数えた枚数。1枚も見つからなければ null
 */
export async function waitForSellFormImages(
  root: Document = document,
  expectedCount: number | null = null,
  timeoutMs: number = CONFIG.SELL_FORM_IMAGE_TIMEOUT_MS
): Promise<number | null> {
  const spec = SELL_FORM_FIELDS.find((candidate) => candidate.key === 'imageCount');
  if (!spec) return null;

  const deadline = Date.now() + timeoutMs;
  let lastCount: number | null = null;
  let unchangedSince = Date.now();

  for (;;) {
    const count = countMatchingElements(spec, root);

    // 期待枚数に達したなら、それ以上待つ必要はない
    if (expectedCount !== null && count !== null && count >= expectedCount) {
      debug('画像が出そろいました', { count, expectedCount });
      return count;
    }

    if (count !== lastCount) {
      lastCount = count;
      unchangedSince = Date.now();
    } else if (count !== null && Date.now() - unchangedSince >= CONFIG.SELL_FORM_IMAGE_SETTLE_MS) {
      debug('画像の枚数が安定しました', { count, expectedCount });
      return count;
    }

    if (Date.now() >= deadline) {
      debug('画像の待機を打ち切りました', { count, expectedCount });
      return count;
    }

    await sleep(CONFIG.SELL_FORM_POLL_INTERVAL_MS / 1000);
  }
}

/**
 * 出品フォームの解決状況をログへ出力する（セレクタ調整用の診断）
 *
 * @param root 対象の Document（省略時は現在のページ）
 */
export function dumpSellFormStructure(root: Document = document): void {
  const report = SELL_FORM_FIELDS.map((spec) => ({
    field: spec.label,
    key: spec.key,
    read: spec.read,
    resolved: readFieldRaw(spec, root) !== null,
    value: readSellFormField(spec.key, root),
  }));

  log('出品フォームの解決状況', report);
  log('出品ボタンの解決状況', { found: !!findSubmitButton(root) });
}
