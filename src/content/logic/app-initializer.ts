import { debug, log, warn, setDebugMode, debugMethodStart, debugMethodEnd, setLogLevel, LogLevel } from '../infra/logger';
import { observerManager } from './observer-manager';
import { detectCurrentPage } from '../infra/page-detector';
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

    // NOTE: ここで DOMContentLoaded を待ってはいけない。
    // manifest.json の content_scripts は "run_at": "document_idle" のため、
    // 注入時点で document.readyState は既に 'interactive' / 'complete' であり、
    // DOMContentLoaded は二度と発火しない。初期描画は上の
    // observerManager.startObserving() が担う（要素の遅延読み込みにも追従する）。

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
}

// シングルトンインスタンス
export const appInitializer = new AppInitializer();
