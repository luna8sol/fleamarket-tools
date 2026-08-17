import {
  ClickDeleteMessage,
  ClickRelistMessage,
  FailedItem,
  MessageType,
  QueueItem,
  QueueMode,
  QueueProgress,
  QueueProgressMessage,
  ReplaceCounts,
  ReplaceOutcome,
  ReplaceRecord,
  SourceItem,
  StartQueueResponse,
} from '../common/messages';
import { sendToTab } from '../common/send-message';
import { isFormPageUrl, itemEditUrl } from '../common/form-page';
import { QUEUE_MODE_TRAITS } from '../common/queue-mode-traits';
import { fetchSourceItem } from './source-item';
import { log, warn } from '../common/logger';
import {
  fingerprint,
  normalizeLineBreaks,
  sameFingerprint,
  TextFingerprint,
} from '../common/text-fingerprint';
import { saveReplaceRecord } from '../common/replace-store';

/** 次の商品を処理するまでの基本待機時間 (ms) */
const WAIT_BETWEEN_ITEMS_MS = 60000;
/** 待機時間に加算するランダム値の最大 (ms) */
const WAIT_RANDOM_MS = 15000;
/**
 * replace で商品間に挟む待機の基準時間の既定値 (ms)。画面から変えられる。
 * 下限は chrome.alarms が扱える 30 秒（それ未満はクランプされて意味を持たない）。
 */
export const REPLACE_WAIT_BASE_MS = 60000;
export const REPLACE_WAIT_MIN_MS = 30000;
/** replace で保存後の本文を商品ページから読み直す回数と間隔（反映の遅れを吸収する） */
const REPLACE_VERIFY_ATTEMPTS = 3;
const REPLACE_VERIFY_DELAY_MS = 3000;
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
 *
 * フィールドは寿命で3種類に分かれる。**新しいフィールドを足すときは
 * まずどれに当たるかを決め、対応するリセット箇所へ加えること。**
 *
 * 1. キュー全体で不変: start() で設定し、以降は変えない
 *    （mode / items / listTabId / deletePage / waitBaseMs）
 * 2. キューの進行: 商品をまたいで積み上がる
 *    （currentIndex / running / failed / replaceCounts / haltedReason）
 * 3. 商品ごと: resetItemState() でまとめてリセットする
 *    （activeTabId / phase / candidateTabIds / expectedSource / countBeforeDelete / replaceCurrent）
 *
 * モード固有かどうかは寿命とは別の軸で、リセットの要否には関係しない。
 * 使われないモードでは初期値のまま残る（例: relistなら countBeforeDelete は null）。
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
   *
   * delete固有だが寿命は「キュー全体で不変」。開始時の一覧のページ番号を
   * 全件を通して使い回すため、商品ごとのリセット対象には**含めない**。
   */
  deletePage: number | null;
  /** replace の商品間の待機の基準時間 (ms)。他のモードでは null（キュー全体で不変） */
  waitBaseMs: number | null;
  /** replace の結果種別ごとの件数。他のモードでは null（キューの進行で積み上がる） */
  replaceCounts: ReplaceCounts | null;
  /** replace で処理中の商品について、開いた時点の説明欄の文字数・ハッシュ（記録用。商品ごと） */
  replaceCurrent: TextFingerprint | null;
  /** replace で残りを開かずに止めた理由 */
  haltedReason: string | null;
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
    waitBaseMs: null,
    replaceCounts: null,
    replaceCurrent: null,
    haltedReason: null,
  };
}

function emptyReplaceCounts(): ReplaceCounts {
  return { applied: 0, already: 0, skipped: 0, failed: 0, unverified: 0 };
}

/** 一括操作バーの失敗一覧に載せるときの結果種別の呼び名 */
const REPLACE_OUTCOME_LABEL: Record<ReplaceOutcome, string> = {
  applied: '成功',
  already: '適用済み',
  skipped: 'スキップ',
  failed: '失敗',
  unverified: '未確認',
};

