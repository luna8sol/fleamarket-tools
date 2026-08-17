import { ID_NAME } from '../infra/constants';
import { QueueProgress } from '../../../common/messages';

export interface BulkBarHandlers {
  onStart: () => void;
  onStop: () => void;
}

/** 開始ボタンのラベル（ページタイプ別に指定する） */
export interface BulkBarOptions {
  startLabel: string;
}

function applyStyles(el: HTMLElement, styles: Record<string, string>): void {
  Object.assign(el.style, styles);
}

/**
 * 画面上部固定の一括操作バーを描画する。既に存在する場合は何もしない。
 */
export function renderBulkBar(options: BulkBarOptions, handlers: BulkBarHandlers): void {
  if (document.getElementById(ID_NAME.BULK_BAR)) return;

  const bar = document.createElement('div');
  bar.id = ID_NAME.BULK_BAR;
  applyStyles(bar, {
    position: 'fixed',
    top: '110px',
    left: '8px',
    zIndex: '9999',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 14px',
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
    fontSize: '13px',
  });

  const countSpan = document.createElement('span');
  countSpan.id = ID_NAME.BULK_COUNT_SPAN;
  countSpan.textContent = '選択中: 0件';
  applyStyles(countSpan, { fontWeight: 'bold', color: '#333' });

  const startBtn = document.createElement('button');
  startBtn.id = ID_NAME.BULK_START_BTN;
  startBtn.textContent = options.startLabel;
  applyStyles(startBtn, {
    padding: '8px 14px',
    backgroundColor: '#ef2a2a',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontWeight: 'bold',
    cursor: 'pointer',
  });
  startBtn.addEventListener('click', handlers.onStart);

  const stopBtn = document.createElement('button');
  stopBtn.id = ID_NAME.BULK_STOP_BTN;
  stopBtn.textContent = '停止';
  applyStyles(stopBtn, {
    padding: '8px 14px',
    backgroundColor: '#fff',
    color: '#ef2a2a',
    border: '2px solid #ef2a2a',
    borderRadius: '4px',
    fontWeight: 'bold',
    cursor: 'pointer',
    display: 'none',
  });
  stopBtn.addEventListener('click', handlers.onStop);

  const statusSpan = document.createElement('span');
  statusSpan.id = ID_NAME.BULK_STATUS_SPAN;
  applyStyles(statusSpan, { color: '#d32f2f', fontWeight: 'bold', display: 'none' });

  bar.appendChild(countSpan);
  bar.appendChild(startBtn);
  bar.appendChild(stopBtn);
  bar.appendChild(statusSpan);
  document.body.appendChild(bar);
}

/**
 * 選択件数の表示を更新する
 */
export function updateCount(count: number): void {
  const countSpan = document.getElementById(ID_NAME.BULK_COUNT_SPAN);
  if (countSpan) {
    countSpan.textContent = `選択中: ${count}件`;
  }
}

/**
 * キューの進捗に応じてバーの表示を更新する
 */
export function updateProgress(progress: QueueProgress): void {
  const startBtn = document.getElementById(ID_NAME.BULK_START_BTN);
  const stopBtn = document.getElementById(ID_NAME.BULK_STOP_BTN);
  const statusSpan = document.getElementById(ID_NAME.BULK_STATUS_SPAN);
  if (!startBtn || !stopBtn || !statusSpan) return;

  if (progress.running) {
    startBtn.style.display = 'none';
    stopBtn.style.display = 'inline-block';
    statusSpan.style.display = 'inline';
    const currentLabel = progress.current ? ` (${progress.current.title})` : '';
    statusSpan.textContent = `処理中 ${progress.done}/${progress.total}${currentLabel}`;
  } else {
    startBtn.style.display = 'inline-block';
    stopBtn.style.display = 'none';
    if (progress.total > 0) {
      statusSpan.style.display = 'inline';
      const failedText = progress.failed.length > 0 ? ` / 失敗${progress.failed.length}件` : '';
      statusSpan.textContent = `完了 ${progress.done}/${progress.total}${failedText}`;
    } else {
      statusSpan.style.display = 'none';
    }
  }
}
