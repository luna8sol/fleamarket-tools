import {
  ClickDeleteMessage,
  ClickRelistMessage,
  FailedItem,
  MessageType,
  QueueItem,
  QueueMode,
  QueueProgress,
  QueueProgressMessage,
  SourceItem,
} from '../common/messages';
import { sendToTab } from '../common/send-message';
import { isFormPageUrl } from '../common/form-page';
import { fetchSourceItem } from './source-item';
import { log, warn } from '../common/logger';

/** 次の商品を処理するまでの基本待機時間 (ms) */
const WAIT_BETWEEN_ITEMS_MS = 60000;
/** 待機時間に加算するランダム値の最大 (ms) */
const WAIT_RANDOM_MS = 15000;
/**
 * 1商品の処理を打ち切るまでの時間 (ms)。
 * NOTE: chrome.alarms は30秒未満の遅延がクランプされるため、十分に長い値にすること。
 */
const ITEM_WATCHDOG_MS = 300000;

/** 待機用アラーム名 */
const ALARM_NEXT_ITEM = 'rakuma-bulk-lister:next-item';
/** ウォッチドッグ用アラーム名 */
const ALARM_WATCHDOG = 'rakuma-bulk-lister:watchdog';

/** chrome.storage.session 上の保存キー */
const STORAGE_KEY = 'rakuma-bulk-lister:queue-state';

/**
 * 1商品の処理フェーズ
 * - waiting-tab:  relistで一覧タブのボタンをクリックし、出品フォームのタブが開くのを待っている
 * - loading-form: 出品フォームのタブを特定し、Content Scriptの自動クリックを待っている
 * - submitting:   「出品する」までクリック済み。フォームからの離脱（＝出品完了）を待っている
 * - deleting:     削除リンクをクリック済み。一覧の再読み込み（LIST_READY）を待っている
 */
type QueuePhase = 'idle' | 'waiting-tab' | 'loading-form' | 'submitting' | 'deleting';

/**
 * キューの全状態。chrome.storage.session に丸ごと保存する。
 */
interface QueueState {
  mode: QueueMode;
  items: QueueItem[];
  currentIndex: number;
  running: boolean;
  failed: FailedItem[];
  /** キューを開始した一覧ページのタブID */
  listTabId: number | null;
  /** 現在自動処理中の出品フォームのタブID */
  activeTabId: number | null;
  phase: QueuePhase;
  /** relistでボタンクリック後に開かれた、出品フォームになりうるタブのID */
  candidateTabIds: number[];
  /** relistで処理中の商品の、再出品元の内容（差分チェック用） */
  expectedSource: SourceItem | null;
  /** deleteで削除リンクをクリックする直前の一覧全体の件数 */
  countBeforeDelete: number | null;
  /**
   * deleteの対象が居る一覧のページ番号。
   *
   * 削除するたびに一覧は1ページ目へ戻るが、選択はページ送りのたびに
   * 破棄される（SelectionManager.retain）ので、対象は必ず同じ1ページに収まる。
   * さらに、ある商品を削除しても同じページの後続はそのページ内に留まる
   * （後ろのページから繰り上がってくるだけ）ため、このページへ戻れば必ず見つかる。
   */
  deletePage: number | null;
}

function createInitialState(): QueueState {
  return {
    mode: 'relist',
    items: [],
    currentIndex: 0,
    running: false,
    failed: [],
    listTabId: null,
    activeTabId: null,
    phase: 'idle',
    candidateTabIds: [],
    expectedSource: null,
    countBeforeDelete: null,
    deletePage: null,
  };
}

/**
 * 一括処理キューの管理クラス。
 * - 選択された商品を1件ずつ処理し、完了を検知して次へ進む。
 * - relist:  一覧タブへ「再出品ボタンをクリックせよ」と指示し、
 *            フリマアシストが開くタブが /item/new へ到達するのを待つ。
 * - publish: 下書きの編集URL (/drafts/{hash}/edit) を自分でタブとして開く。
 *
 * 出品完了の判定は Content Script ではなく Background 側で行う。
 * 出品成功後の遷移先が別オリジン (item.fril.jp) になりうるため、
 * Content Script では最後まで見届けられないことがあるため。
 *
 * MV3のService Workerは商品間の待機中に破棄されるため、状態は毎回
 * chrome.storage.session へ書き戻し、イベント処理の先頭で復元する。
 */
export class QueueManager {
  private state: QueueState = createInitialState();
  private loading: Promise<void> | null = null;

