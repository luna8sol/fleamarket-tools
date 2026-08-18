import { QueueItem } from '../../../common/messages';
import { OrderedSelection } from '@fleamarket/core/selection';

/**
 * チェックボックスの選択状態を選択順を保持して管理するクラス。
 *
 * 選択順つきの保持は共有部品 `@fleamarket/core/selection`（挿入順の Map）にある。
 * ここでは、この拡張のメソッド名と、値としてキューに積む形（`QueueItem`）をそのまま持つことを決める。
 */
export class SelectionManager {
  private selections = new OrderedSelection<QueueItem>();

  add(item: QueueItem): void {
    this.selections.add(item.id, item);
  }

  remove(id: string): void {
    this.selections.remove(id);
  }

  clear(): void {
    this.selections.clear();
  }

  /**
   * 指定IDに含まれない選択を破棄する。
   * ページ送りなどで一覧から消えた商品を選択したままにしないため。
   */
  retain(ids: Set<string>): void {
    this.selections.retain(ids);
  }

  getCount(): number {
    return this.selections.size;
  }

  /**
   * 選択順に並んだ商品リストを返す
   */
  getOrderedItems(): QueueItem[] {
    return this.selections.values();
  }
}

/**
 * SelectionManagerのシングルトンインスタンス
 */
export const selectionManager = new SelectionManager();
