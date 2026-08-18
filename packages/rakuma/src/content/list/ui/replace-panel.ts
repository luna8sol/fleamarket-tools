import { createIcon, IconName } from '../../../common/icons';
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
import { buildProgress, decorateButton, decorateIconButton, renderProgress } from './components';
import { confirmAction } from './confirm-dialog';
import { showToast } from './notification';
import { ensureTheme } from './theme';
import {
  createReplacePanelParts,
  downloadJson,
  fileStamp,
  readSelectedFile,
  SummarySpec,
} from '@fleamarket/core/replace-panel-parts';

/**
 * 説明文の一括置換パネル（/sell のみ）。
 *
 * 確定版と原本の JSON を読み込み、件数を確かめ、確認を取ってから Background のキューに積む。
 * 1 件ずつの書き換えと保存は Background が開く編集ページ側（content-form）が行う。
 *
 * **「読み込む」だけでは 1 件も保存しない。** 保存に向かうのは「開始」を押して
 * 確認ダイアログで承諾したあとだけ。実行中は入力欄を触れなくし、「停止」でいつでも止められる。
 */

/** 共有部品（クラス接頭辞 `rbl` とこの拡張のアイコンを渡す） */
const parts = createReplacePanelParts<IconName>({ prefix: 'rbl', createIcon });

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

function byId<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

/** 実行中かどうかで入力欄とボタンの有効・無効を切り替える */
function syncControls(): void {
  const running = state.running;
  const hasTargets = (state.plan?.targets.length ?? 0) > 0;
  const set = (id: string, disabled: boolean): void => {
    const el = byId<HTMLInputElement | HTMLButtonElement>(id);
    if (!el) return;
    el.disabled = disabled;
    // ファイル選択は label で包んでいるので、見た目は label 側で切り替える
    const file = el.closest<HTMLElement>('label.rbl-file');
    if (file) file.dataset.disabled = disabled ? 'true' : 'false';
  };
  set(ID_NAME.REPLACE_FINAL_FILE, running);
  set(ID_NAME.REPLACE_ORIGINAL_FILE, running);
  set(ID_NAME.REPLACE_WAIT_INPUT, running);
  set(ID_NAME.REPLACE_LOAD_BTN, running);
  set(ID_NAME.REPLACE_START_BTN, running || !hasTargets);
  set(ID_NAME.REPLACE_STOP_BTN, !running);
}

/** 手順の見出しに「済み」の印を付ける */
function markSection(id: string, done: boolean): void {
  const section = byId(id);
  if (section) section.dataset.done = done ? 'true' : 'false';
}

/** 件数と対象外の内訳の表示（文言と商品IDの出し方はこの拡張のもの） */
const SUMMARY_SPEC: SummarySpec<IconName> = {
  emptyText: '確定版と原本の JSON を選ぶと、処理する件数をここに出します。',
  emptyIcon: 'fileJson',
  emptyIconSize: 18,
  tileLabels: {
    targets: 'これから処理',
    total: '確定版の件数',
    alreadyDone: '適用済み',
    excluded: '対象外',
  },
  exclusionsHead: (count) => `対象外 ${count}件（処理しません）`,
  // 32 桁の商品IDは先頭 8 桁だけ出し、全体は title で読めるようにする
  formatExclusionId: (id) => ({ text: id.slice(0, 8), title: id }),
  maxExclusionLines: 5,
};

function renderSummary(plan: ReplacePlan | null): void {
  const summary = byId<HTMLDivElement>(ID_NAME.REPLACE_SUMMARY);
  if (!summary) return;
  markSection(`${ID_NAME.REPLACE_PANEL}-step1`, plan !== null);
  markSection(`${ID_NAME.REPLACE_PANEL}-step3`, plan !== null);
  parts.renderPlanSummary(summary, plan, SUMMARY_SPEC);
}

/** 結果種別ごとの件数を丸いバッジで並べる */
function renderCounts(counts: ReplaceCounts | undefined): void {
  const wrap = byId(ID_NAME.REPLACE_COUNTS);
  if (!wrap) return;
  wrap.replaceChildren();
  if (!counts) return;
  parts.renderOutcomeBadges(wrap, counts);
}

/**
 * キューの進捗をパネルに表示する。
 * 商品名が長いと 1 行に収まらないため、見出しと商品名を行で分ける。
 */
