import {
  MessageType,
  QueueItem,
  QueueMode,
  QueueProgress,
  ClickRelistMessage,
  QueueProgressMessage,
} from '../common/messages';
import { log, warn } from '../common/logger';

/** 次の商品を処理するまでの基本待機時間 (ms) */
const WAIT_BETWEEN_ITEMS_MS = 60000;
/** 待機時間に加算するランダム値の最大 (ms) */
const WAIT_RANDOM_MS = 15000;
/** 待機用アラーム名 */
const ALARM_NEXT_ITEM = 'rakuma-bulk-lister:next-item';

/**
 * 一括処理キューの管理クラス。
 * - 選択された商品を1件ずつ処理し、完了通知を受けて次へ進む。
 * - relist: 一覧タブへ「再出品ボタンをクリックせよ」と指示し、
 *   フリマアシストが開く編集タブを tabs.onCreated で捕捉する。
 * - publish: 下書きの編集URLを自分でタブとして開く。
 *
 * NOTE: 状態はService Workerのメモリ上にのみ保持する。
 *       SWが破棄されるとキューは失われる（待機はalarmsで行うため
 *       通常の処理継続では破棄されない想定だが、既知の制約として記録）。
 */
export class QueueManager {
  private mode: QueueMode = 'relist';
  private items: QueueItem[] = [];
  private currentIndex = 0;
  private running = false;
  private failed: QueueItem[] = [];

  /** キューを開始した一覧ページのタブID */
  private listTabId: number | null = null;
  /** 現在自動処理中の編集タブID */
  private activeEditTabId: number | null = null;
  /** relistボタンクリック後、新規タブが開くのを待っている状態か */
  private waitingForNewTab = false;

  /**
   * キューを開始する
   */
  start(mode: QueueMode, items: QueueItem[], listTabId: number): void {
    if (this.running) {
      warn('キューは既に実行中です');
      return;
    }
    this.mode = mode;
    this.items = items;
    this.currentIndex = 0;
    this.failed = [];
    this.listTabId = listTabId;
    this.activeEditTabId = null;
    this.waitingForNewTab = false;
    this.running = true;

    log(`キュー開始: mode=${mode}, ${items.length}件`);
    void this.processCurrent();
  }

