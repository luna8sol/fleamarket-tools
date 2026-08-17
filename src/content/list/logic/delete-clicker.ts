import { SELECTOR } from '../infra/constants';
import { PageTypeValue } from '../infra/page-detector';
import { collectItems } from './item-collector';
import { warn } from '../../../common/logger';

/**
 * 一覧ページの削除リンクを操作するモジュール。
 *
 * ラクマの削除は jquery_ujs のリンク
 * （`<a data-method="delete" data-confirm="本当に削除してもよろしいですか？">`）。
 * `data-remote` を持たないため、クリックするとページ遷移が起きる。
 */

/** 削除リンクのラベル。取り消せない操作なのでクリック前に必ず一致を確認する */
const DELETE_LABEL = '削除';

/**
 * 指定商品の削除リンクを探す。
 *
 * `data-method="delete"` で特定したうえで、ラベルが「削除」であることも確認する。
 * どちらか一方でも合わなければ null を返し、クリックしない。
 */
export function findDeleteLink(
  pageType: PageTypeValue,
  itemId: string
): HTMLAnchorElement | null {
  const item = collectItems(pageType).find((i) => i.id === itemId);
  if (!item) return null;

  const link = item.el.querySelector<HTMLAnchorElement>(SELECTOR.DELETE_LINK);
  if (!link) return null;

  const label = link.textContent?.trim();
  if (label !== DELETE_LABEL) {
    warn(`削除リンクのラベルが想定と異なるためクリックしません: ${label}`);
    return null;
  }
  return link;
}

/**
 * 削除リンクをクリックする。
 *
 * jquery_ujs は `data-confirm` があるとネイティブの `confirm()` を出す。
 * これは Content Script 側から応答できず処理が止まってしまうため、
 * クリックの直前だけ属性を外し、直後に必ず戻す。
 * 一括削除の開始前にこちらで確認を取っているぶんの置き換えであり、
 * 手動でクリックしたときの確認ダイアログは残す。
 */
export function clickDeleteLink(link: HTMLAnchorElement): void {
  const confirmMessage = link.getAttribute('data-confirm');
  try {
    link.removeAttribute('data-confirm');
    link.click();
  } finally {
    if (confirmMessage !== null) {
      link.setAttribute('data-confirm', confirmMessage);
    }
  }
}
