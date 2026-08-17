import {
  ExtensionMessage,
  FormMode,
  ListReadyMessage,
  MessageType,
  QueueMode,
  QueueProgress,
  StartQueueMessage,
} from '../../common/messages';
import { log, setDebugMode, warn } from '../../common/logger';
import { detectCurrentPage, PageType } from './infra/page-detector';
import { observeListChanges } from './infra/list-observer';
import { collectItems, findRelistButton } from './logic/item-collector';
import { clickDeleteLink, findDeleteLink } from './logic/delete-clicker';
import { selectionManager } from './logic/selection-manager';
import { addCheckboxes, setCheckboxesEnabled } from './ui/checkbox-manager';
import { renderBulkBar, updateCount, updateProgress } from './ui/bulk-bar';
import { showToast } from './ui/notification';

/**
 * 一覧ページ（/sell・/draft）用Content Scriptのエントリポイント。
 */

/** 削除リンクをクリックするまでの基本待機時間 (ms) */
const DELETE_DELAY_MS = 2000;
/** 削除の待機時間に加算するランダム値の最大 (ms) */
const DELETE_RANDOM_MS = 2000;

function main(): void {
  setDebugMode(true);

  const pageType = detectCurrentPage();
  if (pageType === PageType.UNKNOWN) {
    return;
  }

  /** このページの主モード。削除はどちらのページでも使えるため別扱い */
  const primaryMode: FormMode = pageType === PageType.SELL ? 'relist' : 'publish';
  const startLabel =
    primaryMode === 'relist' ? '選択した商品を下書きに保存' : '選択した下書きをまとめて出品';

  /** キュー実行中は、後から現れたチェックボックスも無効にしておく */
  let queueRunning = false;
  /** LIST_READY はページ読み込みごとに1回だけ送る */
  let listReadySent = false;

  const handleCheckboxChange = (item: { id: string; title: string }, checked: boolean): void => {
    if (checked) {
      selectionManager.add({ id: item.id, title: item.title });
    } else {
      selectionManager.remove(item.id);
    }
    updateCount(selectionManager.getCount());
  };

  /**
   * 一覧の商品にチェックボックスを付け直す。
   *
   * 商品リストはクライアント描画のためContent Script起動時にはまだ存在しない。
   * DOMが変化するたびに呼び、増えた分だけ付与する。
   */
  const syncItems = (): void => {
    const items = collectItems(pageType);
    const added = addCheckboxes(items, handleCheckboxChange);
    if (added > 0) {
      log(`チェックボックスを${added}件追加しました（一覧の商品数: ${items.length}）`);
    }

    if (items.length === 0) {
      // 再描画の途中で一時的に0件になることがあるため、この時点では何もしない
      updateCount(selectionManager.getCount());
      return;
    }

    // ページ送りで一覧から消えた商品の選択は破棄する
    selectionManager.retain(new Set(items.map((item) => item.id)));
    updateCount(selectionManager.getCount());
    if (queueRunning) {
      setCheckboxesEnabled(false);
    }

    // 削除キューの成否判定に使うため、描画が終わったことをBackgroundへ伝える
    if (!listReadySent) {
      listReadySent = true;
      sendListReady();
    }
  };

  /**
   * 現在表示中の商品IDをBackgroundへ伝える。
   * 削除キューは、対象商品がこのIDリストに残っていないことで成否を判定する。
   */
  const sendListReady = (): void => {
    const message: ListReadyMessage = {
      type: MessageType.LIST_READY,
      ids: collectItems(pageType).map((item) => item.id),
    };
    void chrome.runtime.sendMessage(message);
  };

  const startQueue = (mode: QueueMode, items: { id: string; title: string }[]): void => {
    const message: StartQueueMessage = { type: MessageType.START_QUEUE, mode, items };
    void chrome.runtime.sendMessage(message);
    queueRunning = true;
    setCheckboxesEnabled(false);
    showToast(`${items.length}件の処理を開始しました`, 'info');
  };

  // 一括操作バーを描画
  renderBulkBar(
    { startLabel },
    {
      onStart: () => {
        const selected = selectionManager.getOrderedItems();
        if (selected.length === 0) {
          showToast('商品を選択してください', 'warning');
          return;
        }
        // NOTE: フリマアシストのボタンは読み込み後に非同期で注入される。
        // 開始前に全件そろっているか確認し、不足していれば件数を伝える。
        if (primaryMode === 'relist') {
          const missing = selected.filter((item) => !findRelistButton(item.id)).length;
          if (missing > 0) {
            showToast(
              `フリマアシストの再出品ボタンが${missing}件見つかりません（読み込み完了後に再試行してください）`,
              'error'
            );
            return;
          }
        }
        startQueue(primaryMode, selected);
      },

      onDelete: () => {
        const selected = selectionManager.getOrderedItems();
        if (selected.length === 0) {
          showToast('商品を選択してください', 'warning');
          return;
        }
        // 削除は取り消せない。ラクマ側の確認ダイアログは自動化の都合で
        // 抑止するため、その代わりにここで必ず確認を取る。
        const target = pageType === PageType.SELL ? '出品中の商品' : '下書き';
        const ok = window.confirm(
          `${target}を${selected.length}件削除します。\n削除すると元に戻せません。実行しますか？`
        );
        if (!ok) return;
        startQueue('delete', selected);
      },

      onStop: () => {
        void chrome.runtime.sendMessage({ type: MessageType.STOP_QUEUE });
        queueRunning = false;
        setCheckboxesEnabled(true);
        showToast('処理を停止しました', 'warning');
      },
    }
  );

  syncItems();
  observeListChanges(syncItems);

  // ページ再読込時に、実行中のキューの表示を復元する
  void restoreProgress(primaryMode).then((progress) => {
    if (progress?.running) {
      queueRunning = true;
      setCheckboxesEnabled(false);
    }
  });

  // Backgroundからのメッセージを処理
  chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
    switch (message.type) {
      case MessageType.CLICK_RELIST: {
        const btn = findRelistButton(message.item.id);
        if (btn) {
          log(`再出品ボタンをクリック: ${message.item.title}`);
          btn.click();
          sendResponse({ clicked: true });
        } else {
          warn(`再出品ボタンが見つかりません: ${message.item.title}`);
          sendResponse({ clicked: false });
        }
        break;
      }

      case MessageType.CLICK_DELETE: {
        if (!findDeleteLink(pageType, message.item.id)) {
          warn(`削除リンクが見つかりません: ${message.item.title}`);
          sendResponse({ clicked: false });
          break;
        }
        // リンクが見つかったことだけ先に返し、少し間を置いてからクリックする。
        // クリックするとページ遷移が始まり、応答を返せなくなるため。
        sendResponse({ clicked: true });

        const waitMs = DELETE_DELAY_MS + Math.floor(Math.random() * DELETE_RANDOM_MS);
        window.setTimeout(() => {
          // 待っている間に一覧が再描画されて要素が差し替わっている可能性があるため、
          // クリック直前に取り直す
          const link = findDeleteLink(pageType, message.item.id);
          if (!link) {
            warn(`削除リンクが消えていました: ${message.item.title}`);
            // Backgroundは一覧の再読み込みを待っているので、現状を伝えて失敗扱いにさせる
            sendListReady();
            return;
          }
          log(`削除リンクをクリック: ${message.item.title}`);
          clickDeleteLink(link);
        }, waitMs);
        break;
      }

      case MessageType.QUEUE_PROGRESS: {
        updateProgress(message.progress);
        queueRunning = message.progress.running;
        if (!message.progress.running) {
          setCheckboxesEnabled(true);
          if (message.progress.total > 0 && message.progress.done >= message.progress.total) {
            const failed = message.progress.failed.length;
            if (failed > 0) {
              showToast(`完了（失敗${failed}件あり）`, 'warning');
            } else {
              showToast('すべての処理が完了しました', 'success');
            }
          }
        }
        sendResponse({ ok: true });
        break;
      }

      default:
        sendResponse({ ok: true });
        break;
    }
    // すべての分岐で同期的に応答済みのため、チャネルは開いたままにしない
    return undefined;
  });
}

/**
 * Backgroundから現在の進捗を取得してバーへ反映する。
 * Service Workerはキューの待機中も状態を保持しているため、
 * 一覧ページを再読込しても処理中であることが分かるようにする。
 */
async function restoreProgress(primaryMode: FormMode): Promise<QueueProgress | null> {
  try {
    const progress = (await chrome.runtime.sendMessage({
      type: MessageType.GET_PROGRESS,
    })) as QueueProgress | undefined;

    if (!progress || progress.total === 0) return null;
    // 別ページのキュー（例: /sell で /draft のキュー）の進捗は表示しない。
    // 削除はどちらのページでも使えるため常に表示する。
    if (progress.mode !== primaryMode && progress.mode !== 'delete') return null;

    updateProgress(progress);
    return progress;
  } catch (e) {
    warn('進捗の取得に失敗しました', e);
    return null;
  }
}

main();
