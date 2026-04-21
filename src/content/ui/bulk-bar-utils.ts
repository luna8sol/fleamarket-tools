import { ID_NAME, PageType } from '../infra/constants';
import { warn } from '../infra/logger';
import { detectCurrentPage } from '../infra/page-detector';
import { selectionManager } from '../logic/selection-manager';
import { addCheckboxToLi } from './checkbox-manager';
import { renderProcessingSpan, renderBulkBar } from './bulk-bar-ui';

/**
 * 商品IDから/item/プレフィックスを取り除く
 */
export function removeItemPrefix(itemId: string): string {
  return itemId.replace(/^\/item\//, '');
}

/**
 * UI初期化: ページに応じたUI表示
 */
export function initializePageUI(ul: HTMLUListElement): void {
  const pageType = detectCurrentPage();

  if (pageType === PageType.DRAFTS) {
    // 再出品ボタンが残っていれば削除
    const existing = document.getElementById(ID_NAME.BULK_RELIST_BTN);
    if (existing) existing.remove();
  } else if (pageType === PageType.LISTINGS) {
    // 出品中ページ: 初期は非表示にしておく
    renderProcessingSpan('');

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
          if (checked) {
            selectionManager.addSelection(id);
          } else {
            selectionManager.removeSelection(id);
          }
          renderBulkBar(selectionManager.getSelectionCount());
        },
        { type: 'listings', itemId: itemId }
      );
    });

    // 選択件数表示を更新（コンテナを作成・追加）
    renderBulkBar(selectionManager.getSelectionCount());
  } else {
    // 念のため UNKNOWN や DRAFTS ではボタン撤去
    const existing = document.getElementById(ID_NAME.BULK_RELIST_CONTAINER);
    if (existing) existing.remove();
  }
}
