import { COMPOSITE_SELECTOR, SELECTOR } from '../infra/constants';
import { warn } from '../infra/logger';

/**
 * 有効にできるフィルターの種類
 */
export type FilterType = 'likes' | 'comments';

/**
 * 各フィルターのON/OFF状態
 */
interface FilterState {
  likes: boolean;
  comments: boolean;
}

/**
 * li内のSVGアイコン直後のspanインデックス定数
 * Mercariの商品カードは「いいね → コメント → 閲覧数」の順で並ぶ
 */
const COUNT_INDEX = {
  LIKES: 0,
  COMMENTS: 1,
} as const;

/**
 * 出品中商品一覧のフィルタリングを管理するクラス。
 * - 「いいね1以上」「コメント1以上」の条件でli要素を表示/非表示に切り替える。
 * - シングルトンとして利用し、フィルター状態はページ遷移をまたいで保持する。
 */
export class FilterManager {
  private state: FilterState = { likes: false, comments: false };
  private currentUl: HTMLUListElement | null = null;

  /**
   * 監視対象のul要素を設定する
   */
  setUl(ul: HTMLUListElement): void {
    this.currentUl = ul;
  }

  /**
   * 指定フィルターのON/OFFを切り替え、即座に適用する
   *
   * @returns 適用できた場合はtrue。カウントを読めずフィルターを解除した場合はfalse
   */
  toggle(filter: FilterType): boolean {
    this.state[filter] = !this.state[filter];
    return this.apply();
  }

  /**
   * 指定フィルターが有効かどうかを返す
   */
  isActive(filter: FilterType): boolean {
    return this.state[filter];
  }

  /**
   * 現在のフィルター状態をulの全li要素に適用する。
   *
   * 他ツールによって既に非表示になっているli（display:none だが
   * data-filter-hidden 属性を持たないもの）には一切触れない。
   * このフィルターが非表示にしたliには data-filter-hidden="true" を付与し、
   * 表示に戻す際はその属性を持つliだけを対象とする。
   *
   * どのliからもカウントを読み取れない場合はメルカリ側のDOMが変わった可能性が高い。
   * 全件を0件扱いで隠してしまう前にフィルターを解除し、警告を出して呼び出し元に知らせる。
   *
   * @returns 適用できた場合はtrue。カウントを読めずフィルターを解除した場合はfalse
   */
  apply(): boolean {
    if (!this.currentUl) return true;

    const items = Array.from(this.currentUl.querySelectorAll<HTMLLIElement>('li'));
    let applied = true;

    if (this.hasActiveFilter() && items.length > 0 && !this.hasReadableCounts(items)) {
      warn(
        'FilterManager: いいね・コメント数を読み取れないためフィルターを解除します',
        SELECTOR.ITEM_COUNT_SPAN
      );
      this.state = { likes: false, comments: false };
      applied = false;
    }

    for (const li of items) {
      const shouldShow = this.isVisible(li);
      const hiddenByUs = li.dataset.filterHidden === 'true';

      if (shouldShow) {
        // 自分たちが隠した場合のみ元に戻す（他ツールの非表示は維持）
        if (hiddenByUs) {
          li.style.display = '';
          delete li.dataset.filterHidden;
        }
      } else {
        // 既に他ツールで非表示の場合は上書きしない
        if (li.style.display !== 'none') {
          li.style.display = 'none';
          li.dataset.filterHidden = 'true';
        }
        // 画面から消えた商品が一括再出品の対象に残らないようにする
        this.deselectItem(li);
      }
    }

    return applied;
  }

  /**
   * 全フィルターをOFFにして全件表示に戻す
   */
  reset(): void {
    this.state = { likes: false, comments: false };
    this.apply();
  }

  /**
   * 非表示にしたli要素の選択を解除する。
   *
   * 一括再出品の対象はSelectionManagerが持つ選択順から決まり、liの表示状態は見ない。
   * 選択したままフィルターを掛けると、画面から消えた商品がそのまま再出品されてしまうため、
   * 非表示にする時点で選択から外して「見えている商品だけが対象」を保つ。
   *
   * チェックボックスのchangeを発火させ、選択解除・選択件数表示・順番表示の更新は
   * 既存のハンドラにまとめて任せる。
   */
  private deselectItem(li: HTMLLIElement): void {
    const checkbox = li.querySelector<HTMLInputElement>(COMPOSITE_SELECTOR.BULK_CHECKBOX_INPUT);
    if (!checkbox?.checked) return;

    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change', { bubbles: false }));
  }

  /**
   * いずれかのフィルターが有効かどうかを返す
   */
  private hasActiveFilter(): boolean {
    return this.state.likes || this.state.comments;
  }

  /**
   * カウントを読み取れるli要素が1件でも存在するかを返す。
   *
   * 広告枠など商品以外のliが混ざることがあるため、1件でも読めれば構造は生きていると見なす。
   * 1件も読めない場合はセレクタが当たらなくなった（メルカリ側のDOM変更）と判断する。
   */
  private hasReadableCounts(items: HTMLLIElement[]): boolean {
    return items.some(
      (li) =>
        this.getCountByIndex(li, COUNT_INDEX.LIKES) !== null ||
        this.getCountByIndex(li, COUNT_INDEX.COMMENTS) !== null
    );
  }

  /**
   * li要素が現在のフィルター条件を満たすかどうかを判定する
   */
  private isVisible(li: HTMLLIElement): boolean {
    if (this.state.likes && (this.getCountByIndex(li, COUNT_INDEX.LIKES) ?? 0) < 1) {
      return false;
    }
    if (this.state.comments && (this.getCountByIndex(li, COUNT_INDEX.COMMENTS) ?? 0) < 1) {
      return false;
    }
    return true;
  }

  /**
   * li内の「svg[aria-hidden="true"] + span」を列挙し、指定インデックスの数値を返す。
   *
   * Mercariの商品カードはSVGアイコン＋数値spanが
   * 「いいね(0) → コメント(1) → 閲覧数(2)」の順で並ぶ。
   *
   * @returns 読み取れた件数。要素が見つからない・数値でない場合はnull（判定不能）
   */
  private getCountByIndex(li: HTMLLIElement, index: number): number | null {
    try {
      const spans = Array.from(li.querySelectorAll<HTMLSpanElement>(SELECTOR.ITEM_COUNT_SPAN));
      const span = spans[index];
      if (!span) return null;
      const num = parseInt(span.textContent?.trim() ?? '', 10);
      return isNaN(num) ? null : num;
    } catch (e) {
      warn('FilterManager.getCountByIndex error', e, index);
      return null;
    }
  }
}

/**
 * FilterManagerのシングルトンインスタンス
 */
export const filterManager = new FilterManager();
