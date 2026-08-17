import { CLASS_NAME } from '../infra/constants';
import { ListItem } from '../logic/item-collector';

/**
 * チェックボックスの状態変更コールバック
 */
export type CheckboxChangeHandler = (item: ListItem, checked: boolean) => void;

/**
 * 各商品要素の先頭にチェックボックスを追加し、追加した件数を返す。
 * 既にチェックボックスが付与されている要素はスキップするため、
 * 一覧が再描画されるたびに何度呼んでも安全（増えた分だけ付与される）。
 */
export function addCheckboxes(items: ListItem[], onChange: CheckboxChangeHandler): number {
  let added = 0;

  for (const item of items) {
    if (item.el.querySelector(`.${CLASS_NAME.BULK_CHECKBOX}`)) {
      continue;
    }

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = CLASS_NAME.BULK_CHECKBOX;
    checkbox.dataset.itemId = item.id;
    Object.assign(checkbox.style, {
      width: '18px',
      height: '18px',
      marginRight: '8px',
      cursor: 'pointer',
      alignSelf: 'center',
      flexShrink: '0',
    });

    checkbox.addEventListener('change', () => {
      onChange(item, checkbox.checked);
    });

    // deal-itemはflexレイアウト（media）のため先頭に挿入する
    item.el.style.display = 'flex';
    item.el.insertBefore(checkbox, item.el.firstChild);
    added++;
  }

  return added;
}

/**
 * すべてのチェックボックスの有効/無効を切り替える（処理中の誤操作防止）
 */
export function setCheckboxesEnabled(enabled: boolean): void {
  document.querySelectorAll<HTMLInputElement>(`.${CLASS_NAME.BULK_CHECKBOX}`).forEach((cb) => {
    cb.disabled = !enabled;
  });
}
