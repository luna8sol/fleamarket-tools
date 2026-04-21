import { ID_NAME } from '../infra/constants';
import { debugMethodStart, debugMethodEnd } from '../infra/logger';
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

  const existingContainer = document.getElementById(ID_NAME.BULK_RELIST_CONTAINER);
  const existingBtn = document.getElementById(ID_NAME.BULK_RELIST_BTN);

  // コンテナが正常（DOMに接続済み かつ ボタンを内包）かどうかで分岐
  const isContainerValid = existingContainer?.isConnected === true
    && existingContainer.contains(existingBtn);

  if (isContainerValid && existingContainer) {
    // 正常なコンテナが存在: カウント表示を更新し、ボタンがなければ追加
    const countSpan = existingContainer.querySelector(`#${ID_NAME.BULK_COUNT_SPAN}`);
    if (countSpan) {
      countSpan.textContent = `選択中: ${selectedCount}件`;
    }
    if (!existingContainer.querySelector(`#${ID_NAME.BULK_RELIST_BTN}`)) {
      existingContainer.appendChild(createButtonForCurrentPage());
    }
  } else {
    // コンテナが存在しないか壊れている: 旧コンテナを除去して再作成
    existingContainer?.remove();
    document.body.appendChild(createBulkRelistContainer(selectedCount));
  }

  // 処理中表示は非表示にする
  const processingSpan = document.getElementById(ID_NAME.BULK_PROCESSING_SPAN);
  if (processingSpan) {
    processingSpan.style.display = 'none';
  }

  debugMethodEnd('renderBulkBar');
}