  /**
   * 永続化された状態を復元する。Service Worker起動ごとに一度だけ読み込む。
   * すべてのイベントハンドラはこれをawaitしてから状態に触れること。
   */
  ensureLoaded(): Promise<void> {
    if (!this.loading) {
      this.loading = chrome.storage.session
        .get(STORAGE_KEY)
        .then((stored) => {
          const saved = stored[STORAGE_KEY] as QueueState | undefined;
          if (saved) {
            this.state = saved;
            log(`キュー状態を復元: running=${saved.running}, phase=${saved.phase}`);
          }
        })
        .catch((e) => {
          warn('キュー状態の復元に失敗しました', e);
        });
    }
    return this.loading;
  }

  private async save(): Promise<void> {
    try {
      await chrome.storage.session.set({ [STORAGE_KEY]: this.state });
    } catch (e) {
      warn('キュー状態の保存に失敗しました', e);
    }
  }

  /**
   * キューを開始する
   */
  async start(
    mode: QueueMode,
    items: QueueItem[],
    listTabId: number,
    listPage?: number
  ): Promise<void> {
    if (this.state.running) {
      warn('キューは既に実行中です');
      return;
    }
    this.state = {
      ...createInitialState(),
      mode,
      items,
      listTabId,
      running: true,
      deletePage: listPage ?? null,
    };

    log(`キュー開始: mode=${mode}, ${items.length}件`);
    await this.save();
    await this.processCurrent();
  }

  /**
   * キューを停止する。処理中のタブはそのまま残す（手動確認できるように）。
   */
  async stop(): Promise<void> {
    if (!this.state.running) return;
    this.state.running = false;
    this.state.phase = 'idle';
    this.state.activeTabId = null;
    this.state.candidateTabIds = [];
    await this.clearTimers();
    log('キューを停止しました');
    await this.save();
    await this.notifyProgress();
  }

  /**
   * 現在の進捗を返す
   */
  getProgress(): QueueProgress {
    const { mode, items, currentIndex, running, failed } = this.state;
    return {
      mode,
      total: items.length,
      done: currentIndex,
      current: running ? (items[currentIndex] ?? null) : null,
      running,
      failed,
    };
  }

  /**
   * 指定タブが自動処理対象の出品フォームのタブかどうか
   */
  isAutoTab(tabId: number): boolean {
    return this.state.running && this.state.activeTabId === tabId;
  }

  /**
   * 自動処理中のタブに対して、再出品元の内容を返す。
   * Content Script はこれとフォームの内容を突き合わせてから保存する。
   */
  getExpectedSource(tabId: number): SourceItem | null {
    if (!this.isAutoTab(tabId)) return null;
    return this.state.expectedSource;
  }

  /**
   * 新規タブ作成の通知を受け取る。
   * relistモードでボタンクリック直後に開いたタブを候補として記録する。
   * 実際に処理対象として確定するのは、そのタブが /item/new へ到達した時点
   * （handleTabUpdated）。ユーザーが無関係なタブを開いた場合の誤捕捉を防ぐ。
   */
  async handleTabCreated(tab: chrome.tabs.Tab): Promise<void> {
    if (!this.state.running || this.state.phase !== 'waiting-tab') return;
    if (tab.id === undefined) return;

    // フリマアシストは一覧タブから商品ページを開き、そこから出品ページへ進む。
    // 出品ページのタブの opener は商品ページのタブになりうるため、一覧タブだけでなく
    // 既に候補になっているタブから開かれたものも候補に含める。
    const opener = tab.openerTabId;
    const fromKnownTab =
      opener === undefined ||
      opener === this.state.listTabId ||
      this.state.candidateTabIds.includes(opener);
    if (!fromKnownTab) return;

    this.state.candidateTabIds.push(tab.id);
    await this.save();
  }

