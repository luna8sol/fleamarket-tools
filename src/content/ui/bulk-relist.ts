import { ID_NAME, PageType, COMPOSITE_SELECTOR } from '../infra/constants';
import { log, warn, debugMethodStart, debugMethodEnd } from '../infra/logger';
import { detectCurrentPage } from '../infra/page-detector';
import { relistManager } from '../logic/relist-manager';
import { selectionManager } from '../logic/selection-manager';
import { publishAllDrafts } from '../logic/publisher';
import { applyFixedStyles } from './bulk-bar-ui';
import { getOrCreateElement } from './bulk-bar-core';
import { renderProcessingSpan } from './bulk-bar-ui';
import { removeItemPrefix, getItemNameForLi } from './bulk-bar-utils';

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
  let bulkBtn: HTMLButtonElement;

  if (pageType === PageType.LISTINGS) {
    // 出品一覧ページでは再出品ボタン
    bulkBtn = createBulkRelistButton();
  } else if (pageType === PageType.DRAFTS) {
    // 下書き一覧ページでは別のメソッドを呼び出す
    bulkBtn = createBulkPlaceholderButton();
  } else {
    // その他のページでは汎用ボタン
    bulkBtn = createBulkRelistButton();
  }

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

  // デバッグ強化: DOM上のチェックボックス状態を確認
  const checkedBoxes = document.querySelectorAll('input.bulk-checkbox:checked');
  log(`DOM上のチェック済みボックス数: ${checkedBoxes.length}`);

  // 詳細なチェックボックス情報の出力
  if (checkedBoxes.length > 0) {
    Array.from(checkedBoxes).forEach((cb, idx) => {
      const itemId = (cb as HTMLInputElement).dataset.itemId || 'unknown';
      const cleanId = removeItemPrefix(itemId);
      const li = cb.closest('li');
      const itemName = li ? getItemNameForLi(li as Element) : '';
      log(`チェックボックス ${idx+1}: itemId = ${cleanId}${itemName ? ` - ${itemName}` : ''}`);
    });
  }

  // デバッグ: 現在の選択状況
  const count = selectionManager.getSelectionCount();
  const ids = selectionManager.getOrderedSelections().map(item => item.id);
  log(`ボタン押下時の選択状態: count=${count}, ids=[${ids.map(removeItemPrefix).join(' -> ')}]`);

  // DOM状態とselectionManagerの状態を比較
  log(`状態比較: DOM=${checkedBoxes.length}, selectionManager=${count}`);

  // 問題の修正: チェックボックスの状態のみを更新し、選択順序は保持する
  if (checkedBoxes.length !== count) {
    log('不整合を検出: チェックボックスとselectionManagerを同期します（選択順序は保持）');

    // チェックボックスが選択されているが、選択マネージャーにない場合は追加
    Array.from(checkedBoxes).forEach(cb => {
      const itemId = (cb as HTMLInputElement).dataset.itemId || '';
      if (itemId && !ids.includes(itemId)) {
        const cleanId = removeItemPrefix(itemId);
        const li = cb.closest('li');
        const itemName = li ? getItemNameForLi(li as Element) : '';
        selectionManager.addSelection(itemId);
        log(`選択マネージャーに追加: ${cleanId}${itemName ? ` - ${itemName}` : ''}`);
      }
    });

    // 選択マネージャーにあるが、チェックボックスが選択されていない場合は削除
    const checkedIds = Array.from(checkedBoxes).map(cb => (cb as HTMLInputElement).dataset.itemId || '');
    ids.forEach(id => {
      if (!checkedIds.includes(id)) {
        const cleanId = removeItemPrefix(id);
        selectionManager.removeSelection(id);
        log(`選択マネージャーから削除: ${cleanId}`);
      }
    });

    // 再取得して確認
    const newCount = selectionManager.getSelectionCount();
    const newIds = selectionManager.getOrderedSelections().map(item => item.id);
    log(`同期後の選択順: count=${newCount}, ids=[${newIds.map(removeItemPrefix).join(' -> ')}]`);
  }

  // 改めてカウントを取得
  const finalCount = selectionManager.getSelectionCount();

  if (finalCount === 0) {
    alert(options.emptySelectionMessage);
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
    alert(options.successMessage);
  } catch (e) {
    warn(`${options.actionType === 'relist' ? '再出品' : '出品'}処理中にエラー`, e);
    alert(options.errorMessage);
  } finally {
    // 必ず非表示へ戻す
    renderProcessingSpan('');
    bulkBtn.disabled = false;
  }
}
