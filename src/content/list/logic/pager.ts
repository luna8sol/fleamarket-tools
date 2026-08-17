import { SELECTOR } from '../infra/constants';

/**
 * 一覧ページのページ送りを扱うモジュール。
 *
 * 削除するとページ全体が遷移して**1ページ目に戻る**ため、2ページ目以降の商品を
 * 続けて削除するには、商品を探しにページを移動する必要がある。
 *
 * ページ送りはURLを変えずにAJAXで一覧を差し替える。現在ページは
 * `.pagination .page.current`、他のページは `.pagination a` のリンクとして出る。
 * `/draft` のようにページャが無いページでは常に1ページとして扱う。
 */

/** ページ移動が反映されるまでの最大待機時間 (ms) */
const PAGE_CHANGE_TIMEOUT_MS = 15000;
/** ページ移動の確認間隔 (ms) */
const POLL_INTERVAL_MS = 300;

/** 「122件中 31 - 60件」から総件数を取り出す */
const PAGE_INFO_RE = /^(\d+)件中\s*\d+\s*-\s*\d+件$/;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** 現在表示中のページ番号。ページャが無ければ1 */
export function getCurrentPage(): number {
  const current = document.querySelector(SELECTOR.PAGER_CURRENT)?.textContent?.trim();
  const page = Number(current);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

/** ページャに出ている最大のページ番号。ページャが無ければ1 */
export function getMaxPage(): number {
  const pages = Array.from(document.querySelectorAll<HTMLAnchorElement>(SELECTOR.PAGER_LINK))
    .map((link) => Number(link.getAttribute('href')?.match(/[?&]page=(\d+)/)?.[1]))
    .filter((page) => Number.isInteger(page) && page > 0);
  return Math.max(getCurrentPage(), ...pages, 1);
}

/**
 * 指定ページへのリンクを返す。
 * リンクのテキストがページ番号なのでそれで探す（1ページ目はhrefにpage=が付かない）。
 */
export function findPageLink(page: number): HTMLAnchorElement | null {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(SELECTOR.PAGER_LINK));
  return links.find((link) => link.textContent?.trim() === String(page)) ?? null;
}

/**
 * 指定ページへ移動する。移動できたら true。
 * ページャはAJAXで差し替わるため、現在ページの表示が変わるまで待つ。
 */
export async function gotoPage(page: number): Promise<boolean> {
  if (getCurrentPage() === page) return true;

  const link = findPageLink(page);
  if (!link) return false;

  link.click();

  const startedAt = Date.now();
  while (Date.now() - startedAt < PAGE_CHANGE_TIMEOUT_MS) {
    await delay(POLL_INTERVAL_MS);
    if (getCurrentPage() === page) return true;
  }
  return false;
}

/**
 * 一覧全体の件数。ページャの情報行から読む。
 *
 * 「出品中」「売却済」などタブごとに情報行が存在するため、
 * 実際に表示されているものだけを対象にする。
 * 読み取れない場合（/draft など情報行が無いページ）は null。
 */
export function getTotalItemCount(): number | null {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(SELECTOR.PAGE_INFO)).filter(
    (el) => el.getClientRects().length > 0
  );
  for (const el of nodes) {
    const total = el.textContent?.trim().match(PAGE_INFO_RE)?.[1];
    if (total !== undefined) return Number(total);
  }
  return null;
}
