import { debug, warn, debugMethodStart, debugMethodEnd } from '../infra/logger';
import { SELECTOR, PageType, CONFIG } from '../infra/constants';
import { detectCurrentPage } from '../infra/page-detector';
import { renderUiComponents } from '../ui/ui-manager';
import { showListLoadError, hideListLoadError } from '../ui/list-load-error';

/**
 * DOMの変更を監視し、必要なUI更新処理を行う管理クラス
 * - MutationObserverを利用してリスト要素の追加・削除を検知
 * - UIコンポーネントの再描画を制御
 */
export class ObserverManager {
  /**
   * 直近で監視した<ul>要素
   * @type {HTMLUListElement | null}
   */
  private lastUl: HTMLUListElement | null = null;

  /**
   * UI再描画のためのタイマーID
   * @type {number | null}
   */
  private relistTimeout: number | null = null;

  /**
   * リスト要素の出現・差し替えを検知するMutationObserver
   * @type {MutationObserver | null}
   */
  private rootObserver: MutationObserver | null = null;

  /**
   * <li>要素の監視用MutationObserver
   * @type {MutationObserver | null}
   */
  private liObserver: MutationObserver | null = null;

  /**
   * リスト要素の出現を待つ締め切りのタイマーID
   * @type {number | null}
   */
  private listWaitTimeout: number | null = null;

  /**
   * 監視対象のリスト要素のセレクタ（対応するページでのみ設定される）
   * @type {string | null}
   */
  private listSelector: string | null = null;

  /**
   * 現在の実行状態を追跡するフラグ
   * @type {boolean}
   */
  private isProcessingPage = false;

  /**
   * すべてのMutationObserverを解除し、タイマーもクリアする
   * @returns {void}
   */
  disconnectObservers(): void {
    debugMethodStart('ObserverManager.disconnectObservers');

    this.rootObserver?.disconnect();
    this.liObserver?.disconnect();
    this.rootObserver = null;
    this.liObserver = null;

    if (this.relistTimeout) {
      clearTimeout(this.relistTimeout);
      this.relistTimeout = null;
    }

    this.clearListWaitTimeout();

    debugMethodEnd('ObserverManager.disconnectObservers', { status: 'completed' });
  }

  /**
   * 現在のページタイプに対応するリスト要素のセレクタを返す
   * @returns {string | null} 対応していないページならnull
   */
  private resolveListSelector(pageType: PageType): string | null {
    if (pageType === PageType.DRAFTS) {
      return SELECTOR.DRAFT_LIST;
    }
    if (pageType === PageType.LISTINGS) {
      return SELECTOR.ITEMS_LIST;
    }
    return null;
  }

  /**
   * リスト要素の出現待ちの締め切りタイマーを解除する
   * @returns {void}
   */
  private clearListWaitTimeout(): void {
    if (this.listWaitTimeout !== null) {
      clearTimeout(this.listWaitTimeout);
      this.listWaitTimeout = null;
    }
  }

  /**
   * リスト要素の監視を開始し、リスト要素の変化に応じてUIを更新する
   *
   * 監視の起点は`document.body`。メルカリはSPAで`main`要素ごと差し替えうるが、
   * 起動時に掴んだ要素をMutationObserverに渡すと、差し替えられた時点で
   * デタッチされたノードを監視し続けて二度と発火しなくなる。`document.body`は
   * 差し替わらないため、リストの遅延描画にも差し替えにも追従できる。
   *
   * @returns {void}
   */
  startObserving(): void {
    debugMethodStart('ObserverManager.startObserving');

    this.disconnectObservers();
    hideListLoadError();
    this.lastUl = null;

    const pageType = detectCurrentPage();
    const listSelector = this.resolveListSelector(pageType);

    if (!listSelector) {
      this.listSelector = null;
      debugMethodEnd('ObserverManager.startObserving', {
        status: 'aborted',
        reason: '対応していないページタイプ',
        pageType
      });
      return;
    }

    this.listSelector = listSelector;

    this.rootObserver = new MutationObserver(() => this.syncListElement());
    this.rootObserver.observe(document.body, { childList: true, subtree: true });

    const ul = document.querySelector(listSelector);
    if (ul instanceof HTMLUListElement) {
      debug(`${listSelector} 要素が見つかりました。UIを更新します`);
      this.setupObserversForUl(ul);
    } else {
      debug(`${listSelector} 要素が見つかりませんでした。読み込みを待機します`);
      this.startListWaitTimeout(listSelector);
    }

    debugMethodEnd('ObserverManager.startObserving', {
      status: 'completed',
      rootObserverAttached: true,
      pageType,
      listSelector
    });
  }