  /**
   * タブのURL変化を受け取る。出品フォームへの到達と、そこからの離脱を検知する。
   */
  async handleTabUpdated(
    tabId: number,
    changeInfo: chrome.tabs.OnUpdatedInfo,
    tab: chrome.tabs.Tab
  ): Promise<void> {
    if (!this.state.running) return;

    const url = changeInfo.url ?? tab.url;
    if (!url) return;

    const isForm = isFormPageUrl(this.state.mode, url);

    // 出品フォームへ到達したタブを処理対象として確定する。
    //
    // ふつうは再出品ボタンで開かれた新規タブ（candidateTabIds）だが、
    // フリマアシストが既存のタブを使い回すこともある（失敗して残ったタブなど）。
    // その場合 tabs.onCreated が発生せず候補に入らないため、
    // 「いま遷移してきた」ことが分かる changeInfo.url があれば受け入れる。
    // 一覧タブ自身は対象にしない。
    if (this.state.phase === 'waiting-tab' && isForm && tabId !== this.state.listTabId) {
      const isCandidate = this.state.candidateTabIds.includes(tabId);
      const justNavigated = changeInfo.url !== undefined;
      if (isCandidate || justNavigated) {
        this.state.activeTabId = tabId;
        this.state.candidateTabIds = [];
        this.state.phase = 'loading-form';
        log(`出品フォームのタブを捕捉: tabId=${tabId}, 新規タブ=${isCandidate}`);
        await this.save();
        return;
      }
    }

    if (tabId !== this.state.activeTabId) return;

    // 「出品する」クリック後にフォームから離れた = 出品完了
    if (this.state.phase === 'submitting' && !isForm) {
      await this.completeCurrent();
    }
  }

  /**
   * 処理中のタブが（ユーザー操作等で）閉じられた場合のハンドリング
   */
  async handleTabRemoved(tabId: number): Promise<void> {
    if (!this.state.running) return;

    // relist・deleteは一覧タブのボタンに依存しているため、閉じられたら続行できない
    if (this.state.listTabId === tabId) {
      this.state.listTabId = null;
      if (this.state.mode === 'relist' || this.state.mode === 'delete') {
        warn('一覧タブが閉じられたためキューを停止します');
        await this.stop();
        return;
      }
    }

    if (this.state.activeTabId !== tabId) {
      if (this.state.candidateTabIds.includes(tabId)) {
        this.state.candidateTabIds = this.state.candidateTabIds.filter((id) => id !== tabId);
        await this.save();
      }
      return;
    }

    warn(`処理中のタブが閉じられました: tabId=${tabId}`);
    await this.failCurrent('処理中のタブが閉じられました');
  }

  /**
   * 出品フォームから「出品する」をクリックした通知を受け取る。
   * 完了判定はこの後のURL遷移（handleTabUpdated）で行う。
   */
  async handleFormSubmitted(tabId: number): Promise<void> {
    if (!this.isAutoTab(tabId)) return;
    this.state.phase = 'submitting';
    log('「出品する」クリック済み。完了（画面遷移）を待機します');
    await this.save();
  }

  /**
   * 出品フォームから失敗の通知を受け取る。
   * タブは閉じずに残し、ユーザーが状況を確認できるようにする。
   */
  async handleFormFailed(tabId: number, reason: string): Promise<void> {
    if (!this.isAutoTab(tabId)) return;
    await this.failCurrent(reason);
  }

  /**
   * アラーム発火時に呼ばれる
   */
  async handleAlarm(alarmName: string): Promise<void> {
    if (!this.state.running) return;

    if (alarmName === ALARM_NEXT_ITEM) {
      await this.processCurrent();
      return;
    }

    if (alarmName === ALARM_WATCHDOG) {
      if (this.state.phase === 'idle') return;
      warn(`商品の処理が${Math.round(ITEM_WATCHDOG_MS / 1000)}秒以内に完了しませんでした`);
      await this.failCurrent(this.describePhaseTimeout());
    }
  }

  /**
   * どの段階で止まったかを含むタイムアウト理由を返す。
   * 失敗理由は一括操作バーのホバーで確認できるため、原因の切り分けに使う。
   */
  private describePhaseTimeout(): string {
    const base = '処理がタイムアウトしました';
    switch (this.state.phase) {
      case 'waiting-tab':
        return `${base}（出品フォームのタブを検出できませんでした）`;
      case 'loading-form':
        return `${base}（出品フォームの自動操作が始まりませんでした）`;
      case 'submitting':
        return `${base}（出品後の画面遷移を確認できませんでした）`;
      case 'deleting':
        return `${base}（削除後の一覧の再読み込みを確認できませんでした）`;
      default:
        return base;
    }
  }

