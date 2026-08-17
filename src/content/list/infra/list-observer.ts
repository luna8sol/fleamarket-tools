/**
 * 一覧の描画を監視するモジュール。
 *
 * /sell・/draft のサーバーHTMLには .deal-item が1件も含まれておらず、
 * 商品リストは完全にクライアント側で描画される。そのため Content Script の
 * 起動時（document_idle）に1回走査するだけでは商品を1件も拾えない。
 * DOMの変化を監視して、商品が現れるたびに走査し直す必要がある。
 *
 * ページ送りでリストが差し替わった場合にも同じ仕組みで追従できる。
 */

/** 連続するDOM変化をまとめる待ち時間 (ms) */
const DEBOUNCE_MS = 300;

/**
 * body配下のDOM変化を監視し、落ち着いたタイミングで onChange を呼ぶ。
 *
 * NOTE: childList のみを監視する。属性の変化まで拾うと、自分で付与した
 *       チェックボックスの style 変更にも反応してしまうため。
 */
export function observeListChanges(onChange: () => void): void {
  let timer: number | undefined;

  const schedule = (): void => {
    if (timer !== undefined) {
      window.clearTimeout(timer);
    }
    timer = window.setTimeout(() => {
      timer = undefined;
      onChange();
    }, DEBOUNCE_MS);
  };

  new MutationObserver(schedule).observe(document.body, {
    childList: true,
    subtree: true,
  });
}
