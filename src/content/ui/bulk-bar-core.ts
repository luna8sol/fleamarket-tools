import { ID_NAME } from '../infra/constants';

/**
 * 既存のUI要素を取得または新規作成
 */
export function getOrCreateElement<K extends keyof HTMLElementTagNameMap>(
  id: string,
  tagName: K
): HTMLElementTagNameMap[K] {
  let element = document.getElementById(id);
  if (element && element.tagName === tagName.toUpperCase()) {
    return element as HTMLElementTagNameMap[K];
  }

  element = document.createElement(tagName);
  element.id = id;
  return element as HTMLElementTagNameMap[K];
}

/**
 * 件数表示用spanのテキストを更新する
 */
export function updateDraftCount(selectedCount: number, totalCount: number): void {
  const countSpan = document.getElementById(ID_NAME.DRAFT_COUNT);
  if (countSpan) {
    countSpan.textContent = `選択件数: ${selectedCount}`;
  }
  const totalSpan = document.getElementById(ID_NAME.DRAFT_TOTAL);
  if (totalSpan) {
    totalSpan.textContent = `全件数: ${totalCount}`;
  }
}
