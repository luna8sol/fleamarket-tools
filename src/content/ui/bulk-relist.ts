import { CONFIG, ID_NAME, PageType, COMPOSITE_SELECTOR, SELECTOR } from '../infra/constants';
import { log, warn, debugMethodStart, debugMethodEnd } from '../infra/logger';
import { detectCurrentPage } from '../infra/page-detector';
import { relistManager } from '../logic/relist-manager';
import { deleteManager } from '../logic/delete-manager';
import { findLiByItemId, getItemName } from '../logic/dom-utils';
import { selectionManager } from '../logic/selection-manager';
import { publishAllDrafts } from '../logic/publisher';
import { applyFixedStyles, renderProcessingSpan } from './bulk-bar-ui';
import { getOrCreateElement } from './bulk-bar-core';
import { removeItemPrefix } from './bulk-bar-utils';
import { showToast } from './notification';

/**
 * 確認ダイアログに商品名を並べる上限
 */
const MAX_CONFIRM_ITEMS = 10;

/**
 * 一括操作の種別
 */
type BulkActionType = 'relist' | 'publish' | 'delete';

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
 * 一括再出品ボタンを生成
 */
export function createBulkRelistButton(): HTMLButtonElement {
  const bulkBtn = getOrCreateElement(ID_NAME.BULK_RELIST_BTN, 'button');
  bulkBtn.textContent = '選択した商品を再出品';

  // 固定位置を使わないようにスタイル変更
  applyFixedStyles(bulkBtn, {
    padding: '8px 16px',
    background: '#ff333a',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontWeight: 'bold',
    cursor: 'pointer'
  });

  bulkBtn.onclick = async (): Promise<void> => {
    await handleBulkAction(bulkBtn, {
      actionType: 'relist',
      logMessage: '再出品ボタンがクリックされました',
      emptySelectionMessage: '商品を選択してください',
      processingFunction: (ids) => relistManager.executeRelist(ids),
      successMessage: '再出品が完了しました',
      errorMessage: '再出品でエラーが発生しました',
    });
  };

  return bulkBtn;
}

/**
 * 一括削除ボタンを生成（出品中一覧のみ）
 *
 * **削除は取り消せません。** 押しただけでは始まらず、件数と対象の商品名を
 * 出した確認を挟みます。メルカリ側の確認ダイアログは1件ずつ自動で通すため、
 * 人が止められる機会はここだけになります。
 */
