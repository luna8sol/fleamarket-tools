/**
 * DOM操作のラップ関数と例外安全なユーティリティ
 *
 * - 例外安全性・null安全性を重視したDOM操作API群です。
 * - すべてのDOM操作はtry-catchでラップされ、失敗時もアプリが落ちません。
 * - どのレイヤーからもimportして利用可能です。
 * - 新たなDOM操作ラッパーはこのファイルに追加してください。
 */

import { warn } from '../content/infra/logger';

/**
 * セレクタで要素を安全に取得する。
 *
 * @template T 取得する要素型
 * @param selector CSSセレクタ
 * @param parent 親要素（省略時はdocument）
 * @returns {T | null} 見つかった要素、またはnull
 * @example
 *   const btn = safeQuery<HTMLButtonElement>('#myBtn');
 */
export function safeQuery<T extends Element = Element>(selector: string, parent: ParentNode = document): T | null {
  try {
    return parent.querySelector(selector) as T | null;
  } catch (e) {
    warn('safeQuery error:', e, selector, parent);
    return null;
  }
}

/**
 * セレクタで複数要素を安全に取得する。
 *
 * @template T 取得する要素型
 * @param selector CSSセレクタ
 * @param parent 親要素（省略時はdocument）
 * @returns {T[]} 見つかった要素の配列。例外時は空配列
 * @example
 *   const items = safeQueryAll<HTMLLIElement>('li');
 */
export function safeQueryAll<T extends Element = Element>(selector: string, parent: ParentNode = document): T[] {
  try {
    return Array.from(parent.querySelectorAll(selector)) as T[];
  } catch (e) {
    warn('safeQueryAll error:', e, selector, parent);
    return [];
  }
}

/**
 * 親要素の先頭に子要素を安全に挿入。失敗時はfalse。
 */
export function safePrepend(parent: Node | null, child: Node | null): boolean {
  if (!parent || !child) return false;
  try {
    parent.insertBefore(child, parent.firstChild);
    return true;
  } catch (e) {
    warn('safePrepend error:', e, parent, child);
    return false;
  }
}

/**
 * 要素の属性を安全に取得。失敗時は空文字列。
 */
export function safeGetAttr(el: Element | null, attr: string): string {
  if (!el) return '';
  try {
    return el.getAttribute(attr) || '';
  } catch (e) {
    warn('safeGetAttr error:', e, el, attr);
    return '';
  }
}

// 必要に応じて他のDOM操作ラッパーも追加可能

/**
 * 複数のセレクタ候補を優先順に試し、最初に見つかった要素を返す。
 *
 * - メルカリ側のDOM変更でセレクタが変わっても動くよう、フォールバックを持たせるために使います。
 *
 * @template T 取得する要素型
 * @param selectors CSSセレクタの配列（優先度順）
 * @param parent 親要素（省略時はdocument）
 * @returns {T | null} 最初に見つかった要素、またはnull
 * @example
 *   const textarea = safeQueryFirst<HTMLTextAreaElement>(EDIT_SELECTOR.DESCRIPTION);
 */
export function safeQueryFirst<T extends Element = Element>(
  selectors: readonly string[],
  parent: ParentNode = document
): T | null {
  for (const selector of selectors) {
    const el = safeQuery<T>(selector, parent);
    if (el) return el;
  }
  return null;
}

/**
 * 複数のセレクタ候補を優先順に試し、最初にヒットしたセレクタの全要素を返す。
 *
 * @template T 取得する要素型
 * @param selectors CSSセレクタの配列（優先度順）
 * @param parent 親要素（省略時はdocument）
 * @returns {T[]} 見つかった要素の配列。どれも見つからなければ空配列
 * @example
 *   const images = safeQueryAllFirst<HTMLImageElement>(EDIT_SELECTOR.IMAGES);
 */
export function safeQueryAllFirst<T extends Element = Element>(
  selectors: readonly string[],
  parent: ParentNode = document
): T[] {
  for (const selector of selectors) {
    const els = safeQueryAll<T>(selector, parent);
    if (els.length > 0) return els;
  }
  return [];
}

/**
 * React が制御する input / textarea に値を設定する。
 *
 * - React は value プロパティを自前のセッターで管理しているため、単に `el.value = x` としても
 *   React の state が更新されず、フォーム送信時に値が反映されません。
 *   ネイティブの value セッターを直接呼び出したうえで input イベントを発火させる必要があります。
 * - 現在のページの要素だけでなく、同一オリジンの隠し iframe 内の要素にも使えます。
 *
 * @param el 値を設定する input または textarea
 * @param value 設定する値
 * @returns {boolean} 設定成功時true、失敗時false
 * @example
 *   setReactInputValue(textarea, '新しい説明文');
 */
export function setReactInputValue(
  el: HTMLInputElement | HTMLTextAreaElement | null,
  value: string
): boolean {
  if (!el) return false;

  try {
    // 要素自身のプロトタイプから setter を取る。`instanceof HTMLTextAreaElement` で
    // 選ぶと、隠し iframe 内の要素（別レルム）では判定が必ず false になり、
    // textarea に HTMLInputElement の setter を呼んで "Illegal invocation" になる。
    const prototype = Object.getPrototypeOf(el) as object;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

    if (setter) {
      setter.call(el, value);
    } else {
      el.value = value;
    }

    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  } catch (e) {
    warn('setReactInputValue error:', e, el);
    return false;
  }
}
