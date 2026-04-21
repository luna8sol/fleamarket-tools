import { debug, warn, debugMethodStart, debugMethodEnd } from '../infra/logger';
import { SELECTOR, PageType, CONFIG } from '../infra/constants';
import { detectCurrentPage } from '../infra/page-detector';
import { renderUiComponents } from '../ui/ui-manager';

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
   * <ul>要素の監視用MutationObserver
   * @type {MutationObserver | null}
   */
  private ulObserver: MutationObserver | null = null;

  /**
   * <li>要素の監視用MutationObserver
   * @type {MutationObserver | null}
   */
  private liObserver: MutationObserver | null = null;

  /**
   * 要素待機用のタイマーID
   * @type {number | null}
   */
  private waitForElementTimeout: number | null = null;

  /**
   * 現在の実行状態を追跡するフラグ
   * @type {boolean}
   */
  private isProcessingPage = false;

  /**
   * 最後に処理したページのURL
   * @type {string | null}
   */
  private lastProcessedUrl: string | null = null;

  /**
   * すべてのMutationObserverを解除し、タイマーもクリアする
   * @returns {void}
   */
  disconnectObservers(): void {
    debugMethodStart('ObserverManager.disconnectObservers');

    this.ulObserver?.disconnect();
    this.liObserver?.disconnect();
    this.ulObserver = null;
    this.liObserver = null;

    if (this.relistTimeout) {
      clearTimeout(this.relistTimeout);
      this.relistTimeout = null;
    }

    if (this.waitForElementTimeout) {
      clearTimeout(this.waitForElementTimeout);
      this.waitForElementTimeout = null;
    }

    debugMethodEnd('ObserverManager.disconnectObservers', { status: 'completed' });
  }

  /**
   * 指定されたセレクタの要素が見つかるまで待機する
   * @param {string} selector - 検索するセレクタ
   * @param {HTMLElement} rootElement - 検索の起点となる要素
   * @param {number} maxRetryCount - 最大リトライ回数
   * @param {(element: HTMLElement) => void} onFound - 要素が見つかった時に実行するコールバック
   * @param {() => void} [onNotFound] - 最大リトライ回数を超えた時に実行するコールバック
   * @returns {void}
   */
  private waitForElement(
    selector: string,
    rootElement: HTMLElement,
    maxRetryCount: number,
    onFound: (element: HTMLElement) => void,
    onNotFound?: () => void
  ): void {
    let retryCount = 0;

    const tryFindElement = (): void => {
      const element = rootElement.querySelector(selector) as HTMLElement;
      if (element) {
        onFound(element);
        return;
      }

      retryCount++;
      if (retryCount >= maxRetryCount) {
        warn(`要素 ${selector} が ${maxRetryCount} 回の試行後も見つかりませんでした`);
        onNotFound?.();
        return;
      }

      this.waitForElementTimeout = window.setTimeout(() => {
        this.waitForElementTimeout = null;
        tryFindElement();
      }, CONFIG.OBSERVER_RETRY_INTERVAL);
    };

    tryFindElement();
  }

  /**
   * #__next要素の監視を開始し、リスト要素の変化に応じてUIを更新する
   * @returns {void}
   */
  startObserving(): void {
    const currentUrl = window.location.href;

    if (this.isProcessingPage && this.lastProcessedUrl === currentUrl) {
      debug(`既に処理中のため、重複実行を防止しました: ${currentUrl}`);
      return;
    }

    this.isProcessingPage = true;
    this.lastProcessedUrl = currentUrl;

    debugMethodStart('ObserverManager.startObserving');

    const rootDiv = document.querySelector('main#main') as HTMLElement | null;

    if (!rootDiv) {
      warn('mainタグが見つかりません');
      debugMethodEnd('ObserverManager.startObserving', { status: 'failed', reason: 'mainタグが見つからない' });

      this.waitForElement(
        'main#main',
        document.body,
        CONFIG.OBSERVER_MAX_RETRY_COUNT,
        (mainElement) => {
          debug('mainタグが遅延読み込みされました');
          this.startObservingWithRoot(mainElement);
          this.isProcessingPage = false;
        },
        () => {
          this.isProcessingPage = false;
        }
      );
      return;
    }

    debug('mainタグ found, start observing');
    this.startObservingWithRoot(rootDiv);
    this.isProcessingPage = false;
  }

  /**
   * rootDiv要素を起点に監視を開始する
   * @param {HTMLElement} rootDiv - 監視の起点となるルート要素
   * @returns {void}
   */
  private startObservingWithRoot(rootDiv: HTMLElement): void {
    debugMethodStart('ObserverManager.startObservingWithRoot', { rootElement: rootDiv.tagName });

    this.disconnectObservers();

    const pageType = detectCurrentPage();

    let ulSelector: string;
    if (pageType === PageType.DRAFTS) {
      ulSelector = SELECTOR.DRAFT_LIST;
    } else if (pageType === PageType.LISTINGS) {
      ulSelector = SELECTOR.ITEMS_LIST;
    } else {
      debugMethodEnd('ObserverManager.startObservingWithRoot', {
        status: 'aborted',
        reason: '対応していないページタイプ',
        pageType
      });
      return;
    }

    const ul = rootDiv.querySelector(ulSelector) as HTMLUListElement;
    if (ul instanceof HTMLUListElement) {
      debug(`${ulSelector} 要素が見つかりました。UIを更新します`);
      this.setupObserversForUl(ul);
    } else {
      debug(`${ulSelector} 要素が見つかりませんでした。読み込みを待機します`);
      this.waitForElement(
        ulSelector,
        rootDiv,
        CONFIG.OBSERVER_MAX_RETRY_COUNT,
        (ulElement) => {
          if (ulElement instanceof HTMLUListElement) {
            debug(`${ulSelector} 要素が遅延読み込みされました`);
            this.setupObserversForUl(ulElement as HTMLUListElement);
          }
        },
        () => {
          warn(`リスト要素 ${ulSelector} が見つからなかったため監視を開始できませんでした`);
        }
      );
    }

    this.ulObserver = new MutationObserver(() => {
      if (this.isProcessingPage) return;

      try {
        const ul = rootDiv?.querySelector(ulSelector);
        if (!(ul instanceof HTMLUListElement)) {
          this.waitForElement(
            ulSelector,
            rootDiv,
            3,
            (ulElement) => {
              if (ulElement instanceof HTMLUListElement) {
                debug(`DOM変更後に ${ulSelector} 要素が見つかりました`);
                this.setupObserversForUl(ulElement as HTMLUListElement);
              }
            },
            () => {
              warn(`DOM変更後もリスト要素 ${ulSelector} が見つかりませんでした`);
            }
          );
          return;
        }

        if (ul !== this.lastUl) {
          this.isProcessingPage = true;
          this.setupObserversForUl(ul);
          this.isProcessingPage = false;
        }
      } catch (e) {
        warn('ulObserver コールバックでエラーが発生しました', e);
        this.isProcessingPage = false;
      }
    });

    this.ulObserver.observe(rootDiv, { childList: true, subtree: true });

    debugMethodEnd('ObserverManager.startObservingWithRoot', {
      status: 'completed',
      ulObserverAttached: true,
      pageType,
      ulSelector
    });
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