export function createBulkDeleteButton(): HTMLButtonElement {
  const deleteBtn = getOrCreateElement(ID_NAME.BULK_DELETE_BTN, 'button');
  deleteBtn.textContent = '選択した商品を削除';

  applyFixedStyles(deleteBtn, {
    padding: '8px 16px',
    background: '#fff',
    color: '#d32f2f',
    border: '1px solid #d32f2f',
    borderRadius: '4px',
    fontWeight: 'bold',
    cursor: 'pointer',
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
function confirmDeletion(ids: string[]): boolean {
  const itemListElement = document.querySelector<HTMLUListElement>(SELECTOR.ITEMS_LIST);

  const names = ids.map((id) => {
    const li = itemListElement ? findLiByItemId(itemListElement, id) : null;
    return `・${(li ? getItemName(li) : '') || removeItemPrefix(id)}`;
  });

  const shown = names.slice(0, MAX_CONFIRM_ITEMS).join('\n');
  const rest = names.length > MAX_CONFIRM_ITEMS ? `
…ほか${names.length - MAX_CONFIRM_ITEMS}件` : '';

  return window.confirm(
    `出品中の商品を${ids.length}件削除します。
削除すると元に戻せません。

${shown}${rest}

実行しますか？`
  );
}

/**
 * 下書き一覧用の出品ボタンを生成
 */
export function createBulkPlaceholderButton(): HTMLButtonElement {
  debugMethodStart('createBulkPlaceholderButton');

  const bulkBtn = getOrCreateElement(ID_NAME.BULK_RELIST_BTN, 'button');
  bulkBtn.textContent = '選択した商品をまとめて出品';

  applyFixedStyles(bulkBtn, {
    padding: '8px 16px',
    background: '#ff333a',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontWeight: 'bold',
    cursor: 'pointer'
  });

  bulkBtn.onclick = async (): Promise<void> => {
    await handleBulkAction(bulkBtn, {
      actionType: 'publish',
      logMessage: 'まとめて出品ボタンがクリックされました',
      emptySelectionMessage: '出品する下書き商品を選択してください',
      processingFunction: ids => publishAllDrafts(ids),
      successMessage: '出品が完了しました',
      errorMessage: '出品処理中にエラーが発生しました'
    });
  };

  debugMethodEnd('createBulkPlaceholderButton', { elementId: bulkBtn.id });
  return bulkBtn;
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
 * 一括再出品ボタンを含むコンテナを生成
 */
export function createBulkRelistContainer(count: number): HTMLDivElement {
  const container = document.createElement('div');
  container.id = ID_NAME.BULK_RELIST_CONTAINER;

  // コンテナのスタイル設定
  applyFixedStyles(container, {
    position: 'fixed',
    top: '50px',
    left: '5px',
    zIndex: '9999',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '1rem',
    backgroundColor: '#f8f8f8',
    borderRadius: '6px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
  });

  // ページタイプに応じて情報を取得
  const pageType = detectCurrentPage();

  // カウント表示用のspanを生成
  const countSpan = document.createElement('span');
  countSpan.id = ID_NAME.BULK_COUNT_SPAN;
  countSpan.textContent = `選択中: ${count}件`;
  applyFixedStyles(countSpan, {
    fontWeight: 'bold',
    color: '#333',
    background: '#fffbe6',
    padding: '6px 12px',
    borderRadius: '4px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
  });

  // 全件数表示用のspan - 下書き一覧ページの場合のみ追加
  const totalSpan = document.createElement('span');
  totalSpan.id = ID_NAME.BULK_TOTAL_COUNT;

  // ページタイプに応じて全件数を取得
  let totalCount = document.querySelectorAll(COMPOSITE_SELECTOR.BULK_CHECKBOX_INPUT).length;
  totalSpan.textContent = `全体: ${totalCount}件`;
  applyFixedStyles(totalSpan, {
    color: '#555',
    background: '#fffbe6',
    padding: '6px 12px',
    borderRadius: '4px'
  });

  // 処理中表示用のspanを生成し、初期状態では非表示
  const processingSpan = document.createElement('span');
  processingSpan.id = ID_NAME.BULK_PROCESSING_SPAN;
  processingSpan.textContent = '';
  applyFixedStyles(processingSpan, {
    fontWeight: 'bold',
    color: '#d32f2f',
    background: '#fffbe6',
    padding: '6px 12px',
    borderRadius: '4px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    display: 'none'
  });

  // ボタンを生成
  const bulkBtn = createButtonForCurrentPage();

  // 要素をコンテナに追加
  container.appendChild(bulkBtn);

  // 出品中一覧だけ、削除ボタンも並べる
  if (pageType === PageType.LISTINGS) {
    container.appendChild(createBulkDeleteButton());
  }
  container.appendChild(countSpan);

  // 下書き一覧ページの場合のみ全体数を表示
  if (pageType === PageType.DRAFTS) {
    container.appendChild(totalSpan);
  }

  container.appendChild(processingSpan);

  return container;
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
    confirm?: (ids: string[]) => boolean;
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
  if (options.confirm && !options.confirm(orderedIds)) {
    log('確認で中止されました');
    return false;
  }

  try {
    bulkBtn.disabled = true;
    // 実行中のみ表示
    renderProcessingSpan('処理中...');

    log(`${describeAction(options.actionType)}処理を選択順で実行: ${orderedIds.map(removeItemPrefix).join(' -> ')}`);

    await options.processingFunction(orderedIds);
    showToast(options.successMessage, 'success');
  } catch (e) {
    warn(`${describeAction(options.actionType)}処理中にエラー`, e);
    showToast(options.errorMessage, 'error');
  } finally {
    // 必ず非表示へ戻す
    renderProcessingSpan('');
    bulkBtn.disabled = false;
  }

  return true;
}
