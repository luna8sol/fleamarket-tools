import { createIcon, IconName } from '../../../common/icons';
import { QueueMode, QueueProgress } from '../../../common/messages';
import { CONFIG, ID_NAME } from '../infra/constants';
import { buildProgress, decorateButton, decorateIconButton, renderProgress } from './components';
import { ensureTheme } from './theme';

export interface BulkBarHandlers {
  onStart: () => void;
  onStop: () => void;
  onDelete: () => void;
  /** 選択をすべて外す */
  onClear: () => void;
  /** 説明文の一括置換パネルを開く（/sell のみ。無ければボタンを出さない） */
  onReplace?: () => void;
}

/** ページ種別ごとの表示内容 */
export interface BulkBarOptions {
  /** 開始ボタンの文言 */
  startLabel: string;
  /** 開始ボタンのアイコン */
  startIcon: IconName;
  /** 件数の下に出す、何を選んでいるかの説明 */
  pageLabel: string;
}

/** モードごとの、進捗の見出しに使う名前 */
const MODE_LABEL: Record<QueueMode, string> = {
  relist: '下書きに保存',
  publish: '出品',
  delete: '削除',
  replace: '説明文の置換',
};

/** ドックとその上に出す部品（トースト・パネル）との間の余白 (px) */
const DOCK_GAP_PX = 12;

/**
 * ドックの上端から画面下端までの高さ（＋余白）を `<html>` の CSS 変数
 * `--rbl-dock-clearance` に出し続ける。トーストやパネルはこの値の上に置く。
 *
 * ドックは処理中に 2 段になって背が伸び、狭い画面では折り返すため、
 * 表示した時点で 1 回測るだけではずれる（トーストがドックに重なる）。
 */
function trackDockClearance(dock: HTMLElement): void {
  const update = (): void => {
    const rect = dock.getBoundingClientRect();
    const clearance = Math.max(24, Math.round(window.innerHeight - rect.top + DOCK_GAP_PX));
    document.documentElement.style.setProperty('--rbl-dock-clearance', `${clearance}px`);
  };
  new ResizeObserver(update).observe(dock);
  window.addEventListener('resize', update);
  update();
}

function byId<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function createButton(id: string, handler: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.id = id;
  button.addEventListener('click', handler);
  return button;
}

/**
 * 画面下中央に浮かぶ一括操作ドックを描画する。既に存在する場合は何もしない。
 */
export function renderBulkBar(options: BulkBarOptions, handlers: BulkBarHandlers): void {
  if (byId(ID_NAME.BULK_BAR)) return;
  ensureTheme();

  const dock = document.createElement('div');
  dock.id = ID_NAME.BULK_BAR;
  dock.className = 'rbl-dock rbl-scope';
  dock.setAttribute('role', 'region');
  dock.setAttribute('aria-label', 'Fleamarket Tools for Rakuma 一括操作');
  dock.dataset.empty = 'true';

  // 件数
  const lead = document.createElement('div');
  lead.className = 'rbl-dock__lead';

  const mark = document.createElement('span');
  mark.className = 'rbl-mark';
  mark.appendChild(createIcon('layers', 18));

  const stats = document.createElement('div');
  stats.className = 'rbl-dock__stats';

  const count = document.createElement('div');
  count.className = 'rbl-dock__count';
  const countNum = document.createElement('span');
  countNum.id = ID_NAME.BULK_COUNT_SPAN;
  countNum.className = 'rbl-dock__count-num rbl-num';
  countNum.textContent = '0';
  countNum.addEventListener('animationend', () => delete countNum.dataset.bump);
  const countUnit = document.createElement('span');
  countUnit.className = 'rbl-dock__count-unit';
  countUnit.textContent = '件を選択中';
  count.append(countNum, countUnit);

  const meta = document.createElement('div');
  meta.id = ID_NAME.BULK_META;
  meta.className = 'rbl-dock__meta';
  meta.textContent = `${options.pageLabel}・選んだ順に処理`;
  meta.dataset.idleText = meta.textContent;

  stats.append(count, meta);

  const clearBtn = decorateButton(createButton(ID_NAME.BULK_CLEAR_BTN, handlers.onClear), {
    label: '解除',
    variant: 'ghost',
    icon: 'close',
    size: 'sm',
  });
  clearBtn.title = '選択をすべて解除';
  clearBtn.setAttribute('aria-label', '選択をすべて解除');

  lead.append(mark, stats, clearBtn);

  const divider = document.createElement('span');
  divider.className = 'rbl-dock__divider';
  divider.setAttribute('aria-hidden', 'true');

  // 操作
  const actions = document.createElement('div');
  actions.className = 'rbl-dock__actions';

  const startBtn = decorateButton(createButton(ID_NAME.BULK_START_BTN, handlers.onStart), {
    label: options.startLabel,
    variant: 'primary',
    icon: options.startIcon,
  });
  actions.appendChild(startBtn);

  // 説明文の一括置換はパネルを開くだけ（保存には向かわない）
  if (handlers.onReplace) {
    actions.appendChild(
      decorateButton(createButton(ID_NAME.BULK_REPLACE_BTN, handlers.onReplace), {
        label: '説明文の一括置換',
        variant: 'secondary',
        icon: 'replace',
      })
    );
  }

  // 削除は取り消せないため、開始ボタンとは色も形も分ける
  actions.appendChild(
    decorateButton(createButton(ID_NAME.BULK_DELETE_BTN, handlers.onDelete), {
      label: '削除',
      variant: 'danger',
      icon: 'trash',
    })
  );

  const stopBtn = decorateButton(createButton(ID_NAME.BULK_STOP_BTN, handlers.onStop), {
    label: '停止',
    variant: 'danger-solid',
    icon: 'stop',
  });
  stopBtn.hidden = true;
  actions.appendChild(stopBtn);

  // 進捗（処理中・処理後だけ出す）
  const status = buildProgress(document.createElement('div'));
  status.id = ID_NAME.BULK_STATUS_SPAN;
  status.hidden = true;

  const dismissBtn = decorateIconButton(
    createButton(ID_NAME.BULK_DISMISS_BTN, () => {
      status.hidden = true;
    }),
    'close',
    '結果を閉じる'
  );
  status.querySelector('.rbl-progress__head')?.appendChild(dismissBtn);

  const failures = document.createElement('ul');
  failures.id = ID_NAME.BULK_FAILURES;
  failures.className = 'rbl-failures';
  failures.setAttribute('aria-label', '失敗した商品');
  status.appendChild(failures);

  dock.append(lead, divider, actions, status);
  document.body.appendChild(dock);
  trackDockClearance(dock);

  // ドックがページの末尾（ページャなど）を覆わないよう、同じ高さの余白を足す
  if (!byId(ID_NAME.DOCK_SPACER)) {
    const spacer = document.createElement('div');
    spacer.id = ID_NAME.DOCK_SPACER;
    spacer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(spacer);
  }
}