  /**
   * 現在の商品（currentIndex）の処理を開始する
   */
  private async processCurrent(): Promise<void> {
    if (!this.state.running) return;

    if (this.state.currentIndex >= this.state.items.length) {
      await this.finish();
      return;
    }

    const item = this.state.items[this.state.currentIndex];
    this.state.activeTabId = null;
    this.state.candidateTabIds = [];
    this.state.expectedSource = null;
    this.state.countBeforeDelete = null;
    log(`処理開始 (${this.state.currentIndex + 1}/${this.state.items.length}): ${item.title}`);

    // モードごとの分岐は switch で網羅する。QueueMode にモードを追加したとき、
    // default の never 代入がコンパイルエラーになって取りこぼしに気付ける。
    const mode = this.state.mode;
    switch (mode) {
      case 'delete':
        await this.startDelete(item);
        return;

      case 'publish': {
        // 下書きの編集ページを直接開く
        this.state.phase = 'loading-form';
        await this.startWatchdog();
        await this.save();
        await this.notifyProgress();

        try {
          const tab = await chrome.tabs.create({
            url: `https://fril.jp/drafts/${item.id}/edit`,
            active: false,
          });
          if (tab.id === undefined) {
            await this.failCurrent('編集ページのタブを開けませんでした');
            return;
          }
          this.state.activeTabId = tab.id;
          await this.save();
        } catch (e) {
          warn('編集ページのタブ作成に失敗しました', e);
          await this.failCurrent('編集ページのタブを開けませんでした');
        }
        return;
      }

      case 'relist': {
        // 一覧タブへ再出品ボタンのクリックを指示し、新規タブを待つ
        if (this.state.listTabId === null) {
          await this.failCurrent('一覧タブが見つかりません');
          return;
        }

        // フォームの内容を突き合わせるため、再出品元の内容を先に取得しておく。
        // 取得できなくても処理は続ける（差分チェックが省略されるだけ）。
        this.state.expectedSource = await fetchSourceItem(item.id);
        if (this.state.expectedSource === null) {
          warn(`再出品元の内容を取得できませんでした: ${item.title}`);
        }

        this.state.phase = 'waiting-tab';
        await this.startWatchdog();
        await this.save();
        await this.notifyProgress();

        const message: ClickRelistMessage = { type: MessageType.CLICK_RELIST, item };
        try {
          const response = await sendToTab(this.state.listTabId, message);
          // クリックできていなければタブは開かない。ウォッチドッグで
          // 「タブを検出できませんでした」と出るのを待たず、ここで失敗にする。
          if (!response?.clicked) {
            await this.failCurrent(
              '再出品ボタンが見つかりません（一覧が更新された可能性があります）'
            );
          }
        } catch (e) {
          warn('一覧タブへのメッセージ送信に失敗しました', e);
          await this.failCurrent('一覧タブとの通信に失敗しました');
        }
        return;
      }

      default: {
        // 型の上では到達しない。到達したらモードの追加漏れなので、
        // 既存モードの処理へ流し込まず、記録だけして止まる。
        const _exhaustive: never = mode;
        warn(`未対応のキューモードです: ${String(_exhaustive)}`);
        return;
      }
    }
  }

  /**
   * delete: 一覧タブへ削除リンクのクリックを指示する。
   *
   * 削除リンクは data-remote を持たないためクリックでページ遷移が起きる。
   * 完了は、再読み込み後の一覧にその商品が残っていないか（handleListReady）で判定する。
   */
  private async startDelete(item: QueueItem): Promise<void> {
    if (this.state.listTabId === null) {
      await this.failCurrent('一覧タブが見つかりません');
      return;
    }

    this.state.phase = 'deleting';
    this.state.countBeforeDelete = null;
    await this.startWatchdog();
    await this.save();
    await this.notifyProgress();

    const message: ClickDeleteMessage = {
      type: MessageType.CLICK_DELETE,
      item,
      page: this.state.deletePage,
    };
    try {
      const response = await sendToTab(this.state.listTabId, message);
      if (!response?.clicked) {
        await this.failCurrent('削除リンクが見つかりません（どのページにもありませんでした）');
        return;
      }
      this.state.countBeforeDelete = response.totalCount ?? null;
      await this.save();
    } catch (e) {
      warn('一覧タブへのメッセージ送信に失敗しました', e);
      await this.failCurrent('一覧タブとの通信に失敗しました');
    }
  }

