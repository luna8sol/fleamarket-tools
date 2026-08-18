import { CONFIG, ID_NAME } from '../infra/constants';
import { log, warn } from '../infra/logger';
import {
  DescriptionEntry,
  DescriptionReplacePlan,
  DescriptionReplaceProgress,
} from '../infra/types';
import { buildReplacePlan, parseDescriptionEntries } from '../logic/description-replace-data';
import { descriptionReplaceManager } from '../logic/description-replace-manager';
import { getOrCreateElement } from './bulk-bar-core';
import { showToast } from './notification';
import {
  buildProgress,
  decorateButton,
  decorateIconButton,
  ProgressView,
  updateProgress,
} from './components';
import { confirmAction } from './confirm-dialog';
import { createIcon, IconName } from './icons';
import { ensureTheme } from './theme';
import {
  createReplacePanelParts,
  downloadJson,
  fileStamp,
  SummarySpec,
} from '@fleamarket/core/replace-panel-parts';

/**
 * 説明文の一括置換パネル（出品中一覧のみ）。
 *
 * 確定版と原本の JSON を読み込み、件数を確かめ、確認を取ってから 1 件ずつ置き換えます。
 *
 * **「読み込む」だけでは 1 件も保存しません。** 保存に向かうのは「開始」を押して
 * 確認ダイアログで承諾したあとだけです。実行中は入力欄を触れなくし、
 * 「中断」でいつでも止められます。
 */

/** 読み込み済みのデータと計画（パネルを閉じても保持する） */
interface PanelState {
  fixed: DescriptionEntry[] | null;
  originals: DescriptionEntry[] | null;
  plan: DescriptionReplacePlan | null;
}

const state: PanelState = { fixed: null, originals: null, plan: null };

/** 共有部品（クラス接頭辞 `mdp` とこの拡張のアイコンを渡す） */
const parts = createReplacePanelParts<IconName>({ prefix: 'mdp', createIcon });

/**
 * ファイルを選ぶ欄を作る（ラベル全体を押せる大きな的にする）
 *
 * 選んだファイル名は欄の title にも出す。
 *
 * @param input ファイル入力欄
 * @param labelText 欄の名前
 * @returns 欄の要素
 */
function fileField(input: HTMLInputElement, labelText: string): HTMLLabelElement {
  return parts.buildFileField({
    input,
    label: labelText,
    emptyText: '未選択',
    titleFromFile: true,
  });
}

/**
 * 番号付きの見出しを持つまとまりを作る（見出しの文字は span で包む）
 *
 * @param step 手順の番号
 * @param titleText 見出し
 * @returns まとまりの要素
 */
function section(step: number, titleText: string): HTMLElement {
  return parts.buildSection({ step, title: titleText, wrapTitle: true });
}

/**
 * 一括操作バーの「説明文を一括置換」ボタンに、パネルの開閉状態を伝える
 *
 * @param expanded パネルが開いているか
 */
function setPanelExpanded(expanded: boolean): void {
  document
    .getElementById(ID_NAME.DESCRIPTION_REPLACE_BTN)
    ?.setAttribute('aria-expanded', expanded ? 'true' : 'false');
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

  for (const input of [fixedInput, originalInput]) {
    if (!input) continue;
    input.disabled = running;
    const field = input.closest<HTMLElement>('label');
    if (field) field.dataset.disabled = running ? 'true' : 'false';
  }
  if (intervalInput) intervalInput.disabled = running;
  if (loadBtn) loadBtn.disabled = running;
  if (startBtn) startBtn.disabled = running || !hasTargets;
  if (abortBtn) abortBtn.disabled = !running;
}

/** 件数と対象外の内訳の表示（文言と商品IDの出し方はこの拡張のもの） */
const SUMMARY_SPEC: SummarySpec<IconName> = {
  emptyText:
    '確定版と原本の JSON を選んで「読み込む」を押してください。読み込むだけでは保存しません。',
  emptyIcon: 'info',
  emptyIconSize: 16,
  tileLabels: {
    targets: 'これから処理',
    total: '対象',
    alreadyDone: '適用済み',
    excluded: '対象外',
  },
  exclusionsHead: (count) => `対象外の内訳（${count}件）`,
  // 商品IDは短いのでそのまま出す
  formatExclusionId: (id) => ({ text: id }),
  maxExclusionLines: 5,
};

