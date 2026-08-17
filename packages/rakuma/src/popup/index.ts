import { createIcon, isIconName } from '../common/icons';
import { warn } from '../common/logger';
import { MessageType, QueueMode, QueueProgress } from '../common/messages';
import { sendToRuntime } from '../common/send-message';
import {
  applyThemePreference,
  buildTokenCss,
  loadThemePreference,
  saveThemePreference,
  ThemePreference,
} from '../common/theme';

/**
 * Popup のエントリポイント。
 *
 * - 処理の状況（Background の進捗）を出し続ける
 * - 一覧ページ（/sell・/draft）への導線
 * - 配色（自動 / ライト / ダーク）の切り替え。一覧ページへ注入する UI にも効く
 *
 * このスクリプトは popup.html の head で同期的に読み込む。トークンと配色の属性を
 * 描画前に入れて、開いた瞬間に白く光るのを避けるため。DOM の組み立ては DOMContentLoaded で行う。
 */

/** 進捗を取り直す間隔 (ms)。popup を開いている間だけ動く */
const POLL_INTERVAL_MS = 1500;

/** chrome.storage は非同期なので、描画前に当てる配色は localStorage にも控えておく */
const THEME_CACHE_KEY = 'rbl-theme-cache';

const MODE_LABEL: Record<QueueMode, string> = {
  relist: '下書きに保存',
  publish: '出品',
  delete: '削除',
  replace: '説明文の置換',
};

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'auto' || value === 'light' || value === 'dark';
}

function readThemeCache(): ThemePreference {
  try {
    const value = window.localStorage.getItem(THEME_CACHE_KEY);
    return isThemePreference(value) ? value : 'auto';
  } catch {
    return 'auto';
  }
}

function writeThemeCache(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_CACHE_KEY, preference);
  } catch {
    // 控えが書けなくても、次に開いたときに一瞬だけ既定の配色になるだけ
  }
}

// 描画前: トークンと配色
const style = document.createElement('style');
style.textContent = buildTokenCss();
document.head.appendChild(style);
applyThemePreference(readThemeCache());

function byId<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

/** data-icon の付いた要素へアイコンを入れる */
function renderIcons(): void {
  document.querySelectorAll<HTMLElement>('[data-icon]').forEach((el) => {
    const name = el.dataset.icon;
    if (!isIconName(name)) {
      warn(`未定義のアイコン名です: ${name}`);
      return;
    }
    const size = Number(el.dataset.iconSize ?? '16');
    const icon = createIcon(name, size);
    icon.classList.add('icon');
    el.replaceChildren(icon);
  });
}

interface StatusView {
  tone: 'idle' | 'active' | 'success' | 'warning' | 'danger';
  title: string;
  count?: string;
  detail?: string;
  ratio?: number;
}

function toStatusView(progress: QueueProgress | undefined): StatusView {
  if (!progress || progress.total === 0) {
    return {
      tone: 'idle',
      title: '処理は動いていません',
      detail: '一覧ページで商品を選び、画面下のバーから始めます',
    };
  }
  const mode = MODE_LABEL[progress.mode];
  const count = `${progress.done} / ${progress.total}`;
  const ratio = progress.done / progress.total;
  const failed = progress.failed.length;

  if (progress.running) {
    return {
      tone: 'active',
      title: `${mode}中`,
      count,
      detail: progress.current?.title ?? '次の商品まで待機しています',
      ratio,
    };
  }
  if (progress.haltedReason) {
    return {
      tone: 'danger',
      title: `${mode}を止めました`,
      count,
      detail: progress.haltedReason,
      ratio,
    };
  }
  if (progress.done >= progress.total) {
    return {
      tone: failed > 0 ? 'warning' : 'success',
      title: failed > 0 ? `${mode}が完了 — 要確認 ${failed}件` : `${mode}がすべて完了しました`,
      count: `${progress.total}件`,
      detail: failed > 0 ? '失敗した商品は一覧ページのバーで確認できます' : undefined,
      ratio: 1,
    };
  }
  return { tone: 'idle', title: `${mode}を途中で停止しました`, count, ratio };
}

function renderStatus(view: StatusView): void {
  const status = byId('status');
  const title = byId('status-title');
  const count = byId('status-count');
  const detail = byId('status-detail');
  const track = byId('status-track');
  const bar = byId('status-bar');
  if (!status || !title || !count || !detail || !track || !bar) return;

  status.dataset.tone = view.tone;
  title.textContent = view.title;
  count.textContent = view.count ?? '';
  detail.textContent = view.detail ?? '';
  track.hidden = view.ratio === undefined;
  bar.style.width = `${Math.round((view.ratio ?? 0) * 100)}%`;
}

async function refreshStatus(): Promise<void> {
  try {
    renderStatus(toStatusView(await sendToRuntime({ type: MessageType.GET_PROGRESS })));
  } catch (e) {
    warn('進捗の取得に失敗しました', e);
    renderStatus({
      tone: 'danger',
      title: '状況を取得できませんでした',
      detail: '拡張機能を再読み込みしてから開き直してください',
    });
  }
}

function setupLinks(): void {
  document.querySelectorAll<HTMLButtonElement>('button[data-href]').forEach((button) => {
    button.addEventListener('click', () => {
      const url = button.dataset.href;
      if (url) void chrome.tabs.create({ url });
    });
  });
}

function setupThemeSwitch(): void {
  const group = byId('theme');
  if (!group) return;
  const buttons = Array.from(group.querySelectorAll<HTMLButtonElement>('[data-theme-value]'));

  const select = (preference: ThemePreference): void => {
    for (const button of buttons) {
      const on = button.dataset.themeValue === preference;
      button.setAttribute('aria-checked', on ? 'true' : 'false');
      button.tabIndex = on ? 0 : -1;
    }
    applyThemePreference(preference);
    writeThemeCache(preference);
  };

  const choose = (preference: ThemePreference): void => {
    select(preference);
    saveThemePreference(preference).catch((e) => warn('配色の設定を保存できませんでした', e));
  };

  buttons.forEach((button, index) => {
    button.addEventListener('click', () => {
      const value = button.dataset.themeValue;
      if (isThemePreference(value)) choose(value);
    });
    // ラジオグループの作法どおり、矢印キーで選択を移す
    button.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      e.preventDefault();
      const step = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
      const next = buttons[(index + step + buttons.length) % buttons.length];
      const value = next.dataset.themeValue;
      if (isThemePreference(value)) {
        choose(value);
        next.focus();
      }
    });
  });

  select(readThemeCache());
  void loadThemePreference().then(select);
}

document.addEventListener('DOMContentLoaded', () => {
  renderIcons();
  const version = byId('version');
  if (version) version.textContent = `v${chrome.runtime.getManifest().version}`;
  setupLinks();
  setupThemeSwitch();
  void refreshStatus();
  window.setInterval(() => void refreshStatus(), POLL_INTERVAL_MS);
});
