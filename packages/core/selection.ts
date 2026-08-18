/**
 * 選択状態を選択順つきで持つ（両拡張で共通の骨格）。
 *
 * 挿入順が保持される Map を選択順の管理に使う。一度外した ID を選び直すと末尾に付く
 * （チェックした順に処理順を決める仕様）。値の型 `V` は拡張ごとに違う
 * （メルカリは選択の連番、ラクマはキューに積む `QueueItem`）。
 * メソッド名・戻り値の形・ログは各パッケージのラッパーで付ける。
 */
export class OrderedSelection<V> {
  private readonly entries = new Map<string, V>();

  /** 選択に加える。既に選択済みなら何もしない（順序も値も変えない）。加えたら true */
  add(id: string, value: V): boolean {
    if (this.entries.has(id)) return false;
    this.entries.set(id, value);
    return true;
  }

  /** 選択から外す。外したら true */
  remove(id: string): boolean {
    return this.entries.delete(id);
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }

  get(id: string): V | undefined {
    return this.entries.get(id);
  }

  clear(): void {
    this.entries.clear();
  }

  /**
   * `ids` に含まれない選択を外す（ページ送りなどで一覧から消えた商品を選択したままにしないため）。
   *
   * @returns 外した件数
   */
  retain(ids: ReadonlySet<string>): number {
    let removed = 0;
    for (const id of this.entries.keys()) {
      if (!ids.has(id)) {
        this.entries.delete(id);
        removed++;
      }
    }
    return removed;
  }

  get size(): number {
    return this.entries.size;
  }

  /** 選択順の ID */
  ids(): string[] {
    return Array.from(this.entries.keys());
  }

  /** 選択順の値 */
  values(): V[] {
    return Array.from(this.entries.values());
  }

  /** 選択順の [ID, 値] の組 */
  toArray(): [string, V][] {
    return Array.from(this.entries.entries());
  }

  /** 選択順での位置（0 始まり）。選択されていなければ -1 */
  indexOf(id: string): number {
    let index = 0;
    for (const key of this.entries.keys()) {
      if (key === id) return index;
      index++;
    }
    return -1;
  }
}
