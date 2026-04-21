import { ID_NAME } from '../infra/constants';
import { debug, debugMethodStart, debugMethodEnd } from '../infra/logger';
import { selectionManager } from '../logic/selection-manager';
import { getOrCreateElement } from './bulk-bar-core';
import { createBulkRelistContainer, createButtonForCurrentPage } from './bulk-relist';

/**
 * スタイルを適用するヘルパー関数
 */
export function applyFixedStyles(element: HTMLElement, styles: Record<string, string>): void {
  Object.assign(element.style, styles);
}

/**
 * 処理中表示用spanを生成・更新
 */
export function renderProcessingSpan(text: string): HTMLSpanElement {
  // まずコンテナ内のspan要素があるか確認
  const existingContainer = document.getElementById(ID_NAME.BULK_RELIST_CONTAINER);

  if (existingContainer) {
    let processingSpan = existingContainer.querySelector(`#${ID_NAME.BULK_PROCESSING_SPAN}`) as HTMLSpanElement;
    if (processingSpan) {
      processingSpan.textContent = text;
      processingSpan.style.display = text ? 'inline' : 'none';
      return processingSpan;
    }
  }

  // コンテナがなければ、コンテナを先に生成
  if (!existingContainer) {
    // 選択件数を取得（選択マネージャーから）
    const count = selectionManager.getSelectionCount();
    const container = createBulkRelistContainer(count);
    document.body.appendChild(container);

    // 生成したコンテナからprocessingSpan要素を取得
    const processingSpan = container.querySelector(`#${ID_NAME.BULK_PROCESSING_SPAN}`) as HTMLSpanElement;
    if (processingSpan) {
      processingSpan.textContent = text;
      processingSpan.style.display = text ? 'inline' : 'none';
      return processingSpan;
    }
  }

  // ここに到達することは基本的にないが、念のため従来の実装を残す（後方互換性）
  const processingSpan = getOrCreateElement(ID_NAME.BULK_PROCESSING_SPAN, 'span');
  processingSpan.textContent = text;

  applyFixedStyles(processingSpan, {
    position: 'fixed',
    top: '120px',
    right: '40px',
    zIndex: '9999',
    fontWeight: 'bold',
    color: '#d32f2f',
    background: '#fffbe6',
    padding: '6px 12px',
    borderRadius: '4px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    display: text ? 'inline' : 'none'
  });

  if (!processingSpan.isConnected) {
    document.body.appendChild(processingSpan);
  }

  return processingSpan;
}

/**
 * 一括再出品バーを描画
 */
export function renderBulkBar(selectedCount: number): void {
  debugMethodStart('renderBulkBar', { selectedCount });

  // 既存のコンテナを確認
  const existingContainer = document.getElementById(ID_NAME.BULK_RELIST_CONTAINER);
  const existingBtn = document.getElementById(ID_NAME.BULK_RELIST_BTN);

  debug('既存要素の状態:', {
    hasContainer: !!existingContainer,
    hasButton: !!existingBtn,
    containerInDOM: existingContainer?.isConnected,
    buttonInDOM: existingBtn?.isConnected,
    containerParent: existingContainer?.parentElement?.tagName,
    buttonParent: existingBtn?.parentElement?.tagName || '不明'
  });

  // 処理の安定性向上: DOM更新前に既存のコンテナを削除
  if (existingContainer && !existingContainer.contains(existingBtn)) {
    debug('コンテナ内にボタンが存在しないため再作成します');
    existingContainer.remove();
    // 新しいコンテナを作成
    const container = createBulkRelistContainer(selectedCount);
    document.body.appendChild(container);
    debug('新規コンテナをDOMに追加しました（古いコンテナを削除後）', { container });

    // 処理中表示は別管理のままにする
    const processingSpan = document.getElementById(ID_NAME.BULK_PROCESSING_SPAN);
    if (processingSpan) {
      processingSpan.style.display = 'none';
    }

    debugMethodEnd('renderBulkBar');
    return;
  }

  if (existingContainer && existingContainer.isConnected) {
    // コンテナが既に存在する場合は、カウント表示のみ更新
    const countSpan = existingContainer.querySelector(`#${ID_NAME.BULK_COUNT_SPAN}`);
    if (countSpan) {
      countSpan.textContent = `選択中: ${selectedCount}件`;
      debug('既存コンテナのカウントを更新しました', { count: selectedCount });
    }

    // ボタンが存在しない場合は、新たに追加
    const btnInContainer = existingContainer.querySelector(`#${ID_NAME.BULK_RELIST_BTN}`);
    if (!btnInContainer) {
      debug('コンテナ内にボタンがないため、新規作成します');
      const newBtn = createButtonForCurrentPage();
      existingContainer.appendChild(newBtn);
      debug('既存コンテナにボタンを追加しました', { buttonId: newBtn.id });
    }
  } else {
    debug('新規コンテナを作成します');
    // コンテナがない場合は新規作成して追加
    const container = createBulkRelistContainer(selectedCount);
    document.body.appendChild(container);
    debug('新規コンテナをDOMに追加しました', { container });
  }

  // 処理中表示は別管理のままにする
  const processingSpan = document.getElementById(ID_NAME.BULK_PROCESSING_SPAN);
  if (processingSpan) {
    processingSpan.style.display = 'none';
  }

  debugMethodEnd('renderBulkBar');
}
