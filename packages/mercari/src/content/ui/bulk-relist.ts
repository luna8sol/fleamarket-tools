import {
  CLASS_NAME,
  COMPOSITE_SELECTOR,
  CONFIG,
  ID_NAME,
  PageType,
  SELECTOR,
  WAIT,
} from '../infra/constants';
import { log, warn, debugMethodStart, debugMethodEnd } from '../infra/logger';
import { detectCurrentPage } from '../infra/page-detector';
import { relistManager } from '../logic/relist-manager';
import { deleteManager } from '../logic/delete-manager';
import { findLiByItemId, getItemName } from '../logic/dom-utils';
import { selectionManager } from '../logic/selection-manager';
import { publishAllDrafts } from '../logic/publisher';
import { renderBulkBar, renderProcessingSpan, updateDockCount } from './bulk-bar-ui';
import { getOrCreateElement } from './bulk-bar-core';
import { removeItemPrefix } from './bulk-bar-utils';
import { showToast } from './notification';
import { createDescriptionReplaceButton } from './description-replace-panel';
import { decorateButton, setButtonBusy } from './components';
import { confirmAction, ConfirmFact } from './confirm-dialog';
import { createIcon } from './icons';
import { renderOrderNumbers } from './order-display';
import { resetRangeAnchor } from './checkbox-manager';
import { ensureTheme } from './theme';

/**
 * 確認ダイアログに商品名を並べる上限
 */
const MAX_CONFIRM_ITEMS = 10;

/**
 * 一括操作の種別
 */
type BulkActionType = 'relist' | 'publish' | 'delete';

/**
 * 1 件ごとの待機秒数の幅（common-processor に渡している値と同じもの）
 */
const WAIT_RANGE_SECONDS: Record<BulkActionType, { min: number; max: number }> = {
  publish: {
    min: WAIT.BASE_SECONDS + WAIT.EXTRA_MIN_SECONDS,
    max: WAIT.BASE_SECONDS + WAIT.EXTRA_MAX_SECONDS,
  },
  relist: {
    min: CONFIG.RELIST_WAIT_BASE_MS / 1000,
    max: (CONFIG.RELIST_WAIT_BASE_MS + CONFIG.RELIST_WAIT_RANDOM_MS) / 1000,
  },
  delete: {
    min: CONFIG.DELETE_WAIT_BASE_MS / 1000,
    max: (CONFIG.DELETE_WAIT_BASE_MS + CONFIG.DELETE_WAIT_RANDOM_MS) / 1000,
  },
};

/**
 * 一括操作の種別を表示用の日本語にする
 *
 * @param actionType 一括操作の種別
 * @returns 表示用の文言
 */
function describeAction(actionType: BulkActionType): string {
  switch (actionType) {
    case 'relist':
      return '再出品';
    case 'delete':
      return '削除';
    default:
      return '出品';
  }
}

/**
 * 選択した商品の名前を処理順に並べる
 *
 * 名前を読めない行は商品IDで代用する（空欄にすると、何が対象か確かめられないため）。
 * 出品中一覧と下書き一覧のどちらでも使うので、両方のリストから探す。
 *
 * @param ids 商品ID（処理順）。下書きは編集ページのパス（/sell/draft/{id}）が入っている
 * @returns 表示用の名前
 */
function collectItemNames(ids: string[]): string[] {
  const itemListElement =
    document.querySelector<HTMLUListElement>(SELECTOR.ITEMS_LIST) ??
    document.querySelector<HTMLUListElement>(SELECTOR.DRAFT_LIST);

  return ids.map((id) => {
    const li = itemListElement ? findLiByItemId(itemListElement, id) : null;
    const fallback = removeItemPrefix(id).split('/').filter(Boolean).pop() ?? id;
    return (li ? getItemName(li) : '') || fallback;
  });
}

/**
 * 件数・間隔・待機の合計の目安を確認ダイアログ用に並べる
 *
 * @param actionType 一括操作の種別
 * @param count 件数
 * @returns 要点
 */
function buildFacts(actionType: BulkActionType, count: number): ConfirmFact[] {
  const { min, max } = WAIT_RANGE_SECONDS[actionType];
  const waitMinutes = Math.ceil(((count - 1) * (min + max)) / 2 / 60);

  return [
    { label: `${describeAction(actionType)}する件数`, value: `${count}件`, emphasis: true },
    { label: '1件ごとの間隔', value: `${min}〜${max}秒` },
    { label: '待機の合計（目安）', value: count > 1 ? `約${waitMinutes}分` : 'なし' },
  ];
}

/**
 * 一括再出品ボタンを生成
 */
