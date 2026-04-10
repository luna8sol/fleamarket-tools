import { SELECTOR, ID_NAME, PageType, COMPOSITE_SELECTOR } from '../infra/constants';
import { log, warn } from '../infra/logger';
import { detectCurrentPage } from '../infra/page-detector';
import { selectionManager } from '../logic/selection-manager';
import { addCheckboxToLi } from './checkbox-manager';
import { renderProcessingSpan, renderBulkBar, renderCountSpan } from './bulk-bar-ui';

/**
 * 商品IDから商品名を取得する関数
 */
export function getItemNameById(itemId: string): string {
  // itemIdから対応するli要素を見つける
  const selector = COMPOSITE_SELECTOR.BULK_CHECKBOX_WITH_ITEM_ID.replace('{0}', itemId);
  const li = document.querySelector(selector)?.closest('li');
  if (!li) return '';

  // li要素から商品名を取得
  const labelElem = li.querySelector(SELECTOR.ITEM_LABEL);
  return labelElem instanceof HTMLElement ? (labelElem.textContent?.trim() ?? '') : '';
}

/**
 * li要素から商品名を取得する関数
 */
export function getItemNameForLi(li: Element): string {
  const labelElem = li.querySelector('[data-testid="item-label"]');
  return labelElem instanceof HTMLElement ? (labelElem.textContent?.trim() ?? '') : '';
}

/**
 * 商品IDから/item/プレフィックスを取り除く
 */
export function removeItemPrefix(itemId: string): string {
  return itemId.replace(/^\/item\//, '');
}

/**
 * DOM上のチェックボックスとselectionManagerの選択状態が一致するか確認
 */
export function areSelectionsEqual(checkedBoxes: NodeListOf<Element>, ids: string[]): boolean {
  if (checkedBoxes.length !== ids.length) return false;

  const checkedIds = Array.from(checkedBoxes).map(cb => (cb as HTMLInputElement).dataset.itemId);
  return checkedIds.every(id => ids.includes(id || '')) && ids.every(id => checkedIds.includes(id));
}

/**
 * UI初期化: ページに応じたUI表示
 */
export function initializePageUI(ul: HTMLUListElement): void {
  const pageType = detectCurrentPage();

  // DRAFTS では再出品ボタンを出さない（もしあれば削除）
  if (pageType === PageType.DRAFTS) {
    const existing = document.getElementById(ID_NAME.BULK_RELIST_BTN);
    if (existing) existing.remove();
  }

  if (pageType === PageType.DRAFTS) {
  } else if (pageType === PageType.LISTINGS) {
    // 出品中ページ: 初期は非表示にしておく
    renderProcessingSpan('');

    // 選択マネージャーをクリア（ページ読み込み時に必ず初期化）
    selectionManager.clearSelections();

    // 選択件数の初期表示
    renderCountSpan(selectionManager.getSelectionCount());

    // li にチェックボックス付与して selection を更新
    Array.from(ul.querySelectorAll('li')).forEach((li) => {
      const aTag = li.querySelector('a[data-testid="listed-item"]') as HTMLAnchorElement;
      const itemId = aTag?.getAttribute('href') || '';

      if (!itemId) {
        warn('itemId could not be resolved for li:', li);
        return;
      }

      addCheckboxToLi(
        li as HTMLLIElement,
        (id, checked) => {
          if (!id) {
            warn('ID is empty in checkbox onChange');
            return;
          }

          log(`チェック変更: ID=${id}, checked=${checked}`);

          if (checked) {
            selectionManager.addSelection(id);
          } else {
            selectionManager.removeSelection(id);
          }

          // デバッグ: 現在の選択状況
          const count = selectionManager.getSelectionCount();
          const ids = selectionManager.getOrderedSelections().map(item => item.id);
          log(`現在の選択: count=${count}, ids=[${ids.map(removeItemPrefix).join(' -> ')}]`);

          // 件数表示を更新
          renderCountSpan(count);
        },
        { type: 'listings', itemId: itemId }
      );
    });

    // 既存のチェック済みボックスを検出して選択に追加（この部分が実行されていない可能性がある）
    const checkedBoxes = document.querySelectorAll(COMPOSITE_SELECTOR.CHECKED_BULK_CHECKBOX);
    log(`初期化時に${checkedBoxes.length}件のチェック済みボックスを検出`);
    if (checkedBoxes.length > 0) {
      Array.from(checkedBoxes).forEach(cb => {
        const itemId = (cb as HTMLInputElement).dataset.itemId;
        if (itemId) {
          const cleanId = removeItemPrefix(itemId);
          const itemName = getItemNameById(itemId);
          selectionManager.addSelection(itemId);
          log(`初期化時に選択マネージャーに追加: ${cleanId}${itemName ? ` - ${itemName}` : ''}`);
        }
      });

      // 追加情報をログ
      const ids = selectionManager.getOrderedSelections().map(item => item.id);
      log(`初期化完了後の選択状態: count=${selectionManager.getSelectionCount()}, ids=[${ids.map(removeItemPrefix).join(' -> ')}]`);
    }

    // 選択件数表示を更新（コンテナを作成・追加）
    renderBulkBar(selectionManager.getSelectionCount());
  } else {
    // 念のため UNKNOWN や DRAFTS ではボタン撤去
    const existing = document.getElementById(ID_NAME.BULK_RELIST_CONTAINER);
    if (existing) existing.remove();
  }
}
