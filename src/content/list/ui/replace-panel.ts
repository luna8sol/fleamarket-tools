import { QueueProgress, ReplaceCounts } from '../../../common/messages';
import { loadReplaceRecords } from '../../../common/replace-store';
import { log, warn } from '../../../common/logger';
import { CONFIG, ID_NAME } from '../infra/constants';
import {
  buildReplacePlan,
  DescriptionEntry,
  parseDescriptionEntries,
  ReplacePlan,
} from '../logic/replace-plan';
import { showToast } from './notification';

/**
 * 説明文の一括置換パネル（/sell のみ）。
 *
 * 確定版と原本の JSON を読み込み、件数を確かめ、確認を取ってから Background のキューに積む。
 * 1 件ずつの書き換えと保存は Background が開く編集ページ側（content-form）が行う。
 *
 * **「読み込む」だけでは 1 件も保存しない。** 保存に向かうのは「開始」を押して
 * 確認ダイアログで承諾したあとだけ。実行中は入力欄を触れなくし、「停止」でいつでも止められる。
 */

/** 対象外の内訳を並べる上限 */
const MAX_EXCLUSION_LINES = 5;

export interface ReplacePanelHandlers {
  /** 確認済みの計画をキューに積む */
  onStart: (plan: ReplacePlan, waitBaseSeconds: number) => void;
  onStop: () => void;
}

interface PanelState {
  finals: DescriptionEntry[] | null;
  originals: DescriptionEntry[] | null;
  plan: ReplacePlan | null;
  running: boolean;
}

const state: PanelState = { finals: null, originals: null, plan: null, running: false };

function applyStyles(el: HTMLElement, styles: Record<string, string>): void {
  Object.assign(el.style, styles);
}

function byId<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function styleButton(button: HTMLButtonElement, variant: 'primary' | 'secondary'): void {
  applyStyles(button, {
    padding: '6px 12px',
    borderRadius: '4px',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer',
    backgroundColor: variant === 'primary' ? '#ef2a2a' : '#fff',
    color: variant === 'primary' ? '#fff' : '#333',
    border: variant === 'primary' ? 'none' : '1px solid #999',
  });
}

