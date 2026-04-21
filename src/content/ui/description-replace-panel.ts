import { CONFIG, ID_NAME } from '../infra/constants';
import { log, warn } from '../infra/logger';
import {
  DescriptionEntry,
  DescriptionReplacePlan,
  DescriptionReplaceProgress,
} from '../infra/types';
import { buildReplacePlan, parseDescriptionEntries } from '../logic/description-replace-data';
import { descriptionReplaceManager } from '../logic/description-replace-manager';
import { applyFixedStyles } from './bulk-bar-ui';
import { getOrCreateElement } from './bulk-bar-core';
import { showToast } from './notification';

/**
 * 説明文の一括置換パネル（出品中一覧のみ）。
 *
 * 確定版と原本の JSON を読み込み、件数を確かめ、確認を取ってから 1 件ずつ置き換えます。
 *
 * **「読み込む」だけでは 1 件も保存しません。** 保存に向かうのは「開始」を押して
 * 確認ダイアログで承諾したあとだけです。実行中は入力欄を触れなくし、
 * 「中断」でいつでも止められます。
 */

/** 対象外の内訳を並べる上限 */
const MAX_EXCLUSION_LINES = 5;

/** 読み込み済みのデータと計画（パネルを閉じても保持する） */
interface PanelState {
  fixed: DescriptionEntry[] | null;
  originals: DescriptionEntry[] | null;
  plan: DescriptionReplacePlan | null;
}

const state: PanelState = { fixed: null, originals: null, plan: null };

/**
 * ボタンの見た目をそろえる
 * @param button 対象のボタン
 * @param variant 主操作（赤地）か副操作（白地）か
 */
function styleButton(button: HTMLButtonElement, variant: 'primary' | 'secondary'): void {
  applyFixedStyles(button, {
    padding: '6px 12px',
    borderRadius: '4px',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer',
    background: variant === 'primary' ? '#ff333a' : '#fff',
    color: variant === 'primary' ? '#fff' : '#333',
    border: variant === 'primary' ? 'none' : '1px solid #999',
  });
}

/**
 * ラベル付きの 1 行を作る
 * @param labelText ラベルの文言
 * @param control 右側に置く入力欄
 * @returns 1 行分の要素
 */
