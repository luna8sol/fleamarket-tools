import { debugMethodStart, debugMethodEnd } from '../infra/logger';
import { OrderedSelection } from '@fleamarket/core/selection';

/**
 * 選択商品の管理を担当するモジュール
 * - 選択順の管理
 * - 選択状態の追加/削除
 *
 * 選択順つきの保持は共有部品 `@fleamarket/core/selection`（挿入順の Map）にある。
 * ここでは、この拡張のメソッド名と戻り値の形、選択ごとに振る連番（`order`）、
 * debug ログを付ける。連番は選択した順に増え、全解除でだけ 0 に戻るので、
 * Map の挿入順と連番の昇順は常に一致する。
 */
export class SelectionManager {
  // 選択されたアイテム（ID → 選択の連番）。挿入順 = 選択順
  private selections = new OrderedSelection<number>();
  // 現在の最大選択順（次に選択されるアイテムの順番）
  private currentOrder: number = 0;

  /**
   * アイテムを選択リストに追加する
   *
   * 【仕様】一度解除したアイテムを再選択した場合、選択順は末尾に追加される。
   * 例: B→A→C の順で選択後、B を解除して再選択すると順序は A→C→B になる。
   * これはチェックした順に出品順序を決める仕様であり、意図的な動作。
   *
   * @param id 追加するアイテムのID
   * @returns 処理結果
   */
  addSelection(id: string): {
    added: boolean;
    alreadySelected: boolean;
    newCount: number;
    order?: number;
  } {
    debugMethodStart('SelectionManager.addSelection', { id });

    // 既に選択済みかチェック
    if (this.selections.has(id)) {
      debugMethodEnd('SelectionManager.addSelection', {
        added: false,
        alreadySelected: true,
        newCount: this.selections.size,
      });
      return { added: false, alreadySelected: true, newCount: this.selections.size };
    }

    // 次の順番を割り当て
    const order = ++this.currentOrder;
    this.selections.add(id, order);

    // 順番情報を含めてログ出力
    const result = {
      added: true,
      alreadySelected: false,
      newCount: this.selections.size,
      order,
    };

    debugMethodEnd('SelectionManager.addSelection', result);
    return result;
  }

  /**
   * アイテムの選択を解除する
   * @param id 解除するアイテムのID
   * @returns 処理結果
   */
  removeSelection(id: string): { removed: boolean; wasSelected: boolean; newCount: number } {
    debugMethodStart('SelectionManager.removeSelection', { id });

    // 選択されていなければ何もしない
    if (!this.selections.has(id)) {
      debugMethodEnd('SelectionManager.removeSelection', {
        removed: false,
        wasSelected: false,
        newCount: this.selections.size,
      });
      return { removed: false, wasSelected: false, newCount: this.selections.size };
    }

    // 選択解除
    this.selections.remove(id);

    // 結果をログ出力
    const result = {
      removed: true,
      wasSelected: true,
      newCount: this.selections.size,
    };

    debugMethodEnd('SelectionManager.removeSelection', result);
    return result;
  }

  /**
   * 全ての選択を順序付きで取得する
   * @returns 選択順（= 連番の昇順）に並んだ選択アイテムの配列
   */
  getOrderedSelections(): { id: string; order: number }[] {
    return this.selections.toArray().map(([id, order]) => ({ id, order }));
  }

  /**
   * 選択状態をリセットする
   */
  clearSelections(): void {
    this.selections.clear();
    this.currentOrder = 0;
  }

  /**
   * アイテムが選択されているかを確認する
   * @param id チェックするアイテムのID
   * @returns 選択されている場合はtrue
   */
  isSelected(id: string): boolean {
    return this.selections.has(id);
  }

  /**
   * 選択されているすべてのIDを取得する
   * @returns 選択されているIDの配列
   */
  getAll(): string[] {
    return this.selections.ids();
  }

  /**
   * 選択されているアイテムの数を取得する
   * @returns 選択数
   */
  getSelectionCount(): number {
    return this.selections.size;
  }

  /**
   * アイテムの順序インデックスを取得する
   * @param id アイテムのID
   * @returns 順序インデックス（選択されていない場合は-1）
   */
  getOrderIndex(id: string): number {
    return this.selections.indexOf(id);
  }
}

// シングルトンインスタンス
export const selectionManager = new SelectionManager();
