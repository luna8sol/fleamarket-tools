import { CLASS_NAME, COMPOSITE_SELECTOR, CONFIG, ID_NAME } from '../infra/constants';
import { debugMethodStart, debugMethodEnd } from '../infra/logger';
import { BulkProgress } from '../infra/types';
import { showToast } from './notification';
import { selectionManager } from '../logic/selection-manager';
import { getOrCreateElement } from './bulk-bar-core';
import { createBulkDeleteButton, createBulkRelistContainer, createButtonForCurrentPage } from './bulk-relist';
import { createDescriptionReplaceButton } from './description-replace-panel';
import { detectCurrentPage } from '../infra/page-detector';
import { PageType } from '../infra/constants';
import { buildProgress, ProgressView, updateProgress } from './components';

/**
 * スタイルを適用するヘルパー関数
 */
export function applyFixedStyles(element: HTMLElement, styles: Record<string, string>): void {
  Object.assign(element.style, styles);
}

/**
 * 処理中表示（ドック 2 段目の進捗）を生成・更新
 *
 * 文言が空なら隠す。`view` を省略したときは、終わりの見えない処理（準備中など）として
 * 流れる表示にする。
 *
 * @param text 表示する文言（空文字列で非表示）
 * @param view 割合・色調など（省略可）
 * @returns 進捗表示の要素
 */
export function renderProcessingSpan(text: string, view?: Partial<ProgressView>): HTMLElement {
  // コンテナを取得（なければ生成してDOMに追加）
  let container = document.getElementById(ID_NAME.BULK_RELIST_CONTAINER);
  if (!container) {
    container = createBulkRelistContainer(selectionManager.getSelectionCount());
    document.body.appendChild(container);
  }

  // コンテナ内の進捗表示を取得（なければ生成してコンテナに追加）
  let processing = container.querySelector<HTMLElement>(`#${ID_NAME.BULK_PROCESSING_SPAN}`);
  if (!processing) {
    processing = buildProgress(getOrCreateElement(ID_NAME.BULK_PROCESSING_SPAN, 'div'));
    container.appendChild(processing);
  }

  if (text) {
    updateProgress(processing, { label: text, tone: 'active', ...view });
    processing.style.display = '';
    container.dataset.busy = 'true';
  } else {
    processing.style.display = 'none';
    delete container.dataset.busy;
  }

  return processing;
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
 * 進捗を表示の割合・色調に直す
 *
 * 処理中の 1 件はまだ終わっていないので割合に含めない（current - 1）。
 *
 * @param progress 進捗
 * @returns 表示内容
 */
function toProgressView(progress: BulkProgress): Partial<ProgressView> {
  const total = Math.max(progress.total, 1);

  if (progress.phase === 'done') {
    const failed = progress.failed > 0;
    return { ratio: 1, tone: failed ? 'warning' : 'success', icon: failed ? 'warning' : 'success' };
  }
  if (progress.phase === 'waiting') {
    return { ratio: progress.current / total, tone: 'active', icon: 'clock' };
  }
  return { ratio: (progress.current - 1) / total, tone: 'active' };
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
  renderProcessingSpan(text, toProgressView(progress));

  if (progress.phase === 'done' && progress.failed > 0) {
    showToast(text, 'warning', CONFIG.TOAST_DURATION_MS * 2);
  }
}

/**
 * ドックの選択件数・全件数の表示を更新する
 *
 * 件数が変わったときだけ数字を跳ねさせる（再描画のたびに動くと目障りなため）。
 *
 * @param container ドック
 * @param selectedCount 選択件数
 */
export function updateDockCount(container: HTMLElement, selectedCount: number): void {
  const num = container.querySelector<HTMLElement>(`.${CLASS_NAME.DOCK_COUNT_NUM}`);
  if (num && num.textContent !== String(selectedCount)) {
    num.textContent = String(selectedCount);
    num.dataset.bump = 'false';
    void num.offsetWidth; // アニメーションをかけ直すために再計算させる
    num.dataset.bump = 'true';
  }

  const countSpan = container.querySelector(`#${ID_NAME.BULK_COUNT_SPAN}`);
  countSpan?.setAttribute('aria-label', `選択中 ${selectedCount}件`);
  container.dataset.empty = selectedCount === 0 ? 'true' : 'false';

  // 下書き一覧は読み込みが進むと行が増えるので、全件数も毎回数え直す
  const total = container.querySelector(`#${ID_NAME.BULK_TOTAL_COUNT}`);
  if (total) {
    total.textContent = `全 ${document.querySelectorAll(COMPOSITE_SELECTOR.BULK_CHECKBOX_INPUT).length}件`;
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
    updateDockCount(existingContainer, selectedCount);

    const actions = existingContainer.querySelector(`.${CLASS_NAME.DOCK_ACTIONS}`) ?? existingContainer;
    if (!existingContainer.querySelector(`#${ID_NAME.BULK_RELIST_BTN}`)) {
      actions.appendChild(createButtonForCurrentPage());
    }
    if (detectCurrentPage() === PageType.LISTINGS) {
      if (!existingContainer.querySelector(`#${ID_NAME.BULK_DELETE_BTN}`)) {
        actions.appendChild(createBulkDeleteButton());
      }
      if (!existingContainer.querySelector(`#${ID_NAME.DESCRIPTION_REPLACE_BTN}`)) {
        actions.appendChild(createDescriptionReplaceButton());
      }
    }
  } else {
    // コンテナが存在しないか壊れている: 旧コンテナを除去して再作成
    existingContainer?.remove();
    document.body.appendChild(createBulkRelistContainer(selectedCount));
  }

  // 処理中表示は非表示にする（処理の途中で再描画されたときは、進捗を消さない）
  const container = document.getElementById(ID_NAME.BULK_RELIST_CONTAINER);
  const processingSpan = document.getElementById(ID_NAME.BULK_PROCESSING_SPAN);
  if (processingSpan && container?.dataset.busy !== 'true') {
    processingSpan.style.display = 'none';
  }

  debugMethodEnd('renderBulkBar');
}