  /**
   * 一覧の描画完了通知を受け取る。
   *
   * deleteモードでは、削除リンクをクリックするとページが遷移して一覧が
   * 再読み込みされ、**1ページ目に戻る**。そのため「表示中の一覧に残っていないこと」は
   * 削除の証拠にならない（別ページにいるだけかもしれない）。
   *
   * 件数が読めるページ（/sell）では件数の減少で判定する。
   * 読めないページ（/draft はページャが無く全件表示）では、
   * 対象IDが残っていないことで判定する。
   */
  async handleListReady(tabId: number, ids: string[], totalCount: number | null): Promise<void> {
    if (!this.state.running) return;
    if (this.state.mode !== 'delete' || this.state.phase !== 'deleting') return;
    if (tabId !== this.state.listTabId) return;

    const item = this.state.items[this.state.currentIndex];
    if (!item) return;

    const before = this.state.countBeforeDelete;
    if (before !== null && totalCount !== null) {
      if (totalCount < before) {
        await this.completeCurrent();
      } else {
        await this.failCurrent(`削除されませんでした（件数が${before}件のままです）`);
      }
      return;
    }

    if (ids.includes(item.id)) {
      await this.failCurrent('削除されませんでした（一覧に残っています）');
      return;
    }
    await this.completeCurrent();
  }

  /**
   * 現在の商品を成功として確定し、次へ進む
   */
  private async completeCurrent(): Promise<void> {
    const item = this.state.items[this.state.currentIndex];
    const action = this.state.mode === 'delete' ? '削除完了' : '出品完了';
    log(`${action}: ${item?.title ?? ''}`);

    const tabId = this.state.activeTabId;
    this.state.activeTabId = null;
    this.state.phase = 'idle';
    this.state.currentIndex++;

    if (tabId !== null) {
      // handleTabRemovedが失敗扱いしないよう、activeTabIdを外してから閉じる
      await chrome.tabs.remove(tabId).catch(() => {
        // 既に閉じられている場合は何もしない
      });
    }
    await this.scheduleNext();
  }

  /**
   * 現在の商品を失敗として記録し、次へ進む。
   * 処理中のタブは開いたまま残す（ユーザーが状況を確認できるように）。
   */
  private async failCurrent(reason: string): Promise<void> {
    const item = this.state.items[this.state.currentIndex];
    if (item) {
      warn(`出品失敗: ${item.title} (${reason})`);
      this.state.failed.push({ item, reason });
    }
    this.state.currentIndex++;
    this.state.activeTabId = null;
    this.state.candidateTabIds = [];
    this.state.phase = 'idle';
    await this.scheduleNext();
  }

  /**
   * 待機時間（基本+ランダム）を挟んで次の商品の処理を予約する
   */
  private async scheduleNext(): Promise<void> {
    await chrome.alarms.clear(ALARM_WATCHDOG);

    if (!this.state.running) {
      await this.save();
      return;
    }

    if (this.state.currentIndex >= this.state.items.length) {
      await this.finish();
      return;
    }

    // deleteは一覧ページ内で完結し、ページ遷移そのものが間隔になる。
    // クリック前の待機はContent Script側で入れるため、ここでは待たない
    // （chrome.alarms は短い遅延を指定できないため）。
    if (this.state.mode === 'delete') {
      await this.save();
      await this.notifyProgress();
      await this.processCurrent();
      return;
    }

    const waitMs = WAIT_BETWEEN_ITEMS_MS + Math.floor(Math.random() * WAIT_RANDOM_MS);
    log(`${Math.round(waitMs / 1000)}秒待機して次の商品へ`);
    await chrome.alarms.create(ALARM_NEXT_ITEM, { when: Date.now() + waitMs });
    await this.save();
    await this.notifyProgress();
  }

  /**
   * キューを完了状態にする
   */
  private async finish(): Promise<void> {
    this.state.running = false;
    this.state.phase = 'idle';
    this.state.activeTabId = null;
    this.state.candidateTabIds = [];
    await this.clearTimers();
    log(
      `キュー完了: 成功=${this.state.items.length - this.state.failed.length}件, ` +
        `失敗=${this.state.failed.length}件`
    );
    await this.save();
    await this.notifyProgress();
  }

  private async startWatchdog(): Promise<void> {
    await chrome.alarms.create(ALARM_WATCHDOG, { when: Date.now() + ITEM_WATCHDOG_MS });
  }

  private async clearTimers(): Promise<void> {
    await chrome.alarms.clear(ALARM_NEXT_ITEM);
    await chrome.alarms.clear(ALARM_WATCHDOG);
  }

  /**
   * 一覧タブへ進捗を通知する
   */
  private async notifyProgress(): Promise<void> {
    if (this.state.listTabId === null) return;
    const message: QueueProgressMessage = {
      type: MessageType.QUEUE_PROGRESS,
      progress: this.getProgress(),
    };
    await sendToTab(this.state.listTabId, message).catch(() => {
      // 一覧タブが閉じられている場合は通知できないが、処理は継続する
    });
  }
}

/**
 * QueueManagerのシングルトンインスタンス
 */
export const queueManager = new QueueManager();
