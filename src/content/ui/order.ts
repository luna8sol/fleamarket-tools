import { CLASS_NAME } from '../infra/constants';

/**
 * 順番表示用の <span> 要素を生成するユーティリティ関数。
 *
 * - チェックボックス横に表示される「出品順序」用のspanを生成します。
 * - 例外安全なDOM生成ラッパーを利用し、生成失敗時は例外を投げます。
 * - スタイルやクラス名も一括で付与されるため、UI部品として再利用可能です。
 *
 * @returns {HTMLSpanElement} 出品順序表示用のspan要素
 * @throws DOM生成に失敗した場合
 * @example
 *   const span = createOrderSpan();
 *   parent.appendChild(span);
 */
export function createOrderSpan(): HTMLSpanElement {
  // 出品順序表示用spanを安全に生成
  const orderSpan: HTMLSpanElement = document.createElement('span');
  if (!orderSpan) throw new Error('Failed to create order span');
  orderSpan.className = CLASS_NAME.BULK_ORDER_SPAN;
  orderSpan.style.marginRight = '4px';
  orderSpan.style.fontWeight = 'bold';
  orderSpan.style.color = '#333';
  orderSpan.textContent = '';
  return orderSpan;
}
