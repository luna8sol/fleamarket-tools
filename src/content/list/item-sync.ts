import { log } from '../../common/logger';
import { PageTypeValue } from './infra/page-detector';
import { collectItems, ListItem } from './logic/item-collector';
import { sendListReady } from './logic/queue-client';
import { selectionManager } from './logic/selection-manager';
import { updateCount } from './ui/bulk-bar';
import { addCheckboxes, setCheckboxesEnabled } from './ui/checkbox-manager';
import { listRunState } from './run-state';

/**
 * 一覧の描画に追従してチェックボックスを付け直すモジュール。
 */

function handleCheckboxChange(item: ListItem, checked: boolean): void {
  if (checked) {
    selectionManager.add({ id: item.id, title: item.title });
  } else {
    selectionManager.remove(item.id);
  }
  updateCount(selectionManager.getCount());
}

/**
 * 一覧の商品にチェックボックスを付け直す関数を作る。
 *
 * 商品リストはクライアント描画のためContent Script起動時にはまだ存在しない。
 * DOMが変化するたびに呼び、増えた分だけ付与する。
 */
export function createItemSync(pageType: PageTypeValue): () => void {
  /** LIST_READY はページ読み込みごとに1回だけ送る */
  let listReadySent = false;

  return (): void => {
    const items = collectItems(pageType);
    const added = addCheckboxes(items, handleCheckboxChange);
    if (added > 0) {
      log(`チェックボックスを${added}件追加しました（一覧の商品数: ${items.length}）`);
    }

    if (items.length === 0) {
      // 再描画の途中で一時的に0件になることがあるため、この時点では何もしない
      updateCount(selectionManager.getCount());
      return;
    }

    // ページ送りで一覧から消えた商品の選択は破棄する
    selectionManager.retain(new Set(items.map((item) => item.id)));
    updateCount(selectionManager.getCount());
    if (listRunState.isQueueRunning()) {
      setCheckboxesEnabled(false);
    }

    // 削除キューの成否判定に使うため、描画が終わったことをBackgroundへ伝える
    if (!listReadySent) {
      listReadySent = true;
      sendListReady(pageType);
    }
  };
}
