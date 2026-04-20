import { debug, warn, debugMethodStart, debugMethodEnd } from '../infra/logger';
import { SELECTOR, PageType } from '../infra/constants';
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
   * 要素検索の最大試行回数
   * @type {number}
   */
  private readonly MAX_RETRY_COUNT = 10;

  /**
   * 要素検索の試行間隔（ミリ秒）
   * @type {number}
   */
  private readonly RETRY_INTERVAL = 500;

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
    const startTime = performance.now();
    debugMethodStart('ObserverManager.disconnectObservers', {
      hasUlObserver: !!this.ulObserver,
      hasLiObserver: !!this.liObserver,
      hasTimeout: !!this.relistTimeout,
      hasWaitTimeout: !!this.waitForElementTimeout
    });

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

    const duration = Math.round(performance.now() - startTime);
    debugMethodEnd('ObserverManager.disconnectObservers', {
      status: 'completed',
      observersCleared: true,
      timeoutCleared: true
    }, duration);
  }

  /**
   * 指定されたセレクタの要素が見つかるまで待機する
   * @param {string} selector - 検索するセレクタ
   * @param {HTMLElement} rootElement - 検索の起点となる要素
   * @param {number} maxRetryCount - 最大リトライ回数
   * @param {(element: HTMLElement) => void} callback - 要素が見つかった時に実行するコールバック
   * @returns {void}
   */
  private waitForElement(
    selector: string,
    rootElement: HTMLElement,
    maxRetryCount: number,
    callback: (element: HTMLElement) => void
  ): void {
    let retryCount = 0;

    const tryFindElement = (): void => {
      debugMethodStart('ObserverManager.waitForElement.tryFindElement', {
        selector,
        retryCount,
        maxRetryCount
      });

      const element = rootElement.querySelector(selector) as HTMLElement;
      if (element) {
        debugMethodEnd('ObserverManager.waitForElement.tryFindElement', {
          status: 'found',
          selector,
          elementTagName: element.tagName,
          childCount: element.children.length
        });
        callback(element);
        return;
      }

      retryCount++;
      if (retryCount >= maxRetryCount) {
        warn(`要素 ${selector} が ${maxRetryCount} 回の試行後も見つかりませんでした`);
        debugMethodEnd('ObserverManager.waitForElement.tryFindElement', {
          status: 'failed',
          reason: '最大試行回数に達した',
          selector,
          retryCount
        });
        return;
      }

      this.waitForElementTimeout = window.setTimeout(() => {
        this.waitForElementTimeout = null;
        tryFindElement();
      }, this.RETRY_INTERVAL);

      debugMethodEnd('ObserverManager.waitForElement.tryFindElement', {
        status: 'retry',
        nextRetryCount: retryCount,
        waitTime: this.RETRY_INTERVAL
      });
    };

    tryFindElement();
  }

  /**
   * #__next要素の監視を開始し、リスト要素の変化に応じてUIを更新する
   * @returns {void}
   */
  startObserving(): void {
    // 現在のURLを取得
    const currentUrl = window.location.href;

    // 前回と同じURLで実行中の場合は重複実行を防止
    if (this.isProcessingPage && this.lastProcessedUrl === currentUrl) {
      debug(`既に処理中のため、重複実行を防止しました: ${currentUrl}`);
      return;
    }

    this.isProcessingPage = true;
    this.lastProcessedUrl = currentUrl;

    debugMethodStart('ObserverManager.startObserving');

    // const containerDiv = document.getElementById(SELECTOR.ROOT_CONTAINER);
    const rootDiv = document.querySelector('main#main') as HTMLElement | null;

    if (!rootDiv) {
      warn('mainタグが見つかりません');
      debugMethodEnd('ObserverManager.startObserving', {
        status: 'failed',
        reason: 'mainタグが見つからない'
      });

      // mainタグの読み込みを待機
      this.waitForElement(
        'main#main',
        document.body,
        this.MAX_RETRY_COUNT,
        (mainElement) => {
          debug('mainタグが遅延読み込みされました');
          this.startObservingWithRoot(mainElement);
          this.isProcessingPage = false; // 処理完了
        }
      );
      return;
    }

    debug('mainタグ found, start observing');
    this.startObservingWithRoot(rootDiv);

    // 処理が完了したら実行状態をリセット
    setTimeout(() => {
      this.isProcessingPage = false;
    }, 1000); // 1秒後にリセット（UI描画が完了する時間を考慮）
  }

  /**
   * rootDiv要素を起点に監視を開始する
   * @param {HTMLElement} rootDiv - 監視の起点となるルート要素
   * @returns {void}
   */
  private startObservingWithRoot(rootDiv: HTMLElement): void {
    debugMethodStart('ObserverManager.startObservingWithRoot', {
      rootElement: rootDiv.tagName
    });

    this.disconnectObservers();

    // 表示画面を取得
    const pageType = detectCurrentPage();
    debugMethodStart('ObserverManager.startObservingWithRoot.detectPage', { pageType });

    // 監視する<ul>要素のセレクタを決定
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

    debugMethodStart('ObserverManager.startObservingWithRoot.setupUlObserver', {
      targetSelector: ulSelector,
      pageType
    });

    // 最初にul要素を探す
    const ul = rootDiv.querySelector(ulSelector) as HTMLUListElement;
    if (ul instanceof HTMLUListElement) {
      debug(`${ulSelector} 要素が見つかりました。UIを更新します`);
      this.setupObserversForUl(ul);
    } else {
      debug(`${ulSelector} 要素が見つかりませんでした。読み込みを待機します`);

      // ul要素の読み込みを待機
      this.waitForElement(
        ulSelector,
        rootDiv,
        this.MAX_RETRY_COUNT,
        (ulElement) => {
          if (ulElement instanceof HTMLUListElement) {
            debug(`${ulSelector} 要素が遅延読み込みされました`);
            this.setupObserversForUl(ulElement as HTMLUListElement);
          }
        }
      );
    }

    // <ul>要素の監視を開始
    this.ulObserver = new MutationObserver((mutations) => {
      // 重複実行を防止するためのチェック
      if (this.isProcessingPage) {
        debugMethodStart('ulObserver.callback', {
          mutationsCount: mutations.length,
          isProcessing: true
        });
        debugMethodEnd('ulObserver.callback', {
          status: 'skipped',
          reason: '処理中のため重複実行を防止'
        });
        return;
      }

      debugMethodStart('ulObserver.callback', {
        mutationsCount: mutations.length
      });

      try {
        const ul = rootDiv?.querySelector(ulSelector);
        if (!(ul instanceof HTMLUListElement)) {
          debugMethodEnd('ulObserver.callback', {
            status: 'aborted',
            reason: 'ul要素が見つからない',
            selector: ulSelector
          });

          // DOM変更後にul要素が見つからない場合も待機を開始
          this.waitForElement(
            ulSelector,
            rootDiv,
            3, // 少ないリトライ回数（DOM変更後なので頻繁に試行する必要はない）
            (ulElement) => {
              if (ulElement instanceof HTMLUListElement) {
                debug(`DOM変更後に ${ulSelector} 要素が見つかりました`);
                this.setupObserversForUl(ulElement as HTMLUListElement);
              }
            }
          );
          return;
        }

        if (ul !== this.lastUl) {
          this.isProcessingPage = true;
          this.setupObserversForUl(ul);

          // 処理が完了したら実行状態をリセット
          setTimeout(() => {
            this.isProcessingPage = false;
          }, 500);
        } else {
          debugMethodEnd('ulObserver.callback', {
            status: 'unchanged',
            reason: '同じul要素が既に監視中'
          });
        }
      } catch (e) {
        warn('ulObserver コールバックでエラーが発生しました', e);
        this.isProcessingPage = false;
      }
    });

    debugMethodStart('ObserverManager.startObservingWithRoot.attachUlObserver', {
      target: rootDiv.tagName,
      options: { childList: true, subtree: true }
    });

    this.ulObserver.observe(rootDiv, { childList: true, subtree: true });

    debugMethodEnd('ObserverManager.startObservingWithRoot.attachUlObserver');
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
      oldUl: this.lastUl ? `${this.lastUl.tagName}(子要素:${this.lastUl.children.length})` : 'null',
      newUl: `${ul.tagName}(子要素:${ul.children.length})`
    });

    this.lastUl = ul;
    try {
      renderUiComponents(ul);
    } catch (e) {
      warn('setupObserversForUl: renderUiComponents でエラーが発生しました', e);
    }

    // liの追加削除監視
    this.liObserver?.disconnect();
    this.liObserver = new MutationObserver((liMutations) => {
      // 重複実行を防止するためのチェック
      if (this.relistTimeout) {
        debugMethodStart('liObserver.callback', {
          mutationsCount: liMutations.length,
          hasExistingTimeout: true
        });
        debugMethodStart('liObserver.clearExistingTimeout', {
          timeoutId: this.relistTimeout
        });
        clearTimeout(this.relistTimeout);
        debugMethodEnd('liObserver.clearExistingTimeout');
      } else {
        debugMethodStart('liObserver.callback', {
          mutationsCount: liMutations.length,
          addedNodes: liMutations.reduce((sum, m) => sum + m.addedNodes.length, 0),
          removedNodes: liMutations.reduce((sum, m) => sum + m.removedNodes.length, 0)
        });
      }

      debugMethodStart('liObserver.setNewTimeout');
      this.relistTimeout = window.setTimeout(() => {
        debugMethodStart('liObserver.renderTimeout', {
          ulChildCount: ul.children.length
        });
        try {
          renderUiComponents(ul);
        } catch (e) {
          warn('liObserver: renderUiComponents でエラーが発生しました', e);
        }
        debugMethodEnd('liObserver.renderTimeout');
      }, 500);
      debugMethodEnd('liObserver.setNewTimeout', {
        newTimeoutId: this.relistTimeout
      });

      debugMethodEnd('liObserver.callback');
    });

    debugMethodStart('ObserverManager.setupObserversForUl.observeLiChanges');
    this.liObserver.observe(ul, { childList: true, subtree: false });
    debugMethodEnd('ObserverManager.setupObserversForUl.observeLiChanges', {
      status: 'started',
      targetUl: `${ul.tagName}(子要素:${ul.children.length})`
    });

    debugMethodEnd('ObserverManager.setupObserversForUl');
  }

}

/**
 * ObserverManagerのシングルトンインスタンス
 * @type {ObserverManager}
 */
export const observerManager = new ObserverManager();