export function createBulkRelistButton(): HTMLButtonElement {
  const bulkBtn = decorateButton(getOrCreateElement(ID_NAME.BULK_RELIST_BTN, 'button'), {
    label: '選択した商品を再出品',
    variant: 'primary',
    icon: 'relist',
  });

  bulkBtn.onclick = async (): Promise<void> => {
    await handleBulkAction(bulkBtn, {
      actionType: 'relist',
      logMessage: '再出品ボタンがクリックされました',
      emptySelectionMessage: '商品を選択してください',
      confirm: confirmRelist,
      processingFunction: (ids) => relistManager.executeRelist(ids),
      successMessage: '再出品が完了しました',
      errorMessage: '再出品でエラーが発生しました',
    });
  };

  return bulkBtn;
}

/**
 * 再出品してよいかを利用者に確認する
 *
 * 再出品は選んだ順に 1 件ずつ進むので、**処理順のまま**商品名を並べる。
 *
 * @param ids 再出品する商品ID（処理順）
 * @returns 実行してよければ true
 */
function confirmRelist(ids: string[]): Promise<boolean> {
  return confirmAction({
    title: `${ids.length}件を再出品します`,
    message: '選んだ順に 1 件ずつ、元の商品をコピーした出品フォームを開きます。',
    facts: buildFacts('relist', ids.length),
    items: collectItemNames(ids),
    maxItems: MAX_CONFIRM_ITEMS,
    confirmLabel: `${ids.length}件を再出品する`,
    tone: 'primary',
    icon: 'relist',
  });
}

/**
 * 一括削除ボタンを生成（出品中一覧のみ）
 *
 * **削除は取り消せません。** 押しただけでは始まらず、件数と対象の商品名を
 * 出した確認を挟みます。メルカリ側の確認ダイアログは1件ずつ自動で通すため、
 * 人が止められる機会はここだけになります。
 */
export function createBulkDeleteButton(): HTMLButtonElement {
  const deleteBtn = decorateButton(getOrCreateElement(ID_NAME.BULK_DELETE_BTN, 'button'), {
    label: '選択した商品を削除',
    variant: 'danger',
    icon: 'trash',
  });

  deleteBtn.onclick = async (): Promise<void> => {
    const executed = await handleBulkAction(deleteBtn, {
      actionType: 'delete',
      logMessage: '削除ボタンがクリックされました',
      emptySelectionMessage: '削除する商品を選択してください',
      confirm: confirmDeletion,
      processingFunction: (ids) => deleteManager.executeDelete(ids),
      successMessage: '削除処理が完了しました',
      errorMessage: '削除処理中にエラーが発生しました',
    });

    // 削除しても一覧の行は残ったままで、選択も解除されない。
    // そのまま放置すると、消えたはずの商品を選び直せてしまい紛らわしいので読み直す。
    if (executed) {
      setTimeout(() => window.location.reload(), CONFIG.TOAST_DURATION_MS);
    }
  };

  return deleteBtn;
}

/**
 * 削除してよいかを利用者に確認する
 *
 * 件数だけでなく**商品名も並べます**。件数だけでは、選んだつもりのものと
 * 実際の対象がずれていても気づけないためです。
 *
 * @param ids 削除対象の商品ID
 * @returns 実行してよければ true
 */
function confirmDeletion(ids: string[]): Promise<boolean> {
  return confirmAction({
    title: `出品中の商品を${ids.length}件削除します`,
    message: 'メルカリ側の削除確認は 1 件ずつ自動で承認します。止められるのはここが最後です。',
    facts: buildFacts('delete', ids.length),
    items: collectItemNames(ids),
    maxItems: MAX_CONFIRM_ITEMS,
    note: '削除すると元に戻せません。',
    confirmLabel: `${ids.length}件を削除する`,
    tone: 'danger',
    icon: 'trash',
  });
}

/**
 * 下書き一覧用の出品ボタンを生成
 */
export function createBulkPlaceholderButton(): HTMLButtonElement {
  debugMethodStart('createBulkPlaceholderButton');

  const bulkBtn = decorateButton(getOrCreateElement(ID_NAME.BULK_RELIST_BTN, 'button'), {
    label: '選択した商品をまとめて出品',
    variant: 'primary',
    icon: 'publish',
  });

  bulkBtn.onclick = async (): Promise<void> => {
    await handleBulkAction(bulkBtn, {
      actionType: 'publish',
      logMessage: 'まとめて出品ボタンがクリックされました',
      emptySelectionMessage: '出品する下書き商品を選択してください',
      confirm: confirmPublish,
      processingFunction: ids => publishAllDrafts(ids),
      successMessage: '出品が完了しました',
      errorMessage: '出品処理中にエラーが発生しました'
    });
  };

  debugMethodEnd('createBulkPlaceholderButton', { elementId: bulkBtn.id });
  return bulkBtn;
}

