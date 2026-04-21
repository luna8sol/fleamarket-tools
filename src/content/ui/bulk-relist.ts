import { ID_NAME, PageType, COMPOSITE_SELECTOR } from '../infra/constants';
import { log, warn, debugMethodStart, debugMethodEnd } from '../infra/logger';
import { detectCurrentPage } from '../infra/page-detector';
import { relistManager } from '../logic/relist-manager';
import { selectionManager } from '../logic/selection-manager';
import { publishAllDrafts } from '../logic/publisher';
import { applyFixedStyles, renderProcessingSpan } from './bulk-bar-ui';
import { getOrCreateElement } from './bulk-bar-core';
import { removeItemPrefix } from './bulk-bar-utils';
import { showToast } from './notification';

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

  bulkBtn.onclick = (): Promise<void> => handleBulkAction(bulkBtn, {
    actionType: 'relist',
    logMessage: '再出品ボタンがクリックされました',
    emptySelectionMessage: '商品を選択してください',
    processingFunction: ids => relistManager.executeRelist(ids),
    successMessage: '再出品が完了しました',
    errorMessage: '再出品でエラーが発生しました'
  });

  return bulkBtn;
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

  // applyFixedStylesで反映されないので直接背景色を設定
  container.style.backgroundColor = '#f8f8f8';

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
    actionType: 'relist' | 'publish';
    logMessage: string;
    emptySelectionMessage: string;
    processingFunction: (ids: string[]) => Promise<unknown>;
    successMessage: string;
    errorMessage: string;
  }
): Promise<void> {
  log(options.logMessage);

  if (selectionManager.getSelectionCount() === 0) {
    showToast(options.emptySelectionMessage, 'warning');
    return;
  }

  // 選択順序に基づいた処理の実行
  try {
    bulkBtn.disabled = true;
    // 実行中のみ表示
    renderProcessingSpan('処理中...');

    // 選択順序に基づいて処理を実行
    const selectedIds = selectionManager.getOrderedSelections().map(item => item.id);
    log(`${options.actionType === 'relist' ? '再出品' : '出品'}処理を選択順で実行: ${selectedIds.map(removeItemPrefix).join(' -> ')}`);

    await options.processingFunction(selectedIds);
    showToast(options.successMessage, 'success');
  } catch (e) {
    warn(`${options.actionType === 'relist' ? '再出品' : '出品'}処理中にエラー`, e);
    showToast(options.errorMessage, 'error');
  } finally {
    // 必ず非表示へ戻す
    renderProcessingSpan('');
    bulkBtn.disabled = false;
  }
}