/**
 * 計画の件数をパネルに表示する
 * @param plan 実行計画。null なら未読み込みの表示にする
 */
function renderSummary(plan: DescriptionReplacePlan | null): void {
  const summary = byId<HTMLDivElement>(ID_NAME.DESCRIPTION_REPLACE_SUMMARY);
  if (!summary) return;
  parts.renderPlanSummary(summary, plan, SUMMARY_SPEC);
}

/**
 * 進捗を 2 行の文言にする
 *
 * 1 行目に何件目・何をしているか、2 行目に結果種別ごとの内訳を `[ ]` で囲んで出す。
 * 商品名が長いと 1 行に収まらず、内訳がどこから始まるのか読み取れなくなるため行を分ける。
 *
 * @param progress 進捗
 * @returns 表示用の文言（改行区切りの 2 行）
 */
export function formatReplaceProgress(progress: DescriptionReplaceProgress): string {
  const { counts } = progress;
  const breakdown =
    `[成功 ${counts.applied} / 適用済み ${counts.already} / スキップ ${counts.skipped}` +
    ` / 失敗 ${counts.failed} / 未確認 ${counts.unverified}]`;

  return `${formatReplaceHeadline(progress)}\n${breakdown}`;
}

/**
 * 進捗の 1 行目（何件目・何をしているか）を作る
 *
 * @param progress 進捗
 * @returns 表示用の文言
 */
function formatReplaceHeadline(progress: DescriptionReplaceProgress): string {
  const { current, total } = progress;

  switch (progress.phase) {
    case 'done':
      return `置換完了: ${total}件`;
    case 'aborted':
      return `中断しました: ${current}/${total}件まで処理`;
    case 'halted':
      return `停止しました: ${progress.message ?? '理由不明'}（${current}/${total}件）`;
    case 'waiting':
      return `${current}/${total}件 完了 — 次まで ${progress.remainingSeconds ?? 0}秒`;
    default:
      return `置換中 ${current}/${total}件 ${progress.itemName ?? ''}`.trimEnd();
  }
}

/**
 * 進捗を表示の割合・色調に直す
 *
 * 処理中の 1 件はまだ終わっていないので割合に含めない（current - 1）。
 *
 * @param progress 進捗
 * @returns 表示内容（文言を除く）
 */
function toReplaceView(progress: DescriptionReplaceProgress): Omit<ProgressView, 'label'> {
  const total = Math.max(progress.total, 1);
  const { counts } = progress;
  const problems = counts.skipped + counts.failed + counts.unverified;

  switch (progress.phase) {
    case 'done':
      return {
        ratio: 1,
        tone: problems > 0 ? 'warning' : 'success',
        icon: problems > 0 ? 'warning' : 'success',
      };
    case 'aborted':
      return { ratio: progress.current / total, tone: 'warning', icon: 'stop' };
    case 'halted':
      return { ratio: progress.current / total, tone: 'danger', icon: 'error' };
    case 'waiting':
      return { ratio: progress.current / total, tone: 'active', icon: 'clock' };
    default:
      return { ratio: (progress.current - 1) / total, tone: 'active' };
  }
}

/**
 * 進捗をパネルに表示する
 * @param progress 進捗
 */
