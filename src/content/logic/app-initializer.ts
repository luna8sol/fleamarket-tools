import { debug, log, warn, setDebugMode, debugMethodStart, debugMethodEnd, setLogLevel, LogLevel } from '../infra/logger';
import { observerManager } from './observer-manager';
import { renderUiComponents } from '../ui/ui-manager';
import { detectCurrentPage } from '../infra/page-detector';
import { PageType, SELECTOR } from '../infra/constants';
import { safeQuery } from '../../common/dom';
import { loadUserSettings } from '../infra/user-settings';

/**
 * アプリケーション初期化とメインロジックの統合
 */
export class AppInitializer {
  /**
   * アプリケーションを初期化する
   */
  async initialize(): Promise<void> {
    const startTime = performance.now();
    debugMethodStart('AppInitializer.initialize');

    debug('アプリケーションを初期化しています');

    // ユーザー設定を読み込み、デバッグモードを設定
    await this.applyUserSettings();

    // DOM監視開始
    observerManager.startObserving();

    // ページタイプに応じた初期化
    const pageType = detectCurrentPage();

    // DOM読み込み完了時の初期化
    this.setupDomLoadedEvent();

    const duration = Math.round(performance.now() - startTime);
    debugMethodEnd('AppInitializer.initialize', { pageType }, duration);
  }

  /**
   * ユーザー設定を読み込み、適用する
   */
  private async applyUserSettings(): Promise<void> {
    const startTime = performance.now();
    debugMethodStart('AppInitializer.applyUserSettings');

    try {
      // chrome.storage.localから設定を読み込む（未保存の項目はDEFAULT_USER_SETTINGSで補完）
      const settings = await loadUserSettings();

      // デバッグモードを適用
      if (settings.debugMode) {
        // 明示的にログレベルをDEBUGに設定
        setLogLevel(LogLevel.DEBUG);
        setDebugMode(true);
        debug('デバッグモードが有効になっています - ログレベル: DEBUG');
      } else {
        // デバッグモードが無効の場合はLOGレベルに設定
        setLogLevel(LogLevel.LOG);
        log('通常モード - ログレベル: LOG');
      }

      const duration = Math.round(performance.now() - startTime);
      debugMethodEnd('AppInitializer.applyUserSettings', {
        settings,
        debugModeEnabled: settings.debugMode,
        logLevel: settings.debugMode ? 'DEBUG' : 'LOG'
      }, duration);

    } catch (e) {
      warn('設定の読み込み中にエラーが発生しました', e);
      debugMethodEnd('AppInitializer.applyUserSettings', { error: e instanceof Error ? e.message : String(e) });
    }
  }

  /**
   * DOM読み込み完了イベントのセットアップ
   */
  private setupDomLoadedEvent(): void {
    debugMethodStart('AppInitializer.setupDomLoadedEvent');

    window.addEventListener('DOMContentLoaded', () => {
      const startTime = performance.now();
      debugMethodStart('DOMContentLoaded handler');
      debug('DOMContentLoaded event fired');

      try {
        // ページタイプに応じてUIを初期化
        const pageType = detectCurrentPage();

        if (pageType === PageType.DRAFTS) {
          // 下書きページの処理
          const ul = safeQuery<HTMLUListElement>(SELECTOR.DRAFT_LIST);
          if (ul instanceof HTMLUListElement) {
            renderUiComponents(ul);
          }
        } else if (pageType === PageType.LISTINGS) {
          // 出品中ページの処理
          const ul = safeQuery<HTMLUListElement>(SELECTOR.ITEMS_LIST);
          if (ul instanceof HTMLUListElement) {
            renderUiComponents(ul);
          }
        }

        const duration = Math.round(performance.now() - startTime);
        debugMethodEnd('DOMContentLoaded handler', { pageType }, duration);
      } catch (e) {
        warn('初期化処理中にエラーが発生しました', e);
        debugMethodEnd('DOMContentLoaded handler', { error: e instanceof Error ? e.message : String(e) });
      }
    });

    debugMethodEnd('AppInitializer.setupDomLoadedEvent');
  }
}

// シングルトンインスタンス
export const appInitializer = new AppInitializer();