/**
 * 短い待機。Service Worker 内の 1 つのイベント処理の中でだけ使う
 * （保存後の再照合のリトライ間隔）。商品間の待機には使わない（chrome.alarms を使う）。
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 一括処理キューの管理クラス。
 * - 選択された商品を1件ずつ処理し、完了を検知して次へ進む。
 * - relist:  一覧タブへ「再出品ボタンをクリックせよ」と指示し、
 *            フリマアシストが開くタブが /item/new へ到達するのを待つ。
 * - publish: 下書きの編集URL (/drafts/{hash}/edit) を自分でタブとして開く。
 * - replace: 出品中商品の編集URL (/item/{hash}/edit) を自分でタブとして開き、
 *            保存後に商品ページの本文を再照合して結果を記録する。
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
   * キューを開始する。
   *
   * 既に実行中のときは開始しない（別タブの処理を上書きしない）。
   * 黙って戻ると依頼した一覧側に伝わらないため、受け付けなかった理由を返す。
   */
  async start(
    mode: QueueMode,
    items: QueueItem[],
    listTabId: number,
    listPage?: number,
    waitBaseMs?: number
  ): Promise<StartQueueResponse> {
    if (this.state.running) {
      warn('キューは既に実行中です');
      return {
        started: false,
        reason: '他のタブで処理が実行中のため開始できません',
      };
    }
    if (mode === 'replace' && items.some((item) => !item.replace)) {
      warn('replace の商品に本文が付いていないため開始しません');
      return {
        started: false,
        reason: '置換する本文が付いていない商品があるため開始できません',
      };
    }
    this.state = {
      ...createInitialState(),
      mode,
      items,
      listTabId,
      running: true,
      deletePage: listPage ?? null,
      waitBaseMs:
        mode === 'replace'
          ? Math.max(REPLACE_WAIT_MIN_MS, Math.round(waitBaseMs ?? REPLACE_WAIT_BASE_MS))
          : null,
      replaceCounts: mode === 'replace' ? emptyReplaceCounts() : null,
    };

    log(`キュー開始: mode=${mode}, ${items.length}件`);
    await this.save();
    await this.processCurrent();
    return { started: true };
  }

  /**
   * キューを停止する。処理中のタブはそのまま残す（手動確認できるように）。
   */
  async stop(): Promise<void> {
    if (!this.state.running) return;
    this.state.running = false;
    this.resetItemState();
    await this.clearTimers();
    log('キューを停止しました');
    await this.save();
    await this.notifyProgress();
  }

  /**
   * 現在の進捗を返す
   */
  getProgress(): QueueProgress {
    const { mode, items, currentIndex, running, failed, replaceCounts, haltedReason } = this.state;
    const current = running ? (items[currentIndex] ?? null) : null;
    return {
      mode,
      total: items.length,
      done: currentIndex,
      // 本文は進捗表示に不要で、一覧タブへ毎回送るには大きすぎる
      current: current ? { id: current.id, title: current.title } : null,
      running,
      failed,
      replaceCounts: replaceCounts ?? undefined,
      haltedReason,
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
   * replace で自動処理中のタブに対して、処理中の商品（商品名・原本・確定版）を返す。
   * Content Script はこれと編集ページの内容を照合してから書き換える。
   */
  getReplaceItem(tabId: number): QueueItem | null {
    if (!this.isAutoTab(tabId) || this.state.mode !== 'replace') return null;
    return this.state.items[this.state.currentIndex] ?? null;
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
   *
   * chrome.tabs.onUpdated からの入口はこの1つに保ちつつ、phase ごとに
   * 専用メソッドへ委譲する（到達と離脱は発生するタイミングも意味も異なるため）。
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

    if (this.state.phase === 'waiting-tab') {
      await this.handleFormArrival(tabId, changeInfo, isForm);
      return;
    }

    if (this.state.phase === 'submitting') {
      await this.handleFormDeparture(tabId, isForm);
    }
  }

  /**
   * 出品フォームへ到達したタブを処理対象として確定する。
   *
   * ふつうは再出品ボタンで開かれた新規タブ（candidateTabIds）だが、
   * フリマアシストが既存のタブを使い回すこともある（失敗して残ったタブなど）。
   * その場合 tabs.onCreated が発生せず候補に入らないため、
   * 「いま遷移してきた」ことが分かる changeInfo.url があれば受け入れる。
   * 一覧タブ自身は対象にしない。
   */
  private async handleFormArrival(
    tabId: number,
    changeInfo: chrome.tabs.OnUpdatedInfo,
    isForm: boolean
  ): Promise<void> {
    if (!isForm || tabId === this.state.listTabId) return;

    const isCandidate = this.state.candidateTabIds.includes(tabId);
    const justNavigated = changeInfo.url !== undefined;
    if (!isCandidate && !justNavigated) return;

    this.state.activeTabId = tabId;
    this.state.candidateTabIds = [];
    this.state.phase = 'loading-form';
    log(`出品フォームのタブを捕捉: tabId=${tabId}, 新規タブ=${isCandidate}`);
    await this.save();
  }

  /**
   * 「出品する」クリック後に出品フォームのURLから離れたこと＝出品完了とみなす。
   * 遷移先が別オリジン（item.fril.jp）になりうるため Content Script では
   * 見届けられない。この判定は Background 側に置いたままにすること。
   */
  private async handleFormDeparture(tabId: number, isForm: boolean): Promise<void> {
    if (tabId !== this.state.activeTabId) return;
    if (isForm) return;

    await this.completeCurrent();
  }

  /**
   * 処理中のタブが（ユーザー操作等で）閉じられた場合のハンドリング
   */
  async handleTabRemoved(tabId: number): Promise<void> {
    if (!this.state.running) return;

    // 一覧タブのクリックに依存するモード（relist・delete）は、閉じられたら続行できない
    if (this.state.listTabId === tabId) {
      this.state.listTabId = null;
      if (QUEUE_MODE_TRAITS[this.state.mode].requiresListTab) {
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
   * 出品フォームから「出品する」「更新する」をクリックした通知を受け取る。
   * 完了判定はこの後のURL遷移（handleTabUpdated）で行う。
   */
  async handleFormSubmitted(tabId: number, current?: TextFingerprint | null): Promise<void> {
    if (!this.isAutoTab(tabId)) return;
    this.state.phase = 'submitting';
    this.state.replaceCurrent = current ?? null;
    log('保存ボタンをクリック済み。完了（画面遷移）を待機します');
    await this.save();
  }

  /**
   * 出品フォームから失敗の通知を受け取る。
   * タブは閉じずに残し、ユーザーが状況を確認できるようにする。
   *
   * replace では結果種別（スキップ / 失敗）を記録し、fatal なら残りを開かずに止める。
   */
  async handleFormFailed(
    tabId: number,
    reason: string,
    options: {
      outcome?: 'skipped' | 'failed';
      fatal?: boolean;
      current?: TextFingerprint | null;
    } = {}
  ): Promise<void> {
    if (!this.isAutoTab(tabId)) return;
    this.state.replaceCurrent = options.current ?? null;
    await this.failCurrent(reason, options.outcome ?? 'failed');
    if (options.fatal && this.state.mode === 'replace') {
      await this.halt(reason);
    }
  }

  /**
   * replace で、開いた時点の説明欄がすでに確定版だった通知を受け取る。
   * 保存はしていないので、記録して次へ進む。
   */
  async handleFormAlreadyApplied(tabId: number, current: TextFingerprint): Promise<void> {
    if (!this.isAutoTab(tabId) || this.state.mode !== 'replace') return;
    this.state.replaceCurrent = current;
    await this.recordReplace('already', false);
    await this.completeCurrent();
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
        return `${base}（保存後の画面遷移を確認できませんでした）`;
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

    // 直前の商品が成功・失敗・ウォッチドッグ打ち切りのどれで終わったかに
    // よらず、同じ状態から始める。phase はこの直後のモード分岐でそれぞれ
    // 設定する（deleteは startDelete 内）。
    this.resetItemState();
    log(`処理開始 (${this.state.currentIndex + 1}/${this.state.items.length}): ${item.title}`);

    // モードごとの分岐は switch で網羅する。QueueMode にモードを追加したとき、
    // default の never 代入がコンパイルエラーになって取りこぼしに気付ける。
    const mode = this.state.mode;
    switch (mode) {
      case 'delete':
        await this.startDelete(item);
        return;

      case 'publish':
        // 下書きの編集ページを直接開く
        await this.openFormTab(`https://fril.jp/drafts/${item.id}/edit`);
        return;

      case 'replace':
        // 出品中商品の編集ページを直接開く。書き換えと照合は Content Script が行う
        await this.openFormTab(itemEditUrl(item.id));
        return;

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
   * publish / replace: 編集ページを自分でタブとして開き、Content Script の自動操作を待つ。
   */
  private async openFormTab(url: string): Promise<void> {
    this.state.phase = 'loading-form';
    await this.startWatchdog();
    await this.save();
    await this.notifyProgress();

    try {
      const tab = await chrome.tabs.create({ url, active: false });
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

    // countBeforeDelete は直前の processCurrent() の resetItemState() で
    // null になっている。実際の件数はクリックの応答（totalCount）で入る。
    this.state.phase = 'deleting';
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
      this.state.countBeforeDelete = response.totalCount;
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
    if (!QUEUE_MODE_TRAITS[this.state.mode].completesOnListReady) return;
    if (this.state.phase !== 'deleting') return;
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

    // replace: 保存ボタンを押して編集ページから離れた。保存後の本文を商品ページで再照合し、
    // 一致して初めて成功にする。確認できなければ「未確認」（保存自体は済んでいる可能性がある）
    if (this.state.mode === 'replace' && this.state.phase === 'submitting' && item) {
      await this.verifyReplaced(item);
    }

    const action = QUEUE_MODE_TRAITS[this.state.mode].actionLabel;
    log(`${action}完了: ${item?.title ?? ''}`);

    // このあとタブを閉じるのに使うので、リセットする前に控えておく。
    const tabId = this.state.activeTabId;

    // 次の processCurrent() までには最大75秒の待機が挟まる。その間に届く
    // タブのイベントが、終わった商品の状態を掴んだまま動かないようにする。
    // - phase='idle': handleTabCreated / handleTabUpdated が待機中に開いた
    //   タブを候補にも処理対象にもしない（どちらも 'waiting-tab' で判定）
    // - activeTabId=null: isAutoTab() が false になる。直後にタブを閉じるので、
    //   これが残っていると handleTabRemoved が失敗として記録してしまう
    this.resetItemState();
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
  private async failCurrent(
    reason: string,
    replaceOutcome: 'skipped' | 'failed' = 'failed'
  ): Promise<void> {
    const item = this.state.items[this.state.currentIndex];
    if (item) {
      if (this.state.mode === 'replace') {
        // 保存ボタンを押したあと（submitting）の失敗は、保存された可能性がある
        const saved = this.state.phase === 'submitting';
        await this.recordReplace(saved ? 'unverified' : replaceOutcome, saved, reason);
      } else {
        const action = QUEUE_MODE_TRAITS[this.state.mode].actionLabel;
        warn(`${action}失敗: ${item.title} (${reason})`);
        this.state.failed.push({ item, reason });
      }
    }
    this.state.currentIndex++;
    // completeCurrent() と同じく、次の processCurrent() までの待機中に
    // 終わった商品の状態が使われないようにする。
    // 失敗時はタブを閉じないので、ここで activeTabId を外すと
    // そのタブは自動処理の対象から外れ、ユーザーの手元に残る。
    this.resetItemState();
    await this.scheduleNext();
  }

  /**
   * replace: 保存後の本文を商品ページ (item.fril.jp) の JSON-LD から読み直して照合する。
   *
   * 反映が遅れることがあるため数回試す。改行コードは LF に揃えてから比べる
   * （文字自体は変えない）。
   */
  private async verifyReplaced(item: QueueItem): Promise<void> {
    const final = item.replace?.final ?? '';
    const expected = fingerprint(final);
    let live: TextFingerprint | null = null;

    for (let attempt = 0; attempt < REPLACE_VERIFY_ATTEMPTS; attempt++) {
      if (attempt > 0) await delay(REPLACE_VERIFY_DELAY_MS);
      const source = await fetchSourceItem(item.id);
      if (source?.description === null || source?.description === undefined) continue;
      live = fingerprint(normalizeLineBreaks(source.description));
      if (sameFingerprint(live, expected)) {
        await this.recordReplace('applied', true, undefined, live);
        return;
      }
    }

    const reason =
      live === null
        ? '保存後の商品ページの本文を読み取れませんでした（保存されたかどうか不明）'
        : `保存後の商品ページの本文が確定版と一致しません（${live.length}字 / 期待 ${expected.length}字）`;
    await this.recordReplace('unverified', true, reason, live);
  }

  /**
   * replace: 処理中の商品の結果を記録する。
   * 件数を更新し、成功以外は理由付きで failed に積み（一括操作バーで確認できる）、
   * chrome.storage.local へ商品IDごとの最新結果として保存する。
   */
  private async recordReplace(
    outcome: ReplaceOutcome,
    saved: boolean,
    reason?: string,
    live: TextFingerprint | null = null
  ): Promise<void> {
    const item = this.state.items[this.state.currentIndex];
    if (!item?.replace || !this.state.replaceCounts) return;

    this.state.replaceCounts[outcome]++;
    if (outcome === 'applied') {
      log(`説明文を置き換えました: ${item.title}`);
    } else if (outcome === 'already') {
      log(`すでに確定版です: ${item.title}`);
    } else {
      warn(`${REPLACE_OUTCOME_LABEL[outcome]}: ${item.title} (${reason ?? ''})`);
      this.state.failed.push({
        item: { id: item.id, title: item.title },
        reason: `[${REPLACE_OUTCOME_LABEL[outcome]}] ${reason ?? ''}`,
      });
    }

    const expected = fingerprint(item.replace.final);
    const record: ReplaceRecord = {
      id: item.id,
      name: item.title,
      outcome,
      reason,
      saved,
      currentLength: this.state.replaceCurrent?.length ?? null,
      currentHash: this.state.replaceCurrent?.hash ?? null,
      expectedLength: expected.length,
      expectedHash: expected.hash,
      liveLength: live?.length ?? null,
      liveHash: live?.hash ?? null,
      at: new Date().toISOString(),
    };
    await saveReplaceRecord(record);
  }

  /**
   * replace: 残りの商品を開かずに止める。
   *
   * 説明欄や確定ボタンが見つからないのは商品固有の事情ではなくラクマ側の
   * 構造変更を疑うべき状況なので、1 件ずつ失敗を積み上げずにここで止める。
   * 処理中だったタブは残す（stop と同じ）。
   */
  private async halt(reason: string): Promise<void> {
    if (!this.state.running) return;
    warn(`残りの商品を開かずに止めます: ${reason}`);
    this.state.haltedReason = reason;
    await this.stop();
  }

  /**
   * 商品ごとの状態（QueueStateのコメントの3種類目）をまとめて初期値に戻す。
   *
   * リセットの正本はこの1か所。**商品ごとの寿命を持つフィールドを足したら
   * ここに加えること。** 逆に、キュー全体で不変のもの（mode / items /
   * listTabId / deletePage / waitBaseMs）と、キューの進行で積み上がるもの（currentIndex /
   * running / failed / replaceCounts / haltedReason）は対象外。
   *
   * とくに deletePage を混ぜないこと。ここでnullに戻すと2件目以降の削除が
   * 1ページ目から対象を探し始め、2ページ目以降の対象を取りこぼす。
   *
   * 呼ぶのは「1商品ぶんの処理が始まる前」と「終わった後」の両方。
   * 後者で落としておかないと、次の processCurrent() までの待機（最大75秒）の
   * 間に届いたタブのイベントが、終わった商品の状態のまま動いてしまう。
   */
  private resetItemState(): void {
    this.state.activeTabId = null;
    this.state.phase = 'idle';
    this.state.candidateTabIds = [];
    this.state.expectedSource = null;
    this.state.countBeforeDelete = null;
    this.state.replaceCurrent = null;
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

    // 待機を挟まないモード（delete）は一覧ページ内で完結し、ページ遷移そのものが
    // 間隔になる。クリック前の待機はContent Script側で入れるため、ここでは待たない
    // （chrome.alarms は短い遅延を指定できないため）。
    if (!QUEUE_MODE_TRAITS[this.state.mode].waitsBetweenItems) {
      await this.save();
      await this.notifyProgress();
      await this.processCurrent();
      return;
    }

    // replace は画面で指定した基準時間（下限 30 秒）を使う。他は固定値
    const baseMs = this.state.waitBaseMs ?? WAIT_BETWEEN_ITEMS_MS;
    const waitMs = baseMs + Math.floor(Math.random() * WAIT_RANDOM_MS);
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
    this.resetItemState();
    await this.clearTimers();
    log(
      `キュー完了: 成功=${this.state.items.length - this.state.failed.length}件, ` +
        `失敗=${this.state.failed.length}件` +
        (this.state.replaceCounts ? ` 内訳=${JSON.stringify(this.state.replaceCounts)}` : '')
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
