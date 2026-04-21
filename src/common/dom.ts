/**
 * DOM操作のラップ関数と例外安全なユーティリティ
 *
 * - 例外安全性・null安全性を重視したDOM操作API群です。
 * - すべてのDOM操作はtry-catchでラップされ、失敗時もアプリが落ちません。
 * - どのレイヤーからもimportして利用可能です。
 * - 新たなDOM操作ラッパーはこのファイルに追加してください。
 */

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
    console.warn('safeQuery error:', e, selector, parent);
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
    console.warn('safeQueryAll error:', e, selector, parent);
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
    console.warn('safePrepend error:', e, parent, child);
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
    console.warn('safeGetAttr error:', e, el, attr);
    return '';
  }
}

// 必要に応じて他のDOM操作ラッパーも追加可能