export function renderReplaceProgress(progress: QueueProgress): void {
  if (progress.mode !== 'replace') return;
  // パネルが閉じていても実行中かどうかは追従させる（開いたときに「開始」を押せないように）
  state.running = progress.running;
  const status = byId<HTMLDivElement>(ID_NAME.REPLACE_STATUS);
  if (!status) return;

  status.hidden = progress.total === 0;
  const counter = `${progress.done} / ${progress.total}`;
  const ratio = progress.total > 0 ? progress.done / progress.total : 0;
  if (progress.haltedReason) {
    renderProgress(status, {
      tone: 'danger',
      icon: 'error',
      label: '停止しました',
      detail: progress.haltedReason,
      counter,
      ratio,
    });
  } else if (progress.running) {
    renderProgress(status, {
      tone: 'active',
      label: progress.current ? `置換中 — ${progress.done + 1}件目` : '次の商品まで待機しています',
      detail: progress.current?.title,
      counter,
      ratio,
    });
  } else if (progress.total > 0 && progress.done >= progress.total) {
    const needsReview = progress.failed.length > 0;
    renderProgress(status, {
      tone: needsReview ? 'warning' : 'success',
      icon: needsReview ? 'warning' : 'success',
      label: needsReview ? `置換が完了 — 要確認 ${progress.failed.length}件` : '置換が完了しました',
      counter: `${progress.total}件`,
      ratio: 1,
    });
  } else {
    renderProgress(status, {
      tone: 'idle',
      icon: 'stop',
      label: `中断しました（${progress.done}件まで処理）`,
      counter,
      ratio,
    });
  }
  status.title = progress.failed.map((f) => `${f.item.title}: ${f.reason}`).join('\n');
  renderCounts(progress.replaceCounts);

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
  return parseDescriptionEntries(await readSelectedFile(input, label), label);
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
function confirmStart(plan: ReplacePlan, waitBaseSeconds: number): Promise<boolean> {
  const maxWait = waitBaseSeconds + CONFIG.REPLACE_WAIT_RANDOM_SECONDS;
  return confirmAction({
    tone: 'primary',
    icon: 'replace',
    title: `説明文を${plan.targets.length}件置き換えて保存します`,
    message:
      '出品中の商品の編集ページを 1 件ずつ開き、原本と一致することを確かめてから確定版に書き換えて保存します。適用済みの商品は開きません。',
    facts: [
      { label: 'これから処理', value: `${plan.targets.length}件`, emphasis: true },
      { label: '適用済み', value: `${plan.alreadyDone.length}件` },
      { label: '対象外', value: `${plan.excluded.length}件` },
      { label: '1件ごとの待機', value: `${waitBaseSeconds}〜${maxWait}秒` },
    ],
    items: plan.targets.map((item) => item.title),
    note: '保存した内容は元に戻せません（原本ファイルから手で戻す必要があります）。',
    confirmLabel: `${plan.targets.length}件を置換`,
  });
}

async function handleStart(handlers: ReplacePanelHandlers): Promise<void> {
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
  if (!(await confirmStart(plan, waitBaseSeconds))) {
    log('説明文の一括置換は確認で中止されました');
    return;
  }
  // 確認の間に別の経路で実行が始まっていたら積まない（二重に積むと Background が断る）
  if (state.running) {
    showToast('すでに実行中です', 'warning');
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
    // ダウンロードの開始を待ってから URL を解放する
    downloadJson(
      json,
      `rakuma-description-replace-${fileStamp(new Date())}.json`,
      CONFIG.TOAST_DURATION_MS
    );
    showToast(`処理記録を出力しました（${records.length}件）`, 'success');
  } catch (e) {
    warn('処理記録の出力に失敗しました', e);
    showToast('処理記録を出力できませんでした', 'error');
  }
}

function section(id: string, step: number, title: string): HTMLElement {
  return parts.buildSection({ id, step, title });
}

/** ファイル選択（label の中に透明な input を重ね、選んだファイル名を出す） */
function filePicker(
  id: string,
  label: string,
  hint: string,
  onPicked: () => void
): HTMLLabelElement {
  const input = document.createElement('input');
  input.id = id;
  input.type = 'file';
  input.accept = '.json,application/json';
  return parts.buildFileField({ input, label, emptyText: hint, onChange: onPicked });
}

function createPanel(handlers: ReplacePanelHandlers): HTMLDivElement {
  ensureTheme();

  const panel = document.createElement('div');
  panel.id = ID_NAME.REPLACE_PANEL;
  panel.className = 'rbl-panel rbl-scope';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-labelledby', `${ID_NAME.REPLACE_PANEL}-title`);

  const close = (): void => {
    panel.hidden = true;
  };

  // 見出し
  const head = document.createElement('div');
  head.className = 'rbl-panel__head';
  const mark = document.createElement('span');
  mark.className = 'rbl-mark rbl-mark--sm';
  mark.appendChild(createIcon('replace', 15));
  const titles = document.createElement('div');
  titles.className = 'rbl-panel__titles';
  const title = document.createElement('h2');
  title.id = `${ID_NAME.REPLACE_PANEL}-title`;
  title.className = 'rbl-panel__title';
  title.textContent = '説明文の一括置換';
  const subtitle = document.createElement('p');
  subtitle.className = 'rbl-panel__subtitle';
  subtitle.textContent = '出品中の商品の説明文を 1 件ずつ書き換えて保存します';
  titles.append(title, subtitle);
  const closeBtn = document.createElement('button');
  closeBtn.id = ID_NAME.REPLACE_CLOSE_BTN;
  decorateIconButton(closeBtn, 'close', '閉じる（読み込んだデータと実行中の処理は保持されます）');
  closeBtn.addEventListener('click', close);
  head.append(mark, titles, closeBtn);

  const body = document.createElement('div');
  body.className = 'rbl-panel__body';

  // ① データ
  const step1 = section(`${ID_NAME.REPLACE_PANEL}-step1`, 1, 'データを選ぶ');
  const autoLoad = (): void => {
    const finals = byId<HTMLInputElement>(ID_NAME.REPLACE_FINAL_FILE)?.files?.length;
    const originals = byId<HTMLInputElement>(ID_NAME.REPLACE_ORIGINAL_FILE)?.files?.length;
    // 両方そろった時点で読み込む（読み込みだけでは何も保存しない）
    if (finals && originals) void handleLoad();
  };
  const files = document.createElement('div');
  files.className = 'rbl-field-row';
  files.append(
    filePicker(ID_NAME.REPLACE_FINAL_FILE, '確定版 JSON', '置き換え後の本文', autoLoad),
    filePicker(ID_NAME.REPLACE_ORIGINAL_FILE, '原本 JSON', '取得時点の本文', autoLoad)
  );
  const loadBtn = decorateButton(document.createElement('button'), {
    label: '読み込み直す',
    variant: 'ghost',
    icon: 'upload',
    size: 'sm',
  });
  loadBtn.id = ID_NAME.REPLACE_LOAD_BTN;
  loadBtn.title = '同じファイルを選び直さずに、もう一度読み込んで件数を数え直します';
  loadBtn.addEventListener('click', () => void handleLoad());
  const loadRow = document.createElement('div');
  loadRow.className = 'rbl-actions';
  const loadHint = document.createElement('span');
  loadHint.className = 'rbl-inline-field__hint';
  loadHint.textContent = '形式: [{ id, name, desc }]（id はラクマの商品ID）';
  loadRow.append(
    loadHint,
    Object.assign(document.createElement('span'), { className: 'rbl-spacer' }),
    loadBtn
  );
  step1.append(files, loadRow);

  // ② 待機
  const step2 = section(`${ID_NAME.REPLACE_PANEL}-step2`, 2, '間隔を決める');
  const waitInput = document.createElement('input');
  waitInput.id = ID_NAME.REPLACE_WAIT_INPUT;
  step2.appendChild(
    parts.buildWaitField({
      input: waitInput,
      min: CONFIG.REPLACE_WAIT_MIN_SECONDS,
      value: CONFIG.REPLACE_WAIT_BASE_SECONDS,
      hint: `下限 ${CONFIG.REPLACE_WAIT_MIN_SECONDS} 秒。これに 0〜${CONFIG.REPLACE_WAIT_RANDOM_SECONDS} 秒のランダム分を足します`,
      // ラベルは label[for] で入力欄に結び付ける
      labelFor: true,
      wrapTag: 'span',
    })
  );
  // 既定値が入っているので最初から済みにする（まだ DOM に無いので ID では探せない）
  step2.dataset.done = 'true';

  // ③ 確認
  const step3 = section(`${ID_NAME.REPLACE_PANEL}-step3`, 3, '件数を確かめる');
  const summary = document.createElement('div');
  summary.id = ID_NAME.REPLACE_SUMMARY;
  summary.className = 'rbl-section';
  step3.appendChild(summary);

  // ④ 実行
  const step4 = section(`${ID_NAME.REPLACE_PANEL}-step4`, 4, '実行する');
  const actions = document.createElement('div');
  actions.className = 'rbl-actions';
  const startBtn = decorateButton(document.createElement('button'), {
    label: '開始',
    variant: 'primary',
    icon: 'play',
  });
  startBtn.id = ID_NAME.REPLACE_START_BTN;
  startBtn.addEventListener('click', () => void handleStart(handlers));
  const stopBtn = decorateButton(document.createElement('button'), {
    label: '停止',
    variant: 'secondary',
    icon: 'stop',
  });
  stopBtn.id = ID_NAME.REPLACE_STOP_BTN;
  stopBtn.addEventListener('click', () => {
    handlers.onStop();
    state.running = false;
    syncControls();
  });
  const exportBtn = decorateButton(document.createElement('button'), {
    label: '結果を出力',
    variant: 'ghost',
    icon: 'download',
  });
  exportBtn.id = ID_NAME.REPLACE_EXPORT_BTN;
  exportBtn.title = 'これまでの処理記録を JSON でダウンロードします';
  exportBtn.addEventListener('click', () => void handleExport());
  const spacer = document.createElement('span');
  spacer.className = 'rbl-spacer';
  actions.append(startBtn, stopBtn, spacer, exportBtn);

  const run = document.createElement('div');
  run.className = 'rbl-run';
  const status = buildProgress(document.createElement('div'));
  status.id = ID_NAME.REPLACE_STATUS;
  status.hidden = true;
  const counts = document.createElement('div');
  counts.id = ID_NAME.REPLACE_COUNTS;
  counts.className = 'rbl-badges';
  run.append(status, counts);
  step4.append(actions, run);

  body.append(step1, step2, step3, step4);
  panel.append(head, body);

  // パネルの中で Esc を押したら閉じる（実行中の処理は止めない）
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  });

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
  panel.hidden = false;
}