  /**
   * リスト要素が現れないまま締め切りを迎えたら、ユーザーに見える形で知らせる。
   *
   * 締め切り後も`rootObserver`は動き続けるので、あとからリストが描画されれば
   * 自動で復帰する。それまでの間、何も表示されない状態を放置しないためのもの。
   *
   * @param {string} listSelector - 待機中のリスト要素のセレクタ
   * @returns {void}
   */
  private startListWaitTimeout(listSelector: string): void {
    this.clearListWaitTimeout();

    this.listWaitTimeout = window.setTimeout(() => {
      this.listWaitTimeout = null;

      if (this.lastUl) return;

      warn(
        `リスト要素 ${listSelector} が ${CONFIG.LIST_WAIT_TIMEOUT_MS}ms 待っても見つかりませんでした`
      );
      showListLoadError(() => this.startObserving());
    }, CONFIG.LIST_WAIT_TIMEOUT_MS);
  }

  /**
   * DOM変更のたびに呼ばれ、監視対象のリスト要素が入れ替わっていれば張り直す。
   * 掴んでいたリストがDOMから切り離され、代わりも見つからない場合は
   * 「見失った」ものとして締め切りタイマーを立て直す（リスト出現待ちと同じ扱いに揃える）。
   * @returns {void}
   */
  private syncListElement(): void {
    if (this.isProcessingPage || !this.listSelector) return;

    // 監視中のリストがDOMに繋がったままなら張り直す必要はない（li側の変更はliObserverが拾う）。
    // document.body全体を見ているぶんコールバックは頻繁に走るので、
    // 毎回document.querySelectorを投げないよう、ここで先に打ち切る。
    if (this.lastUl?.isConnected) return;

    try {
      const ul = document.querySelector(this.listSelector);

      if (ul instanceof HTMLUListElement) {
        if (ul === this.lastUl) return;

        this.isProcessingPage = true;
        debug(`DOM変更後に ${this.listSelector} 要素が見つかりました`);
        this.setupObserversForUl(ul);
        return;
      }

      // lastUlがnull以外＝直前まで監視できていたリストを見失った瞬間。
      // ここで一度だけ締め切りを立て直す（見つからないまま呼ばれ続けても再セットしない。
      // でないとDOM変更が続く限り締め切りが延び続け、いつまでも発火しなくなる）。
      if (this.lastUl !== null) {
        warn(`監視中の ${this.listSelector} 要素を見失いました。再出現を待機します`);
        this.lastUl = null;
        this.startListWaitTimeout(this.listSelector);
      }
    } catch (e) {
      warn('rootObserver コールバックでエラーが発生しました', e);
    } finally {
      this.isProcessingPage = false;
    }
  }

  /**
   * 見つかったul要素に対して監視を設定する
   * @param {HTMLUListElement} ul - 監視対象のul要素
   * @returns {void}
   */
  private setupObserversForUl(ul: HTMLUListElement): void {
    debugMethodStart('ObserverManager.setupObserversForUl', {
      ulChildCount: ul.children.length
    });

    this.clearListWaitTimeout();
    hideListLoadError();

    if (this.relistTimeout) {
      clearTimeout(this.relistTimeout);
      this.relistTimeout = null;
    }

    this.lastUl = ul;
    try {
      renderUiComponents(ul);
    } catch (e) {
      warn('setupObserversForUl: renderUiComponents でエラーが発生しました', e);
    }

    this.liObserver?.disconnect();
    this.liObserver = new MutationObserver(() => {
      if (this.relistTimeout) {
        clearTimeout(this.relistTimeout);
      }
      this.relistTimeout = window.setTimeout(() => {
        try {
          renderUiComponents(ul);
        } catch (e) {
          warn('liObserver: renderUiComponents でエラーが発生しました', e);
        }
      }, 500);
    });

    this.liObserver.observe(ul, { childList: true, subtree: false });

    debugMethodEnd('ObserverManager.setupObserversForUl', { status: 'completed' });
  }

}

/**
 * ObserverManagerのシングルトンインスタンス
 * @type {ObserverManager}
 */
export const observerManager = new ObserverManager();