function renderStatus(progress: DescriptionReplaceProgress): void {
  const status = byId<HTMLDivElement>(ID_NAME.DESCRIPTION_REPLACE_STATUS);
  if (!status) return;

  let bar = status.querySelector<HTMLElement>('.mdp-progress');
  let badges = status.querySelector<HTMLElement>('.mdp-badges');
  if (!bar || !badges) {
    bar = buildProgress(document.createElement('div'));
    badges = document.createElement('div');
    badges.className = 'mdp-badges';
    status.replaceChildren(bar, badges);
  }

  updateProgress(bar, { label: formatReplaceHeadline(progress), ...toReplaceView(progress) });

  parts.renderOutcomeBadges(badges, progress.counts);
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
function confirmStart(plan: DescriptionReplacePlan, waitBaseSeconds: number): Promise<boolean> {
  const randomSeconds = Math.round(CONFIG.DESCRIPTION_REPLACE_WAIT_RANDOM_MS / 1000);
  const count = plan.targets.length;
  const waitMinutes = Math.ceil(((count - 1) * (waitBaseSeconds + randomSeconds / 2)) / 60);

  return confirmAction({
    title: `説明文を${count}件置き換えて保存します`,
    message:
      '出品中の商品の説明欄を、確定版の本文で上書きします。\n' +
      `適用済み ${plan.alreadyDone.length}件・対象外 ${plan.excluded.length}件は処理しません。`,
    facts: [
      { label: '置き換える件数', value: `${count}件`, emphasis: true },
      { label: '1件ごとの間隔', value: `${waitBaseSeconds}〜${waitBaseSeconds + randomSeconds}秒` },
      { label: '待機の合計（目安）', value: count > 1 ? `約${waitMinutes}分` : 'なし' },
    ],
    items: plan.targets.map(({ entry }) => entry.name || entry.id),
    maxItems: 8,
    note: '保存した内容は元に戻せません（原本ファイルから手で戻す必要があります）。',
    confirmLabel: `${count}件を置き換える`,
    tone: 'danger',
    icon: 'fileText',
  });
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

  if (!(await confirmStart(plan, waitBaseSeconds))) {
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
    // ダウンロードの開始を待ってから URL を解放する
    downloadJson(
      json,
      `mercari-description-replace-${fileStamp(new Date())}.json`,
      CONFIG.TOAST_DURATION_MS
    );
    showToast('処理記録を出力しました', 'success');
  } catch (e) {
    warn('処理記録の出力に失敗しました', e);
    showToast('処理記録を出力できませんでした', 'error');
  }
}

/**
 * パネル用のボタンを作る
 *
 * @param id 要素ID
 * @param label 文言
 * @param variant 種類
 * @param icon アイコン
 * @param onClick 押したときの処理
 * @returns ボタン
 */
function panelButton(
  id: string,
  label: string,
  variant: 'primary' | 'secondary' | 'ghost',
  icon: IconName,
  onClick: () => void
): HTMLButtonElement {
  const button = decorateButton(getOrCreateElement(id, 'button'), {
    label,
    variant,
    icon,
    size: 'sm',
  });
  button.addEventListener('click', onClick);
  return button;
}

/**
 * 待機秒数の入力欄を組み立てる
 *
 * @returns 1 行分の要素
 */
function createIntervalRow(): HTMLDivElement {
  const intervalInput = getOrCreateElement(ID_NAME.DESCRIPTION_REPLACE_INTERVAL, 'input');
  intervalInput.type = 'number';
  intervalInput.min = '0';
  intervalInput.step = '1';
  intervalInput.inputMode = 'numeric';
  intervalInput.value = String(Math.round(CONFIG.DESCRIPTION_REPLACE_WAIT_BASE_MS / 1000));
  intervalInput.setAttribute('aria-label', '1件ごとの待機（秒）');

  const row = document.createElement('div');
  row.className = 'mdp-inline-field';

  const text = document.createElement('div');
  const label = document.createElement('div');
  label.className = 'mdp-inline-field__label';
  label.textContent = '1件ごとの待機';
  const hint = document.createElement('div');
  hint.className = 'mdp-inline-field__hint';
  hint.textContent = `さらに 0〜${Math.round(CONFIG.DESCRIPTION_REPLACE_WAIT_RANDOM_MS / 1000)}秒をランダムに足します`;
  text.append(label, hint);

  const wrap = document.createElement('label');
  wrap.className = 'mdp-number';
  wrap.append(intervalInput, '秒');

  row.append(text, wrap);
  return row;
}

/**
 * パネルの見出し（アイコン・題名・閉じるボタン）を組み立てる
 *
 * @param panel パネル要素
 * @returns 見出しの要素
 */
function createPanelHeader(panel: HTMLElement): HTMLDivElement {
  const header = document.createElement('div');
  header.className = 'mdp-panel__head';

  const tile = document.createElement('span');
  tile.className = 'mdp-icon-tile';
  tile.appendChild(createIcon('fileText', 18));

  const titles = document.createElement('div');
  titles.className = 'mdp-panel__titles';

  const title = document.createElement('h2');
  title.id = `${ID_NAME.DESCRIPTION_REPLACE_PANEL}-title`;
  title.className = 'mdp-panel__title';
  title.textContent = '説明文の一括置換';

  const subtitle = document.createElement('p');
  subtitle.className = 'mdp-panel__subtitle';
  subtitle.textContent = '確定版の本文で、出品中の説明欄を 1 件ずつ上書きします';

  titles.append(title, subtitle);

  const closeBtn = decorateIconButton(
    getOrCreateElement(ID_NAME.DESCRIPTION_REPLACE_CLOSE_BTN, 'button'),
    'close',
    '閉じる（読み込んだデータと実行中の処理は保持されます）'
  );
  closeBtn.addEventListener('click', () => {
    panel.style.display = 'none';
    setPanelExpanded(false);
  });

  header.append(tile, titles, closeBtn);
  return header;
}

/**
 * パネルを組み立てる（1 度だけ）
 *
 * 「ファイルを選ぶ → 件数を確かめる → 実行する」の 3 段に分ける。
 * 上から順にたどれば、件数を見ないまま開始に進むことがない並びにしている。
 *
 * @returns パネル要素
 */
function createPanel(): HTMLDivElement {
  ensureTheme();

  const panel = document.createElement('div');
  panel.id = ID_NAME.DESCRIPTION_REPLACE_PANEL;
  panel.className = 'mdp-panel mdp-scope';
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-labelledby', `${ID_NAME.DESCRIPTION_REPLACE_PANEL}-title`);

  const body = document.createElement('div');
  body.className = 'mdp-panel__body';

  // 1. ファイルと待機秒数
  const filesSection = section(1, 'ファイルを選ぶ');

  const fixedInput = getOrCreateElement(ID_NAME.DESCRIPTION_REPLACE_FIXED_FILE, 'input');
  fixedInput.type = 'file';
  fixedInput.accept = '.json,application/json';

  const originalInput = getOrCreateElement(ID_NAME.DESCRIPTION_REPLACE_ORIGINAL_FILE, 'input');
  originalInput.type = 'file';
  originalInput.accept = '.json,application/json';

  const files = document.createElement('div');
  files.className = 'mdp-field-row';
  files.append(fileField(fixedInput, '確定版 JSON'), fileField(originalInput, '原本 JSON'));

  const loadActions = document.createElement('div');
  loadActions.className = 'mdp-actions';
  loadActions.appendChild(
    panelButton(ID_NAME.DESCRIPTION_REPLACE_LOAD_BTN, '読み込む', 'secondary', 'upload', () => {
      void handleLoad();
    })
  );

  filesSection.append(files, createIntervalRow(), loadActions);

  // 2. 件数の確認
  const summarySection = section(2, '件数を確かめる');
  const summary = getOrCreateElement(ID_NAME.DESCRIPTION_REPLACE_SUMMARY, 'div');
  summary.setAttribute('aria-live', 'polite');
  summarySection.appendChild(summary);

  // 3. 実行
  const runSection = section(3, '実行する');

  const actions = document.createElement('div');
  actions.className = 'mdp-actions';

  const startBtn = panelButton(
    ID_NAME.DESCRIPTION_REPLACE_START_BTN,
    '開始（確認あり）',
    'primary',
    'play',
    () => void handleStart()
  );
  const abortBtn = panelButton(
    ID_NAME.DESCRIPTION_REPLACE_ABORT_BTN,
    '中断',
    'secondary',
    'stop',
    () => {
      descriptionReplaceManager.requestAbort();
      showToast('中断します。処理中の1件が終わり次第止まります', 'info');
    }
  );
  const spacer = document.createElement('span');
  spacer.className = 'mdp-spacer';
  const exportBtn = panelButton(
    ID_NAME.DESCRIPTION_REPLACE_EXPORT_BTN,
    '結果を出力（JSON）',
    'ghost',
    'download',
    () => void handleExport()
  );

  actions.append(startBtn, abortBtn, spacer, exportBtn);

  // 進捗表示（最初の進捗が届くまでは空のまま隠れる）
  const status = getOrCreateElement(ID_NAME.DESCRIPTION_REPLACE_STATUS, 'div');
  status.className = 'mdp-run';

  runSection.append(actions, status);

  body.append(filesSection, summarySection, runSection);
  panel.append(createPanelHeader(panel), body);

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
  setPanelExpanded(true);
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
    setPanelExpanded(false);
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
  const button = decorateButton(getOrCreateElement(ID_NAME.DESCRIPTION_REPLACE_BTN, 'button'), {
    label: '説明文を一括置換',
    variant: 'secondary',
    icon: 'fileText',
  });
  button.setAttribute('aria-controls', ID_NAME.DESCRIPTION_REPLACE_PANEL);
  button.setAttribute('aria-expanded', 'false');

  button.onclick = (): void => {
    toggleDescriptionReplacePanel();
  };

  return button;
}