/**
 * 選択件数の表示を更新する
 */
export function updateCount(count: number): void {
  const dock = byId(ID_NAME.BULK_BAR);
  const countNum = byId(ID_NAME.BULK_COUNT_SPAN);
  if (!dock || !countNum) return;

  const next = String(count);
  if (countNum.textContent !== next) {
    countNum.textContent = next;
    // 同じ値への更新では跳ねさせない（一覧の再描画のたびに呼ばれるため）
    delete countNum.dataset.bump;
    void countNum.offsetWidth;
    countNum.dataset.bump = 'true';
  }
  dock.dataset.empty = count === 0 ? 'true' : 'false';
}

function renderFailures(list: HTMLElement, progress: QueueProgress): void {
  list.replaceChildren();
  const max = CONFIG.DOCK_MAX_FAILURES;
  for (const failure of progress.failed.slice(0, max)) {
    const li = document.createElement('li');
    const name = document.createElement('b');
    name.textContent = failure.item.title || failure.item.id;
    name.title = failure.item.title;
    const reason = document.createElement('span');
    reason.textContent = failure.reason;
    li.append(name, reason);
    list.appendChild(li);
  }
  if (progress.failed.length > max) {
    const more = document.createElement('li');
    more.className = 'rbl-failures__more';
    more.textContent = `ほか ${progress.failed.length - max}件（ホバーで一覧）`;
    list.appendChild(more);
  }
  // 全件はホバーで確認できるようにする
  list.title = progress.failed.map((f) => `${f.item.title}: ${f.reason}`).join('\n');
}

/**
 * キューの進捗に応じてドックの表示を更新する
 */
export function updateProgress(progress: QueueProgress): void {
  const dock = byId(ID_NAME.BULK_BAR);
  const status = byId(ID_NAME.BULK_STATUS_SPAN);
  const failures = byId(ID_NAME.BULK_FAILURES);
  const stopBtn = byId<HTMLButtonElement>(ID_NAME.BULK_STOP_BTN);
  const dismissBtn = byId<HTMLButtonElement>(ID_NAME.BULK_DISMISS_BTN);
  if (!dock || !status || !failures || !stopBtn || !dismissBtn) return;

  const idleButtons = [
    ID_NAME.BULK_START_BTN,
    ID_NAME.BULK_DELETE_BTN,
    ID_NAME.BULK_REPLACE_BTN,
    ID_NAME.BULK_CLEAR_BTN,
  ]
    .map((id) => byId<HTMLButtonElement>(id))
    .filter((el): el is HTMLButtonElement => el !== null);

  dock.dataset.running = progress.running ? 'true' : 'false';
  const meta = byId(ID_NAME.BULK_META);
  if (meta) {
    meta.textContent = progress.running
      ? '終わるまでこのタブを開いたままにしてください'
      : (meta.dataset.idleText ?? '');
  }
  for (const button of idleButtons) button.hidden = progress.running;
  stopBtn.hidden = !progress.running;
  dismissBtn.hidden = progress.running;

  if (progress.total === 0) {
    status.hidden = true;
    return;
  }
  status.hidden = false;

  const mode = MODE_LABEL[progress.mode];
  const counter = `${progress.done} / ${progress.total}`;
  const ratio = progress.done / progress.total;
  const failed = progress.failed.length;

  if (progress.running) {
    renderProgress(status, {
      tone: 'active',
      label: progress.current
        ? `${mode}中 — ${progress.done + 1}件目`
        : `${mode}中 — 次の商品まで待機しています`,
      detail: progress.current?.title,
      counter,
      ratio,
    });
  } else if (progress.haltedReason) {
    renderProgress(status, {
      tone: 'danger',
      icon: 'error',
      label: `${mode}を止めました`,
      detail: progress.haltedReason,
      counter,
      ratio,
    });
  } else if (progress.done >= progress.total) {
    renderProgress(status, {
      tone: failed > 0 ? 'warning' : 'success',
      icon: failed > 0 ? 'warning' : 'success',
      label: failed > 0 ? `${mode}が完了 — 要確認 ${failed}件` : `${mode}がすべて完了しました`,
      counter: `${progress.total}件`,
      ratio: 1,
    });
  } else {
    renderProgress(status, {
      tone: 'idle',
      icon: 'stop',
      label: `${mode}を途中で停止しました`,
      counter,
      ratio,
    });
  }

  renderFailures(failures, progress);
}
