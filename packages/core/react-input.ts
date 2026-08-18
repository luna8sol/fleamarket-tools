/**
 * React が制御する input / textarea に値を設定する（両拡張で共通）。
 *
 * React は value プロパティを自前のセッターで管理しているため、単に `el.value = x` としても
 * React の state が更新されず、フォーム送信時に値が反映されない。ネイティブの value セッターを
 * 直接呼び出したうえで input / change イベントを発火させる必要がある。
 *
 * セッターは**要素自身のプロトタイプ**から取る。`instanceof HTMLTextAreaElement` で選ぶと、
 * 同一オリジンの隠し iframe 内の要素（別レルム）では判定が必ず false になり、textarea に
 * HTMLInputElement のセッターを呼んで "Illegal invocation" になる。同じレルムの要素なら
 * `HTMLTextAreaElement.prototype` などから取るのと同じセッターになる。
 *
 * 失敗したときのログは拡張ごとに違うので `onError` で受け取る。
 */

/**
 * @param el 値を設定する input または textarea
 * @param value 設定する値
 * @param onError 設定に失敗したときに呼ぶ（ログ用）
 * @returns 設定できれば true、失敗すれば false
 */
export function setReactControlledValue(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string,
  onError: (e: unknown) => void
): boolean {
  try {
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
    onError(e);
    return false;
  }
}
