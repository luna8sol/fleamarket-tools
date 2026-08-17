import { CONFIG, SELECTOR } from '../infra/constants';
import { pollUntil } from '../../wait';

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

/** 「122件中 31 - 60件」から総件数を取り出す */
const PAGE_INFO_RE = /^(\d+)件中\s*\d+\s*-\s*\d+件$/;

/** 現在表示中のページ番号。ページャが無ければ1 */
export function getCurrentPage(): number {
  const current = document.querySelector(SELECTOR.PAGER_CURRENT)?.textContent?.trim();
  const page = Number(current);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

/** ページャに出ている最大のページ番号。ページャが無ければ1 */
export function getMaxPage(): number {
  return Math.max(getCurrentPage(), ...listLinkedPages(), 1);
}

/** リンクのhrefからページ番号を読む。1ページ目はpage=が付かないためnullになる */
function pageFromHref(link: HTMLAnchorElement): number | null {
  const page = Number(link.getAttribute('href')?.match(/[?&]page=(\d+)/)?.[1]);
  return Number.isInteger(page) && page > 0 ? page : null;
}

/**
 * 指定ページへのリンクを返す。
 *
 * ふつうはリンクのテキストがページ番号だが、「最後のページ」へのリンクは
 * ラベルが記号で番号を持たないため、hrefからも判定する。
 * 逆に1ページ目のリンクはhrefにpage=が付かないのでテキストでしか判定できない。
 */
export function findPageLink(page: number): HTMLAnchorElement | null {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(SELECTOR.PAGER_LINK));
  return (
    links.find((link) => link.textContent?.trim() === String(page)) ??
    links.find((link) => pageFromHref(link) === page) ??
    null
  );
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

  const arrived = await pollUntil(() => (getCurrentPage() === page ? page : null), {
    timeoutMs: CONFIG.PAGE_CHANGE_TIMEOUT_MS,
    intervalMs: CONFIG.PAGE_POLL_INTERVAL_MS,
  });
  return arrived !== null;
}

/** ページャにリンクとして出ているページ番号 */
function listLinkedPages(): number[] {
  const pages = new Set<number>();
  for (const link of Array.from(
    document.querySelectorAll<HTMLAnchorElement>(SELECTOR.PAGER_LINK)
  )) {
    const byText = Number(link.textContent?.trim());
    if (Number.isInteger(byText) && byText > 0) pages.add(byText);

    const byHref = pageFromHref(link);
    if (byHref !== null) pages.add(byHref);
  }
  return Array.from(pages);
}

/** 目的ページに近づくために、いま押せるページ番号 */
function pickStepToward(current: number, target: number): number | null {
  const pages = listLinkedPages().filter((page) => page !== current);
  if (pages.length === 0) return null;

  const forward = target > current;
  // 行き過ぎない範囲で、いちばん目的地に近いページ
  const withinRange = pages.filter((page) =>
    forward ? page > current && page <= target : page < current && page >= target
  );
  if (withinRange.length > 0) {
    return forward ? Math.max(...withinRange) : Math.min(...withinRange);
  }

  // 範囲内に無ければ、方向だけ合わせていちばん近いページへ
  const sameDirection = pages.filter((page) => (forward ? page > current : page < current));
  if (sameDirection.length === 0) return null;
  return forward ? Math.min(...sameDirection) : Math.max(...sameDirection);
}

/**
 * 指定ページへ移動する。
 * 直接のリンクが無い場合（ページャが「…」で省略している場合）は、
 * 目的のページに近づく方向へ段階的に移動する。
 */
export async function navigateToPage(page: number): Promise<boolean> {
  for (let step = 0; step < CONFIG.MAX_NAVIGATION_STEPS; step++) {
    if (getCurrentPage() === page) return true;
    if (await gotoPage(page)) return true;

    const next = pickStepToward(getCurrentPage(), page);
    if (next === null) return false;
    if (!(await gotoPage(next))) return false;
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