/**
 * 下書きを出品してよいかを利用者に確認する
 *
 * 出品した商品はすぐ公開される。選んだ順がそのまま出品順になるので、処理順のまま並べる。
 *
 * @param ids 出品する下書きのID（処理順）
 * @returns 実行してよければ true
 */
function confirmPublish(ids: string[]): Promise<boolean> {
  return confirmAction({
    title: `下書き${ids.length}件を出品します`,
    message: '選んだ順に 1 件ずつ出品します。出品した商品はすぐに公開されます。',
    facts: buildFacts('publish', ids.length),
    items: collectItemNames(ids),
    maxItems: MAX_CONFIRM_ITEMS,
    confirmLabel: `${ids.length}件を出品する`,
    tone: 'primary',
    icon: 'publish',
  });
}

/**
 * 現在のページタイプに応じたボタンを生成する
 * DRAFTS → まとめて出品ボタン、それ以外 → 再出品ボタン
 */
export function createButtonForCurrentPage(): HTMLButtonElement {
  const pageType = detectCurrentPage();
  if (pageType === PageType.DRAFTS) {
    return createBulkPlaceholderButton();
  }
  return createBulkRelistButton();
}

/**
 * 「選択を解除」ボタンを生成する
 *
 * 全行のチェックを外し、選択順も 1 からやり直せるように空にする。取り消しはできないが
 * 選び直せば戻るので確認は挟まず、外した件数を通知で知らせる。
 * 一括処理の実行中は他の操作ボタンと同じく押せない（lockDockActions）。
 *
 * @returns 生成したボタン
 */
export function createClearSelectionButton(): HTMLButtonElement {
  const button = decorateButton(getOrCreateElement(ID_NAME.BULK_CLEAR_BTN, 'button'), {
    label: '選択を解除',
    variant: 'ghost',
    icon: 'close',
    size: 'sm',
  });
  // 実行中にまとめて押せなくする対象に含める（lockDockActions はこのクラスの中を見る）
  button.classList.add(CLASS_NAME.DOCK_LOCKABLE);

  button.onclick = (): void => {
    const count = clearAllSelections();
    if (count > 0) {
      showToast(`選択を解除しました（${count}件）`, 'info');
    }
  };

  return button;
}

/**
 * 全行のチェックと選択順を初期化する
 *
 * 行ごとに change を発火させると、行数分だけ一覧全体の再描画が走る。
 * チェックを外してから、選択と表示をまとめて 1 回だけ組み直す。
 *
 * @returns 解除した件数
 */
export function clearAllSelections(): number {
  const count = selectionManager.getSelectionCount();
  if (count === 0) return 0;

  document
    .querySelectorAll<HTMLInputElement>(COMPOSITE_SELECTOR.CHECKED_BULK_CHECKBOX)
    .forEach((checkbox) => (checkbox.checked = false));
  selectionManager.clearSelections();
  // 解除後の Shift 選択が、消えた選択の起点から始まらないようにする
  resetRangeAnchor();

  const list =
    document.querySelector<HTMLUListElement>(SELECTOR.ITEMS_LIST) ??
    document.querySelector<HTMLUListElement>(SELECTOR.DRAFT_LIST);
  if (list) {
    renderOrderNumbers(list, selectionManager);
  } else {
    warn('clearAllSelections: 一覧が見つからないため、順番表示を更新できませんでした');
  }
  renderBulkBar(selectionManager.getSelectionCount());

  log(`選択を解除しました: ${count}件`);
  return count;
}

/**
 * 一括再出品ボタンを含むコンテナ（画面下の浮遊ドック）を生成
 */
