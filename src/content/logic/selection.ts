import { debugMethodStart, debugMethodEnd } from '../infra/logger';

/**
 * 下書き商品の選択状態を管理するDraftSelectionクラス。
 *
 * - チェックボックスの選択・解除・順序管理などの操作を提供します。
 * - UI/ロジック層から選択状態を一元的に管理できます。
 *
 * @example
 *   const selection = new DraftSelection();
 *   selection.add('item1');
 *   selection.remove('item1');
 *   selection.getAll();
 */
export class DraftSelection {
  private selectedDrafts: string[] = [];

  /**
   * idを選択リストに追加
   */
  add(id: string): void {
    debugMethodStart('DraftSelection.add', { id });
    this.selectedDrafts.push(id);
    debugMethodEnd('DraftSelection.add', {
      newCount: this.selectedDrafts.length,
      addedId: id
    });
  }

  /**
   * idを選択リストから削除
   */
  remove(id: string): void {
    debugMethodStart('DraftSelection.remove', { id });
    const oldLength = this.selectedDrafts.length;
    this.selectedDrafts = this.selectedDrafts.filter((x: string) => x !== id);
    const removed = oldLength > this.selectedDrafts.length;
    debugMethodEnd('DraftSelection.remove', {
      removed,
      newCount: this.selectedDrafts.length
    });
  }

  /**
   * idが選択済みか判定
   */
  has(id: string): boolean {
    return this.selectedDrafts.includes(id);
  }

  /**
   * 選択中id一覧を取得
   */
  getAll(): string[] {
    debugMethodStart('DraftSelection.getAll');
    const result = this.selectedDrafts;
    debugMethodEnd('DraftSelection.getAll', { count: result.length });
    return result;
  }

  /**
   * 全選択解除
   */
  clear(): void {
    debugMethodStart('DraftSelection.clear', {
      previousCount: this.selectedDrafts.length
    });
    this.selectedDrafts = [];
    debugMethodEnd('DraftSelection.clear', { cleared: true });
  }

  /**
   * idの選択順序（インデックス）を取得
   */
  indexOf(id: string): number {
    debugMethodStart('DraftSelection.indexOf', { id });
    const index = this.selectedDrafts.indexOf(id);
    debugMethodEnd('DraftSelection.indexOf', {
      id,
      index,
      found: index !== -1
    });
    return index;
  }

  /**
   * 選択数
   */
  get length(): number {
    return this.selectedDrafts.length;
  }
}