  /**
   * キューを停止する。処理中の編集タブはそのまま残す（手動確認できるように）。
   */
  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.waitingForNewTab = false;
    this.activeEditTabId = null;
    void chrome.alarms.clear(ALARM_NEXT_ITEM);
    log('キューを停止しました');
    this.notifyProgress();
  }

  /**
   * 現在の進捗を返す
   */
  getProgress(): QueueProgress {
    return {
      mode: this.mode,
      total: this.items.length,
      done: this.currentIndex,
      current: this.running ? (this.items[this.currentIndex] ?? null) : null,
      running: this.running,
      failed: this.failed,
    };
  }

  /**
   * 指定タブが自動処理対象の編集タブかどうか
   */
  isAutoTab(tabId: number): boolean {
    return this.running && this.activeEditTabId === tabId;
  }

  /**
   * 新規タブ作成の通知を受け取る。
   * relistモードでボタンクリック直後に開いたタブを編集タブとして捕捉する。
   */
  handleTabCreated(tab: chrome.tabs.Tab): void {
    if (!this.running || !this.waitingForNewTab) return;
    if (tab.id === undefined) return;

    this.waitingForNewTab = false;
    this.activeEditTabId = tab.id;
    log(`編集タブを捕捉: tabId=${tab.id}`);
  }

  /**
   * 編集タブが（ユーザー操作等で）閉じられた場合のハンドリング
   */
  handleTabRemoved(tabId: number): void {
    if (!this.running || this.activeEditTabId !== tabId) return;
    warn(`処理中の編集タブが閉じられました: tabId=${tabId}`);
    this.markCurrentFailed('編集タブが閉じられました');
    this.scheduleNext();
  }

  /**
   * 編集タブから出品完了の通知を受け取る
   */
  handleEditCompleted(tabId: number): void {
    if (!this.isAutoTab(tabId)) return;

    const item = this.items[this.currentIndex];
    log(`出品完了: ${item?.title ?? tabId}`);

    void chrome.tabs.remove(tabId);
    this.activeEditTabId = null;
    this.currentIndex++;
    this.scheduleNext();
  }

  /**
   * 編集タブから失敗の通知を受け取る。
   * タブは閉じずに残し、ユーザーが状況を確認できるようにする。
   */
  handleEditFailed(tabId: number, reason: string): void {
    if (!this.isAutoTab(tabId)) return;

    this.markCurrentFailed(reason);
    this.activeEditTabId = null;
    this.scheduleNext();
  }

  /**
   * アラーム発火時に呼ばれ、次の商品の処理を開始する
   */
  handleAlarm(alarmName: string): void {
    if (alarmName !== ALARM_NEXT_ITEM) return;
    if (!this.running) return;
    void this.processCurrent();
  }

  /**
   * 現在の商品（currentIndex）の処理を開始する
   */
  private async processCurrent(): Promise<void> {
    if (!this.running) return;

    if (this.currentIndex >= this.items.length) {
      this.running = false;
      log(`キュー完了: 成功=${this.items.length - this.failed.length}件, 失敗=${this.failed.length}件`);
      this.notifyProgress();
      return;
    }

    const item = this.items[this.currentIndex];
    this.notifyProgress();
    log(`処理開始 (${this.currentIndex + 1}/${this.items.length}): ${item.title}`);

    if (this.mode === 'publish') {
      // 下書きの編集ページを直接開く
      const tab = await chrome.tabs.create({
        url: `https://fril.jp/drafts/${item.id}/edit`,
        active: false,
      });
      if (tab.id !== undefined) {
        this.activeEditTabId = tab.id;
      }
    } else {
      // 一覧タブへ再出品ボタンのクリックを指示し、新規タブを待つ
      if (this.listTabId === null) {
        this.markCurrentFailed('一覧タブが見つかりません');
        this.scheduleNext();
        return;
      }
      this.waitingForNewTab = true;
      const message: ClickRelistMessage = { type: MessageType.CLICK_RELIST, item };
      try {
        await chrome.tabs.sendMessage(this.listTabId, message);
      } catch (e) {
        warn('一覧タブへのメッセージ送信に失敗しました', e);
        this.waitingForNewTab = false;
        this.markCurrentFailed('一覧タブとの通信に失敗しました');
        this.scheduleNext();
      }
    }
  }

  /**
   * 待機時間（基本+ランダム）を挟んで次の商品の処理を予約する
   */
  private scheduleNext(): void {
    if (!this.running) return;

    if (this.currentIndex >= this.items.length) {
      void this.processCurrent();
      return;
    }

    const waitMs = WAIT_BETWEEN_ITEMS_MS + Math.floor(Math.random() * WAIT_RANDOM_MS);
    log(`${Math.round(waitMs / 1000)}秒待機して次の商品へ`);
    this.notifyProgress();
    void chrome.alarms.create(ALARM_NEXT_ITEM, { when: Date.now() + waitMs });
  }

  /**
   * 現在の商品を失敗として記録し、インデックスを進める
   */
  private markCurrentFailed(reason: string): void {
    const item = this.items[this.currentIndex];
    if (item) {
      warn(`出品失敗: ${item.title} (${reason})`);
      this.failed.push(item);
    }
    this.currentIndex++;
  }

  /**
   * 一覧タブへ進捗を通知する
   */
  private notifyProgress(): void {
    if (this.listTabId === null) return;
    const message: QueueProgressMessage = {
      type: MessageType.QUEUE_PROGRESS,
      progress: this.getProgress(),
    };
    chrome.tabs.sendMessage(this.listTabId, message).catch(() => {
      // 一覧タブが閉じられている場合は通知できないが、処理は継続する
    });
  }
}

/**
 * QueueManagerのシングルトンインスタンス
 */
export const queueManager = new QueueManager();
