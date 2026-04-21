import { selectionManager } from '../logic/selection-manager';
import { renderBulkBar } from './bulk-bar-ui';
import { initializePageUI } from './bulk-bar-utils';
import { addCheckboxToLi } from './checkbox-manager';
import { renderOrderNumbers } from './order-display';
import { addAiDescriptionLink } from './ai-description-link';
import { detectCurrentPage } from '../infra/page-detector';
import { PageType } from '../infra/constants';

/**
 * UI全体の管理と描画を担当
 */
export function renderUiComponents(ul: HTMLUListElement): void {
  if (!ul) return;

  const pageType = detectCurrentPage();

  // チェックボックスとAI説明文生成リンクの描画（DRAFTS/LISTINGS共通APIで付与）
  Array.from(ul.querySelectorAll('li')).forEach((li) => {
    addAiDescriptionLink(li as HTMLLIElement, pageType);

    addCheckboxToLi(
      li as HTMLLIElement,
      (id, checked) => {
        if (checked) {
          selectionManager.addSelection(id);
        } else {
          selectionManager.removeSelection(id);
        }
        // 順番表示とカウンターを更新
        renderOrderNumbers(ul, selectionManager);
        renderBulkBar(selectionManager.getSelectionCount());
      },
      { type: pageType === PageType.DRAFTS ? 'drafts' : 'listings' }
    );
  });

  // 順番表示の描画
  renderOrderNumbers(ul, selectionManager);

  // ページタイプ別のUI初期化
  initializePageUI(ul);

  // コントロールバー（選択カウンター）の描画
  renderBulkBar(selectionManager.getSelectionCount());
}

