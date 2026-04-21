import { CONFIG, ID_NAME } from '../infra/constants';
import { debugMethodStart, debugMethodEnd } from '../infra/logger';
import { BulkProgress } from '../infra/types';
import { showToast } from './notification';
import { selectionManager } from '../logic/selection-manager';
import { getOrCreateElement } from './bulk-bar-core';
import { createBulkDeleteButton, createBulkRelistContainer, createButtonForCurrentPage } from './bulk-relist';
import { createDescriptionReplaceButton } from './description-replace-panel';
import { detectCurrentPage } from '../infra/page-detector';
import { PageType } from '../infra/constants';

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
  // コンテナを取得（なければ生成してDOMに追加）
  let container = document.getElementById(ID_NAME.BULK_RELIST_CONTAINER);
  if (!container) {
    container = createBulkRelistContainer(selectionManager.getSelectionCount());
    document.body.appendChild(container);
  }

  // コンテナ内のspanを取得（なければ生成してコンテナに追加）
  let processingSpan = container.querySelector<HTMLSpanElement>(`#${ID_NAME.BULK_PROCESSING_SPAN}`);
  if (!processingSpan) {
    processingSpan = getOrCreateElement(ID_NAME.BULK_PROCESSING_SPAN, 'span');
    applyFixedStyles(processingSpan, {
      fontWeight: 'bold',
      color: '#d32f2f',
      background: '#fffbe6',
      padding: '6px 12px',
      borderRadius: '4px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    });
    container.appendChild(processingSpan);
  }

  processingSpan.textContent = text;
  processingSpan.style.display = text ? 'inline' : 'none';
  return processingSpan;
}

/**
 * 進捗を1行の文言に整形する
 *
 * @param progress 進捗
 * @returns 表示用の文言
 */
export function formatProgress(progress: BulkProgress): string {
  const { processName, current, total, succeeded, failed } = progress;

  if (progress.phase === 'done') {
    const failedPart = failed > 0 ? `（失敗 ${failed}件）` : '';
    return `${processName}完了: ${succeeded}/${total}件${failedPart}`;
  }

  const name = progress.itemName ? ` ${progress.itemName}` : '';

  if (progress.phase === 'waiting') {
    return `${processName} ${current}/${total}件 完了 — 次まで ${progress.remainingSeconds ?? 0}秒`;
  }

  return `${processName}中 ${current}/${total}件${name}`;
}

/**
 * 進捗を一括操作バーへ表示する
 *
 * 完了時に失敗が1件でもあれば通知も出します。進捗表示は処理終了後に消えるため、
 * それだけだと**一部が失敗したことに気づけない**ためです。
 *
 * @param progress 進捗
 */
export function renderProgress(progress: BulkProgress): void {
  const text = formatProgress(progress);
  renderProcessingSpan(text);

  if (progress.phase === 'done' && progress.failed > 0) {
    showToast(text, 'warning', CONFIG.TOAST_DURATION_MS * 2);
  }
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
    if (detectCurrentPage() === PageType.LISTINGS) {
      if (!existingContainer.querySelector(`#${ID_NAME.BULK_DELETE_BTN}`)) {
        existingContainer.appendChild(createBulkDeleteButton());
      }
      if (!existingContainer.querySelector(`#${ID_NAME.DESCRIPTION_REPLACE_BTN}`)) {
        existingContainer.appendChild(createDescriptionReplaceButton());
      }
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
