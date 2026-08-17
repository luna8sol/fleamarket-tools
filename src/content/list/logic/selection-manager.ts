import { QueueItem } from '../../../common/messages';

/**
 * チェックボックスの選択状態を選択順を保持して管理するクラス。
 */
export class SelectionManager {
  /** 挿入順が保持されるMapを選択順の管理に利用する */
  private selections = new Map<string, QueueItem>();

  add(item: QueueItem): void {
    if (!this.selections.has(item.id)) {
      this.selections.set(item.id, item);
    }
  }

  remove(id: string): void {
    this.selections.delete(id);
  }

  clear(): void {
    this.selections.clear();
  }

  /**
   * 指定IDに含まれない選択を破棄する。
   * ページ送りなどで一覧から消えた商品を選択したままにしないため。
   */
  retain(ids: Set<string>): void {
    for (const id of this.selections.keys()) {
      if (!ids.has(id)) {
        this.selections.delete(id);
      }
    }
  }

  getCount(): number {
    return this.selections.size;
  }

  /**
   * 選択順に並んだ商品リストを返す
   */
  getOrderedItems(): QueueItem[] {
    return Array.from(this.selections.values());
  }
}

/**
 * SelectionManagerのシングルトンインスタンス
 */
export const selectionManager = new SelectionManager();