function labeledRow(labelText: string, control: HTMLElement): HTMLLabelElement {
  const row = document.createElement('label');
  applyFixedStyles(row, { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' });

  const label = document.createElement('span');
  label.textContent = labelText;
  applyFixedStyles(label, { flex: '0 0 110px', color: '#333', fontWeight: 'bold' });

  row.appendChild(label);
  row.appendChild(control);
  return row;
}

/**
 * パネル内の要素を ID で取り出す
 * @param id 要素ID
 * @returns 見つかった要素。無ければ null
 */
function byId<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

/**
 * 実行中かどうかで入力欄とボタンの有効・無効を切り替える
 * @param running 実行中か
 */
function syncControls(running: boolean): void {
  const hasTargets = (state.plan?.targets.length ?? 0) > 0;

  const fixedInput = byId<HTMLInputElement>(ID_NAME.DESCRIPTION_REPLACE_FIXED_FILE);
  const originalInput = byId<HTMLInputElement>(ID_NAME.DESCRIPTION_REPLACE_ORIGINAL_FILE);
  const intervalInput = byId<HTMLInputElement>(ID_NAME.DESCRIPTION_REPLACE_INTERVAL);
  const loadBtn = byId<HTMLButtonElement>(ID_NAME.DESCRIPTION_REPLACE_LOAD_BTN);
  const startBtn = byId<HTMLButtonElement>(ID_NAME.DESCRIPTION_REPLACE_START_BTN);
  const abortBtn = byId<HTMLButtonElement>(ID_NAME.DESCRIPTION_REPLACE_ABORT_BTN);

  if (fixedInput) fixedInput.disabled = running;
  if (originalInput) originalInput.disabled = running;
  if (intervalInput) intervalInput.disabled = running;
  if (loadBtn) loadBtn.disabled = running;
  if (startBtn) startBtn.disabled = running || !hasTargets;
  if (abortBtn) abortBtn.disabled = !running;
}

/**
 * 計画の件数をパネルに表示する
 * @param plan 実行計画。null なら未読み込みの表示にする
 */
function renderSummary(plan: DescriptionReplacePlan | null): void {
  const summary = byId<HTMLDivElement>(ID_NAME.DESCRIPTION_REPLACE_SUMMARY);
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
    applyFixedStyles(head, { marginTop: '4px', color: '#d32f2f' });
    summary.appendChild(head);

    for (const exclusion of plan.excluded.slice(0, MAX_EXCLUSION_LINES)) {
      const div = document.createElement('div');
      div.textContent = `・${exclusion.id} ${exclusion.name}: ${exclusion.reason}`;
      applyFixedStyles(div, { fontSize: '12px', color: '#555' });
      summary.appendChild(div);
    }

    if (plan.excluded.length > MAX_EXCLUSION_LINES) {
      const rest = document.createElement('div');
      rest.textContent = `…ほか${plan.excluded.length - MAX_EXCLUSION_LINES}件`;
      applyFixedStyles(rest, { fontSize: '12px', color: '#555' });
      summary.appendChild(rest);
    }
  }
}

/**
 * 進捗を 1〜2 行の文言にする
 * @param progress 進捗
 * @returns 表示用の文言
 */
export function formatReplaceProgress(progress: DescriptionReplaceProgress): string {
  const { counts, current, total } = progress;
  const breakdown =
    `成功 ${counts.applied} / 適用済み ${counts.already} / スキップ ${counts.skipped}` +
    ` / 失敗 ${counts.failed} / 未確認 ${counts.unverified}`;

  switch (progress.phase) {
    case 'done':
      return `置換完了: ${total}件（${breakdown}）`;
    case 'aborted':
      return `中断しました: ${current}/${total}件まで処理（${breakdown}）`;
    case 'halted':
      return `停止しました: ${progress.message ?? '理由不明'}（${current}/${total}件、${breakdown}）`;
    case 'waiting':
      return `${current}/${total}件 完了 — 次まで ${progress.remainingSeconds ?? 0}秒（${breakdown}）`;
    default:
      return `置換中 ${current}/${total}件 ${progress.itemName ?? ''}（${breakdown}）`;
  }
}

/**
 * 進捗をパネルに表示する
 * @param progress 進捗
 */
function renderStatus(progress: DescriptionReplaceProgress): void {
  const status = byId<HTMLDivElement>(ID_NAME.DESCRIPTION_REPLACE_STATUS);
  if (!status) return;

  status.textContent = formatReplaceProgress(progress);
  status.style.color = progress.phase === 'halted' ? '#d32f2f' : '#333';
}

/**
 * 選択されたファイルを読んで一覧にする
 * @param inputId ファイル入力欄のID
 * @param label エラーメッセージに添える呼び名
 * @returns 読み込んだ一覧
 */
async function readEntriesFromInput(inputId: string, label: string): Promise<DescriptionEntry[]> {
  const input = byId<HTMLInputElement>(inputId);
  const file = input?.files?.[0];
  if (!file) {
    throw new Error(`${label}のファイルが選ばれていません`);
  }
  return parseDescriptionEntries(await file.text(), label);
}

/**
 * 2 つのファイルを読み込み、計画を組み立てて表示する
 */
async function handleLoad(): Promise<void> {
  try {
    const fixed = await readEntriesFromInput(ID_NAME.DESCRIPTION_REPLACE_FIXED_FILE, '確定版');
    const originals = await readEntriesFromInput(ID_NAME.DESCRIPTION_REPLACE_ORIGINAL_FILE, '原本');

    state.fixed = fixed;
    state.originals = originals;
    state.plan = await buildReplacePlan(fixed, originals);

    renderSummary(state.plan);
    syncControls(descriptionReplaceManager.isRunning());
    log('説明文の一括置換のデータを読み込みました', {
      fixed: fixed.length,
      originals: originals.length,
      targets: state.plan.targets.length,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    state.plan = null;
    renderSummary(null);
    syncControls(descriptionReplaceManager.isRunning());
    warn('説明文の一括置換のデータを読み込めませんでした', e);
    showToast(`読み込めませんでした: ${message}`, 'error', CONFIG.TOAST_DURATION_MS * 2);
  }
}

/**
 * 待機秒数の入力値を読む
 * @returns 基準秒数。不正なら null
 */
function readWaitBaseSeconds(): number | null {
  const input = byId<HTMLInputElement>(ID_NAME.DESCRIPTION_REPLACE_INTERVAL);
  const value = Number(input?.value);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

/**
 * 実行してよいかを利用者に確認する
 *
 * **ここが唯一の人の止め時。** 押したあとは 1 件ずつ自動で保存に向かう。
 *
 * @param plan 実行計画
 * @param waitBaseSeconds 待機の基準秒数
 * @returns 実行してよければ true
 */
function confirmStart(plan: DescriptionReplacePlan, waitBaseSeconds: number): boolean {
  const randomSeconds = Math.round(CONFIG.DESCRIPTION_REPLACE_WAIT_RANDOM_MS / 1000);
  return window.confirm(
    `出品中の商品の説明文を ${plan.targets.length}件 置き換えて保存します。\n` +
      `（対象 ${plan.total}件 / 適用済み ${plan.alreadyDone.length}件は処理しません / 対象外 ${plan.excluded.length}件）\n\n` +
      `1件ごとに ${waitBaseSeconds}〜${waitBaseSeconds + randomSeconds}秒待ちます。\n` +
      '保存した内容は元に戻せません（原本ファイルから手で戻す必要があります）。\n\n' +
      '実行しますか？'
  );
}

/**
 * 確認を取ってから置き換えを開始する
 */
async function handleStart(): Promise<void> {
  const plan = state.plan;
  if (!plan || plan.targets.length === 0) {
    showToast('処理する商品がありません。先に読み込んでください', 'warning');
    return;
  }

  if (descriptionReplaceManager.isRunning()) {
    showToast('すでに実行中です', 'warning');
    return;
  }

  const waitBaseSeconds = readWaitBaseSeconds();
  if (waitBaseSeconds === null) {
    showToast('待機秒数には 0 以上の数を入れてください', 'warning');
    return;
  }

  if (!confirmStart(plan, waitBaseSeconds)) {
    log('説明文の一括置換は確認で中止されました');
    return;
  }

  syncControls(true);

  try {
    const counts = await descriptionReplaceManager.run(plan, waitBaseSeconds, renderStatus);

    const problems = counts.skipped + counts.failed + counts.unverified;
    showToast(
      `説明文の置換が終わりました: 成功 ${counts.applied}件` +
        (problems > 0 ? `（要確認 ${problems}件）` : ''),
      problems > 0 ? 'warning' : 'success',
      CONFIG.TOAST_DURATION_MS * 2
    );
  } catch (e) {
    warn('説明文の一括置換でエラー', e);
    showToast(
      `説明文の置換でエラーが発生しました: ${e instanceof Error ? e.message : String(e)}`,
      'error',
      CONFIG.TOAST_DURATION_MS * 2
    );
  } finally {
    // 終わったら記録を反映した件数に組み直す（適用済みが増えている）
    if (state.fixed && state.originals) {
      try {
        state.plan = await buildReplacePlan(state.fixed, state.originals);
        renderSummary(state.plan);
      } catch (e) {
        warn('計画の再計算に失敗しました', e);
      }
    }
    syncControls(false);
  }
}

/**
 * 処理記録を JSON ファイルとしてダウンロードする
 */
async function handleExport(): Promise<void> {
  try {
    const json = await descriptionReplaceManager.exportRecordsJson();
    const stamp = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d+Z$/, 'Z');
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `mercari-description-replace-${stamp}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    // ダウンロードの開始を待ってから解放する
    window.setTimeout(() => URL.revokeObjectURL(url), CONFIG.TOAST_DURATION_MS);
    showToast('処理記録を出力しました', 'success');
  } catch (e) {
    warn('処理記録の出力に失敗しました', e);
    showToast('処理記録を出力できませんでした', 'error');
  }
}

/**
 * パネルを組み立てる（1 度だけ）
 * @returns パネル要素
 */
function createPanel(): HTMLDivElement {
  const panel = document.createElement('div');
  panel.id = ID_NAME.DESCRIPTION_REPLACE_PANEL;
  applyFixedStyles(panel, {
    position: 'fixed',
    top: '120px',
    left: '5px',
    zIndex: String(CONFIG.ZINDEX.CONTROL_PANEL),
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    width: '460px',
    maxWidth: 'calc(100vw - 10px)',
    padding: '1rem',
    backgroundColor: '#f8f8f8',
    borderRadius: '6px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
    fontSize: '13px',
  });

  // 見出しと閉じるボタン
  const header = document.createElement('div');
  applyFixedStyles(header, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  });

  const title = document.createElement('span');
  title.textContent = '説明文の一括置換';
  applyFixedStyles(title, { fontWeight: 'bold', fontSize: '14px', color: '#333' });

  const closeBtn = getOrCreateElement(ID_NAME.DESCRIPTION_REPLACE_CLOSE_BTN, 'button');
  closeBtn.type = 'button';
  closeBtn.textContent = '×';
  closeBtn.title = '閉じる（読み込んだデータと実行中の処理は保持されます）';
  applyFixedStyles(closeBtn, {
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

  // ファイル入力
  const fixedInput = getOrCreateElement(ID_NAME.DESCRIPTION_REPLACE_FIXED_FILE, 'input');
  fixedInput.type = 'file';
  fixedInput.accept = '.json,application/json';
  panel.appendChild(labeledRow('確定版 JSON', fixedInput));

  const originalInput = getOrCreateElement(ID_NAME.DESCRIPTION_REPLACE_ORIGINAL_FILE, 'input');
  originalInput.type = 'file';
  originalInput.accept = '.json,application/json';
  panel.appendChild(labeledRow('原本 JSON', originalInput));

  // 待機秒数
  const intervalWrap = document.createElement('span');
  applyFixedStyles(intervalWrap, { display: 'flex', alignItems: 'center', gap: '6px' });

  const intervalInput = getOrCreateElement(ID_NAME.DESCRIPTION_REPLACE_INTERVAL, 'input');
  intervalInput.type = 'number';
  intervalInput.min = '0';
  intervalInput.step = '1';
  intervalInput.value = String(Math.round(CONFIG.DESCRIPTION_REPLACE_WAIT_BASE_MS / 1000));
  applyFixedStyles(intervalInput, { width: '70px', padding: '4px' });

  const intervalHint = document.createElement('span');
  intervalHint.textContent = `秒 + 0〜${Math.round(CONFIG.DESCRIPTION_REPLACE_WAIT_RANDOM_MS / 1000)}秒のランダム`;
  applyFixedStyles(intervalHint, { color: '#555', fontSize: '12px' });

  intervalWrap.appendChild(intervalInput);
  intervalWrap.appendChild(intervalHint);
  panel.appendChild(labeledRow('1件ごとの待機', intervalWrap));

  // 件数表示
  const summary = getOrCreateElement(ID_NAME.DESCRIPTION_REPLACE_SUMMARY, 'div');
  applyFixedStyles(summary, {
    padding: '8px 10px',
    background: '#fffbe6',
    borderRadius: '4px',
    color: '#333',
    lineHeight: '1.5',
  });
  panel.appendChild(summary);

  // 操作ボタン
  const actions = document.createElement('div');
  applyFixedStyles(actions, { display: 'flex', gap: '8px', flexWrap: 'wrap' });

  const loadBtn = getOrCreateElement(ID_NAME.DESCRIPTION_REPLACE_LOAD_BTN, 'button');
  loadBtn.type = 'button';
  loadBtn.textContent = '読み込む';
  styleButton(loadBtn, 'secondary');
  loadBtn.addEventListener('click', () => void handleLoad());

  const startBtn = getOrCreateElement(ID_NAME.DESCRIPTION_REPLACE_START_BTN, 'button');
  startBtn.type = 'button';
  startBtn.textContent = '開始（確認あり）';
  styleButton(startBtn, 'primary');
  startBtn.addEventListener('click', () => void handleStart());

  const abortBtn = getOrCreateElement(ID_NAME.DESCRIPTION_REPLACE_ABORT_BTN, 'button');
  abortBtn.type = 'button';
  abortBtn.textContent = '中断';
  styleButton(abortBtn, 'secondary');
  abortBtn.addEventListener('click', () => {
    descriptionReplaceManager.requestAbort();
    showToast('中断します。処理中の1件が終わり次第止まります', 'info');
  });

  const exportBtn = getOrCreateElement(ID_NAME.DESCRIPTION_REPLACE_EXPORT_BTN, 'button');
  exportBtn.type = 'button';
  exportBtn.textContent = '結果を出力（JSON）';
  styleButton(exportBtn, 'secondary');
  exportBtn.addEventListener('click', () => void handleExport());

  actions.appendChild(loadBtn);
  actions.appendChild(startBtn);
  actions.appendChild(abortBtn);
  actions.appendChild(exportBtn);
  panel.appendChild(actions);

  // 進捗表示
  const status = getOrCreateElement(ID_NAME.DESCRIPTION_REPLACE_STATUS, 'div');
  applyFixedStyles(status, { minHeight: '1.5em', color: '#333', fontWeight: 'bold' });
  panel.appendChild(status);

  return panel;
}

/**
 * パネルを開く（既にあれば表示に切り替える）
 *
 * 読み込んだデータと実行中の処理はパネルを閉じても保持されるため、
 * 再表示時はその状態を描き直す。
 */
export function showDescriptionReplacePanel(): void {
  let panel = document.getElementById(ID_NAME.DESCRIPTION_REPLACE_PANEL);
  if (!panel || !panel.isConnected) {
    panel?.remove();
    panel = createPanel();
    document.body.appendChild(panel);
  }

  panel.style.display = 'flex';
  renderSummary(state.plan);
  syncControls(descriptionReplaceManager.isRunning());
}

/**
 * パネルの表示・非表示を切り替える
 */
export function toggleDescriptionReplacePanel(): void {
  const panel = document.getElementById(ID_NAME.DESCRIPTION_REPLACE_PANEL);
  if (panel?.isConnected && panel.style.display !== 'none') {
    panel.style.display = 'none';
    return;
  }
  showDescriptionReplacePanel();
}

/**
 * 一括操作バーに置く「説明文を一括置換」ボタンを生成する（出品中一覧のみ）
 *
 * 押してもパネルが開くだけで、保存には向かわない。
 *
 * @returns 生成したボタン
 */
export function createDescriptionReplaceButton(): HTMLButtonElement {
  const button = getOrCreateElement(ID_NAME.DESCRIPTION_REPLACE_BTN, 'button');
  button.type = 'button';
  button.textContent = '説明文を一括置換';

  applyFixedStyles(button, {
    padding: '8px 16px',
    background: '#fff',
    color: '#333',
    border: '1px solid #999',
    borderRadius: '4px',
    fontWeight: 'bold',
    cursor: 'pointer',
  });

  button.onclick = (): void => {
    toggleDescriptionReplacePanel();
  };

  return button;
}