function labeledRow(labelText: string, control: HTMLElement): HTMLLabelElement {
  const row = document.createElement('label');
  applyStyles(row, { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' });
  const label = document.createElement('span');
  label.textContent = labelText;
  applyStyles(label, { flex: '0 0 110px', color: '#333', fontWeight: 'bold' });
  row.appendChild(label);
  row.appendChild(control);
  return row;
}

/** 実行中かどうかで入力欄とボタンの有効・無効を切り替える */
function syncControls(): void {
  const running = state.running;
  const hasTargets = (state.plan?.targets.length ?? 0) > 0;
  const set = (id: string, disabled: boolean): void => {
    const el = byId<HTMLInputElement | HTMLButtonElement>(id);
    if (el) el.disabled = disabled;
  };
  set(ID_NAME.REPLACE_FINAL_FILE, running);
  set(ID_NAME.REPLACE_ORIGINAL_FILE, running);
  set(ID_NAME.REPLACE_WAIT_INPUT, running);
  set(ID_NAME.REPLACE_LOAD_BTN, running);
  set(ID_NAME.REPLACE_START_BTN, running || !hasTargets);
  set(ID_NAME.REPLACE_STOP_BTN, !running);
}

function renderSummary(plan: ReplacePlan | null): void {
  const summary = byId<HTMLDivElement>(ID_NAME.REPLACE_SUMMARY);
  if (!summary) return;
  summary.textContent = '';

  if (!plan) {
    summary.textContent = '確定版と原本の JSON を選んで「読み込む」を押してください。';
    return;
  }

  const lines = [
    `対象 ${plan.total}件 / 適用済み ${plan.alreadyDone.length}件 / 対象外 ${plan.excluded.length}件`,
    `これから処理: ${plan.targets.length}件`,
  ];
  for (const line of lines) {
    const div = document.createElement('div');
    div.textContent = line;
    summary.appendChild(div);
  }

  if (plan.excluded.length > 0) {
    const head = document.createElement('div');
    head.textContent = '対象外の内訳:';
    applyStyles(head, { marginTop: '4px', color: '#d32f2f' });
    summary.appendChild(head);
    for (const exclusion of plan.excluded.slice(0, MAX_EXCLUSION_LINES)) {
      const div = document.createElement('div');
      div.textContent = `・${exclusion.id} ${exclusion.name}: ${exclusion.reason}`;
      applyStyles(div, { fontSize: '12px', color: '#555' });
      summary.appendChild(div);
    }
    if (plan.excluded.length > MAX_EXCLUSION_LINES) {
      const rest = document.createElement('div');
      rest.textContent = `…ほか${plan.excluded.length - MAX_EXCLUSION_LINES}件`;
      applyStyles(rest, { fontSize: '12px', color: '#555' });
      summary.appendChild(rest);
    }
  }
}

function formatCounts(counts: ReplaceCounts): string {
  return (
    `[成功 ${counts.applied} / 適用済み ${counts.already} / スキップ ${counts.skipped}` +
    ` / 失敗 ${counts.failed} / 未確認 ${counts.unverified}]`
  );
}

/**
 * キューの進捗をパネルに表示する。
 * 商品名が長いと 1 行に収まらないため、何件目かと内訳を行で分ける。
 */
export function renderReplaceProgress(progress: QueueProgress): void {
  if (progress.mode !== 'replace') return;
  // パネルが閉じていても実行中かどうかは追従させる（開いたときに「開始」を押せないように）
  state.running = progress.running;
  const status = byId<HTMLDivElement>(ID_NAME.REPLACE_STATUS);
  if (!status) return;

  const counts = progress.replaceCounts ? formatCounts(progress.replaceCounts) : '';
  let headline: string;
  if (progress.haltedReason) {
    headline = `停止しました: ${progress.haltedReason}（${progress.done}/${progress.total}件）`;
  } else if (progress.running) {
    headline = progress.current
      ? `置換中 ${progress.done + 1}/${progress.total}件 ${progress.current.title}`
      : `${progress.done}/${progress.total}件 完了 — 次の商品を待機中`;
  } else if (progress.total > 0 && progress.done >= progress.total) {
    headline = `置換完了: ${progress.total}件`;
  } else {
    headline = `中断しました: ${progress.done}/${progress.total}件まで処理`;
  }
  status.textContent = `${headline}\n${counts}`;
  status.style.color = progress.haltedReason ? '#d32f2f' : '#333';
  status.title = progress.failed.map((f) => `${f.item.title}: ${f.reason}`).join('\n');

  syncControls();

  // 終わったら記録を反映した件数に組み直す（適用済みが増えている）
  if (!progress.running && state.finals && state.originals) {
    void buildReplacePlan(state.finals, state.originals)
      .then((plan) => {
        state.plan = plan;
        renderSummary(plan);
        syncControls();
      })
      .catch((e) => warn('計画の再計算に失敗しました', e));
  }
}

async function readEntriesFromInput(inputId: string, label: string): Promise<DescriptionEntry[]> {
  const input = byId<HTMLInputElement>(inputId);
  const file = input?.files?.[0];
  if (!file) {
    throw new Error(`${label}のファイルが選ばれていません`);
  }
  return parseDescriptionEntries(await file.text(), label);
}

async function handleLoad(): Promise<void> {
  try {
    const finals = await readEntriesFromInput(ID_NAME.REPLACE_FINAL_FILE, '確定版');
    const originals = await readEntriesFromInput(ID_NAME.REPLACE_ORIGINAL_FILE, '原本');
    state.finals = finals;
    state.originals = originals;
    state.plan = await buildReplacePlan(finals, originals);
    renderSummary(state.plan);
    syncControls();
    log('説明文の一括置換のデータを読み込みました', {
      finals: finals.length,
      originals: originals.length,
      targets: state.plan.targets.length,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    state.plan = null;
    renderSummary(null);
    syncControls();
    warn('説明文の一括置換のデータを読み込めませんでした', e);
    showToast(`読み込めませんでした: ${message}`, 'error');
  }
}

/** 待機秒数の入力値を読む。不正・下限未満なら null */
function readWaitBaseSeconds(): number | null {
  const input = byId<HTMLInputElement>(ID_NAME.REPLACE_WAIT_INPUT);
  const value = Number(input?.value);
  if (!Number.isFinite(value) || value < CONFIG.REPLACE_WAIT_MIN_SECONDS) return null;
  return Math.round(value);
}

/**
 * 実行してよいかを利用者に確認する。**ここが唯一の人の止め時。**
 * 押したあとは 1 件ずつ自動で保存に向かう。
 */
function confirmStart(plan: ReplacePlan, waitBaseSeconds: number): boolean {
  return window.confirm(
    `出品中の商品の説明文を ${plan.targets.length}件 置き換えて保存します。\n` +
      `（対象 ${plan.total}件 / 適用済み ${plan.alreadyDone.length}件は処理しません / 対象外 ${plan.excluded.length}件）\n\n` +
      `1件ごとに ${waitBaseSeconds}〜${waitBaseSeconds + CONFIG.REPLACE_WAIT_RANDOM_SECONDS}秒待ちます。\n` +
      '保存した内容は元に戻せません（原本ファイルから手で戻す必要があります）。\n\n' +
      '実行しますか？'
  );
}

function handleStart(handlers: ReplacePanelHandlers): void {
  const plan = state.plan;
  if (!plan || plan.targets.length === 0) {
    showToast('処理する商品がありません。先に読み込んでください', 'warning');
    return;
  }
  if (state.running) {
    showToast('すでに実行中です', 'warning');
    return;
  }
  const waitBaseSeconds = readWaitBaseSeconds();
  if (waitBaseSeconds === null) {
    showToast(
      `待機秒数には ${CONFIG.REPLACE_WAIT_MIN_SECONDS} 以上の数を入れてください`,
      'warning'
    );
    return;
  }
  if (!confirmStart(plan, waitBaseSeconds)) {
    log('説明文の一括置換は確認で中止されました');
    return;
  }
  state.running = true;
  syncControls();
  handlers.onStart(plan, waitBaseSeconds);
}

/** 処理記録を JSON ファイルとしてダウンロードする */
async function handleExport(): Promise<void> {
  try {
    const records = Object.values(await loadReplaceRecords()).sort((a, b) =>
      a.at.localeCompare(b.at)
    );
    const json = JSON.stringify(
      { exportedAt: new Date().toISOString(), recordCount: records.length, records },
      null,
      2
    );
    const stamp = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d+Z$/, 'Z');
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `rakuma-description-replace-${stamp}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // ダウンロードの開始を待ってから解放する
    window.setTimeout(() => URL.revokeObjectURL(url), CONFIG.TOAST_DURATION_MS);
    showToast(`処理記録を出力しました（${records.length}件）`, 'success');
  } catch (e) {
    warn('処理記録の出力に失敗しました', e);
    showToast('処理記録を出力できませんでした', 'error');
  }
}

function createPanel(handlers: ReplacePanelHandlers): HTMLDivElement {
  const panel = document.createElement('div');
  panel.id = ID_NAME.REPLACE_PANEL;
  applyStyles(panel, {
    position: 'fixed',
    top: '170px',
    left: '8px',
    zIndex: '9999',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    width: '460px',
    maxWidth: 'calc(100vw - 16px)',
    padding: '14px',
    backgroundColor: '#f8f8f8',
    borderRadius: '8px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
    fontSize: '13px',
  });

  const header = document.createElement('div');
  applyStyles(header, { display: 'flex', alignItems: 'center', justifyContent: 'space-between' });
  const title = document.createElement('span');
  title.textContent = '説明文の一括置換';
  applyStyles(title, { fontWeight: 'bold', fontSize: '14px', color: '#333' });
  const closeBtn = document.createElement('button');
  closeBtn.id = ID_NAME.REPLACE_CLOSE_BTN;
  closeBtn.type = 'button';
  closeBtn.textContent = '×';
  closeBtn.title = '閉じる（読み込んだデータと実行中の処理は保持されます）';
  applyStyles(closeBtn, {
    background: 'transparent',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    color: '#555',
  });
  closeBtn.addEventListener('click', () => {
    panel.style.display = 'none';
  });
  header.appendChild(title);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  const finalInput = document.createElement('input');
  finalInput.id = ID_NAME.REPLACE_FINAL_FILE;
  finalInput.type = 'file';
  finalInput.accept = '.json,application/json';
  panel.appendChild(labeledRow('確定版 JSON', finalInput));

  const originalInput = document.createElement('input');
  originalInput.id = ID_NAME.REPLACE_ORIGINAL_FILE;
  originalInput.type = 'file';
  originalInput.accept = '.json,application/json';
  panel.appendChild(labeledRow('原本 JSON', originalInput));

  const waitInput = document.createElement('input');
  waitInput.id = ID_NAME.REPLACE_WAIT_INPUT;
  waitInput.type = 'number';
  waitInput.min = String(CONFIG.REPLACE_WAIT_MIN_SECONDS);
  waitInput.step = '1';
  waitInput.value = String(CONFIG.REPLACE_WAIT_BASE_SECONDS);
  applyStyles(waitInput, { width: '80px', padding: '4px' });
  const waitNote = document.createElement('span');
  waitNote.textContent = `秒（下限 ${CONFIG.REPLACE_WAIT_MIN_SECONDS}。これに 0〜${CONFIG.REPLACE_WAIT_RANDOM_SECONDS} 秒のランダム分が足されます）`;
  applyStyles(waitNote, { color: '#555', fontSize: '12px' });
  const waitWrap = document.createElement('span');
  applyStyles(waitWrap, { display: 'flex', alignItems: 'center', gap: '6px' });
  waitWrap.appendChild(waitInput);
  waitWrap.appendChild(waitNote);
  panel.appendChild(labeledRow('1件ごとの待機', waitWrap));

  const summary = document.createElement('div');
  summary.id = ID_NAME.REPLACE_SUMMARY;
  applyStyles(summary, { color: '#333', lineHeight: '1.5' });
  panel.appendChild(summary);

  const buttons = document.createElement('div');
  applyStyles(buttons, { display: 'flex', gap: '8px', flexWrap: 'wrap' });

  const loadBtn = document.createElement('button');
  loadBtn.id = ID_NAME.REPLACE_LOAD_BTN;
  loadBtn.type = 'button';
  loadBtn.textContent = '読み込む';
  styleButton(loadBtn, 'secondary');
  loadBtn.addEventListener('click', () => void handleLoad());

  const startBtn = document.createElement('button');
  startBtn.id = ID_NAME.REPLACE_START_BTN;
  startBtn.type = 'button';
  startBtn.textContent = '開始';
  styleButton(startBtn, 'primary');
  startBtn.addEventListener('click', () => handleStart(handlers));

  const stopBtn = document.createElement('button');
  stopBtn.id = ID_NAME.REPLACE_STOP_BTN;
  stopBtn.type = 'button';
  stopBtn.textContent = '停止';
  styleButton(stopBtn, 'secondary');
  stopBtn.addEventListener('click', () => {
    handlers.onStop();
    state.running = false;
    syncControls();
  });

  const exportBtn = document.createElement('button');
  exportBtn.id = ID_NAME.REPLACE_EXPORT_BTN;
  exportBtn.type = 'button';
  exportBtn.textContent = '結果を出力';
  styleButton(exportBtn, 'secondary');
  exportBtn.addEventListener('click', () => void handleExport());

  buttons.appendChild(loadBtn);
  buttons.appendChild(startBtn);
  buttons.appendChild(stopBtn);
  buttons.appendChild(exportBtn);
  panel.appendChild(buttons);

  const status = document.createElement('div');
  status.id = ID_NAME.REPLACE_STATUS;
  applyStyles(status, { whiteSpace: 'pre-line', color: '#333', minHeight: '1.5em' });
  panel.appendChild(status);

  document.body.appendChild(panel);
  renderSummary(null);
  syncControls();
  return panel;
}

/**
 * パネルを表示する（無ければ作る）。
 */
export function showReplacePanel(handlers: ReplacePanelHandlers): void {
  const panel = byId<HTMLDivElement>(ID_NAME.REPLACE_PANEL) ?? createPanel(handlers);
  panel.style.display = 'flex';
}
