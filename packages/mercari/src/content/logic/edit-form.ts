import { EDIT_SELECTOR } from '../infra/constants';
import { debug, debugMethodStart, debugMethodEnd, warn } from '../infra/logger';
import { safeQuery, safeQueryFirst, safeQueryAllFirst, setReactInputValue } from '../../common/dom';
import { DescriptionContext, ItemAttribute, MAX_IMAGE_COUNT } from '../../common/messaging';

/**
 * 出品・下書き編集フォームの読み書きを担当するモジュール。
 *
 * - 商品名・カテゴリ・状態・属性・既存説明文・画像の読み取りと、説明欄への書き戻しを行います。
 * - メルカリ側のDOM構造に依存するため、セレクタは {@link EDIT_SELECTOR} に集約しています。
 */

/**
 * 属性の選択欄で未選択を表す文言
 */
const UNSELECTED_LABEL = '選択してください';

/**
 * 要素のテキストを行単位に分解する。
 *
 * @param el 対象要素
 * @returns {string[]} 空行を除いた行の配列
 */
function toLines(el: Element | null): string[] {
  if (!(el instanceof HTMLElement)) return [];
  return el.innerText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

/**
 * 商品名を読み取る。
 *
 * @returns {string} 商品名
 */
function getName(): string {
  const el = safeQueryFirst(EDIT_SELECTOR.NAME);
  return el instanceof HTMLInputElement ? el.value.trim() : '';
}

/**
 * カテゴリを読み取る。
 *
 * - メルカリは階層を改行区切りで表示するため、「大分類 > 中分類 > 小分類」形式に整形します。
 *
 * @returns {string} カテゴリ文字列
 */
function getCategory(): string {
  return toLines(safeQueryFirst(EDIT_SELECTOR.CATEGORY)).join(' > ');
}

/**
 * 商品の状態を読み取る。
 *
 * - 状態名のp要素と、その説明文のp要素が並ぶため、先頭（状態名）だけを使います。
 *
 * @returns {string} 商品の状態
 */
function getCondition(): string {
  return safeQueryFirst(EDIT_SELECTOR.CONDITION)?.textContent?.trim() ?? '';
}

/**
 * 配送方法を読み取る。
 *
 * - 「配送の方法 / 変更する / らくらくメルカリ便」のように見出しを含むため、最終行を値として扱います。
 *
 * @returns {string} 配送方法
 */
function getShippingMethod(): string {
  const lines = toLines(safeQueryFirst(EDIT_SELECTOR.SHIPPING_METHOD));
  return lines.length > 0 ? lines[lines.length - 1] : '';
}

/**
 * カテゴリ固有の属性（ブランド・サイズ・シリーズなど）を読み取る。
 *
 * - 未選択（「選択してください」）の項目は除外します。
 *
 * @returns {ItemAttribute[]} 属性の配列
 */
function getAttributes(): ItemAttribute[] {
  return safeQueryAllFirst(EDIT_SELECTOR.ATTRIBUTE)
    .map((container): ItemAttribute => {
      const label = toLines(safeQuery('label', container))[0] ?? '';
      const select = safeQuery<HTMLSelectElement>('select', container);
      const value = select?.selectedOptions[0]?.textContent?.trim() ?? '';
      return { label, value };
    })
    .filter(({ label, value }) => label !== '' && value !== '' && value !== UNSELECTED_LABEL);
}

/**
 * 説明文の入力欄（textarea）を取得する。
 *
 * @returns {HTMLTextAreaElement | null} 説明欄、見つからない場合はnull
 */
export function getDescriptionTextarea(): HTMLTextAreaElement | null {
  const el = safeQueryFirst(EDIT_SELECTOR.DESCRIPTION);
  if (el instanceof HTMLTextAreaElement) {
    return el;
  }
  if (el) {
    warn('説明欄が見つかりましたがtextareaではありません', el.tagName);
  }
  return null;
}

/**
 * 出品画像のソース一覧を取得する。
 *
 * - メルカリの編集ページでは出品画像が data:image/jpeg;base64,... 形式で保持されています。
 * - Claude API から参照できない blob: などは除外します。
 *
 * @returns {string[]} 画像ソースの配列（最大 {@link MAX_IMAGE_COUNT} 件）
 */
function getImageSources(): string[] {
  const images = safeQueryAllFirst<HTMLImageElement>(EDIT_SELECTOR.IMAGES);

  const sources = images
    .map((img) => img.getAttribute('src') ?? '')
    .filter((src) => src.startsWith('data:image/') || src.startsWith('https://'))
    .filter((src, index, all) => all.indexOf(src) === index)
    .slice(0, MAX_IMAGE_COUNT);

  debug('出品画像を取得しました', { found: images.length, usable: sources.length });
  return sources;
}

/**
 * 編集フォームから商品情報を読み取る。
 *
 * @returns {DescriptionContext} 説明文生成に渡す商品情報
 * @example
 *   const context = readDescriptionContext();
 */
export function readDescriptionContext(): DescriptionContext {
  const startTime = performance.now();
  debugMethodStart('readDescriptionContext');

  const context: DescriptionContext = {
    name: getName(),
    category: getCategory(),
    condition: getCondition(),
    shippingMethod: getShippingMethod(),
    attributes: getAttributes(),
    currentDescription: getDescriptionTextarea()?.value ?? '',
    imageSources: getImageSources(),
  };

  const duration = Math.round(performance.now() - startTime);
  debugMethodEnd(
    'readDescriptionContext',
    {
      name: context.name,
      category: context.category,
      condition: context.condition,
      attributeCount: context.attributes.length,
      imageCount: context.imageSources.length,
    },
    duration
  );

  return context;
}

/**
 * 生成した説明文を説明欄に反映する。
 *
 * - 説明欄は React 制御下にあるため {@link setReactInputValue} を経由して値を設定します。
 *   これによりメルカリ側の文字数カウンタや保存対象の値も更新されます。
 *
 * @param description 反映する説明文
 * @returns {boolean} 反映に成功したかどうか
 * @example
 *   applyDescription('新しい説明文');
 */
export function applyDescription(description: string): boolean {
  const textarea = getDescriptionTextarea();
  if (!textarea) {
    warn('説明欄が見つからないため反映できませんでした');
    return false;
  }

  const applied = setReactInputValue(textarea, description);
  if (applied) {
    textarea.focus();
    debug('説明文を反映しました', { length: description.length });
  }
  return applied;
}