export function createBulkRelistContainer(count: number): HTMLDivElement {
  ensureTheme();

  const container = document.createElement('div');
  container.id = ID_NAME.BULK_RELIST_CONTAINER;
  container.className = 'mdp-dock mdp-scope';
  container.setAttribute('role', 'region');
  container.setAttribute('aria-label', '一括操作');

  // ページタイプに応じて情報を取得
  const pageType = detectCurrentPage();

  // 左側: アイコンと件数
  const lead = document.createElement('div');
  lead.className = CLASS_NAME.DOCK_LEAD;

  const tile = document.createElement('span');
  tile.className = 'mdp-icon-tile';
  tile.appendChild(createIcon('layers', 18));

  const stats = document.createElement('div');
  stats.className = 'mdp-dock__stats';

  const countSpan = document.createElement('span');
  countSpan.id = ID_NAME.BULK_COUNT_SPAN;
  countSpan.className = 'mdp-dock__count';
  countSpan.setAttribute('role', 'status');

  const num = document.createElement('span');
  num.className = `${CLASS_NAME.DOCK_COUNT_NUM} mdp-num`;
  num.setAttribute('aria-hidden', 'true');
  const unit = document.createElement('span');
  unit.className = 'mdp-dock__count-unit';
  unit.setAttribute('aria-hidden', 'true');
  unit.textContent = '件 選択中';
  countSpan.append(num, unit);

  // 下書き一覧は全件数、それ以外は処理順の補足を出す
  const meta = document.createElement('span');
  meta.className = CLASS_NAME.DOCK_META;
  if (pageType === PageType.DRAFTS) {
    meta.id = ID_NAME.BULK_TOTAL_COUNT;
    meta.classList.add('mdp-num');
  } else {
    meta.textContent = '選んだ順に処理します';
  }

  stats.append(countSpan, meta);
  lead.append(tile, stats, createClearSelectionButton());

  const divider = document.createElement('span');
  divider.className = 'mdp-dock__divider';
  divider.setAttribute('aria-hidden', 'true');

  // 右側: 操作ボタン
  const actions = document.createElement('div');
  actions.className = CLASS_NAME.DOCK_ACTIONS;
  actions.appendChild(createButtonForCurrentPage());

  // 出品中一覧だけ、削除ボタンと説明文の一括置換ボタンも並べる
  if (pageType === PageType.LISTINGS) {
    actions.appendChild(createBulkDeleteButton());
    actions.appendChild(createDescriptionReplaceButton());
  }

  container.append(lead, divider, actions);

  // 処理中表示（初期状態では非表示）は renderProcessingSpan が必要になったときに足す
  updateDockCount(container, count);
  trackDockHeight(container);

  return container;
}

/**
 * ドックの高さを CSS 変数（--mdp-dock-offset）に書き出し続ける
 *
 * ドックは進捗が出ると 2 段になり、幅が狭いとボタンが折り返して高さが変わる。
 * トーストや置換パネルはその上に置くので、固定値で避けると重なってしまう。
 *
 * @param container ドック
 */
function trackDockHeight(container: HTMLElement): void {
  if (typeof ResizeObserver === 'undefined') return;

  new ResizeObserver(() => {
    if (!container.isConnected) return;
    // ドックの下余白（20px）と、上に置くものとの間隔（14px）を足す
    const offset = Math.ceil(container.getBoundingClientRect().height) + 20 + 14;
    document.documentElement.style.setProperty('--mdp-dock-offset', `${offset}px`);
  }).observe(container);
}

/**
 * ドックの操作ボタンをまとめて押せなくする
 *
 * 一括処理の最中に別の一括処理（再出品中の削除など）を始めさせないため。
 *
 * @returns 元に戻す関数（もともと押せなかったボタンは押せないまま残す）
 */
function lockDockActions(): () => void {
  const container = document.getElementById(ID_NAME.BULK_RELIST_CONTAINER);
  const buttons = Array.from(
    container?.querySelectorAll<HTMLButtonElement>(
      `.${CLASS_NAME.DOCK_ACTIONS} button, button.${CLASS_NAME.DOCK_LOCKABLE}`
    ) ?? []
  ).filter((button) => !button.disabled);

  buttons.forEach((button) => (button.disabled = true));
  return (): void => buttons.forEach((button) => (button.disabled = false));
}

/**
 * 共通化された一括処理関数
 * 再出品と出品の両方で使用される共通のロジックを実装
 */
export async function handleBulkAction(
  bulkBtn: HTMLButtonElement,
  options: {
    actionType: BulkActionType;
    logMessage: string;
    emptySelectionMessage: string;
    /** 実行前の確認。false を返したら何もしない（省略時は確認しない） */
    confirm?: (ids: string[]) => boolean | Promise<boolean>;
    processingFunction: (ids: string[]) => Promise<unknown>;
    successMessage: string;
    errorMessage: string;
  }
): Promise<boolean> {
  log(options.logMessage);

  if (selectionManager.getSelectionCount() === 0) {
    showToast(options.emptySelectionMessage, 'warning');
    return false;
  }

  // 選択順序に基づいた処理の実行
  const orderedIds = selectionManager.getOrderedSelections().map((item) => item.id);

  // 取り消せない操作は、ここで人が止められるようにする
  if (options.confirm && !(await options.confirm(orderedIds))) {
    log('確認で中止されました');
    return false;
  }

  const unlock = lockDockActions();

  try {
    setButtonBusy(bulkBtn, true);
    // 実行中のみ表示
    renderProcessingSpan('準備中…');

    log(`${describeAction(options.actionType)}処理を選択順で実行: ${orderedIds.map(removeItemPrefix).join(' -> ')}`);

    await options.processingFunction(orderedIds);
    showToast(options.successMessage, 'success');
  } catch (e) {
    warn(`${describeAction(options.actionType)}処理中にエラー`, e);
    showToast(options.errorMessage, 'error');
  } finally {
    // 必ず非表示へ戻す
    renderProcessingSpan('');
    setButtonBusy(bulkBtn, false);
    unlock();
  }

  return true;
}
