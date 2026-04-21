import { ID_NAME } from '../infra/constants';
import { debug, warn } from '../infra/logger';
import { showToast } from './notification';
import {
  getDescriptionTextarea,
  readDescriptionContext,
  applyDescription,
} from '../logic/edit-form';
import { requestDescription } from '../logic/description-generator';

/**
 * 編集ページの説明欄に「AIで説明文を作る」ボタンと生成結果のプレビューパネルを表示するモジュール。
 *
 * - 生成結果はいきなり説明欄へ反映せず、プレビュー上で編集してから「反映する」で書き戻します。
 * - パネルは説明欄の直後に挿入します。既に存在する場合は再生成しません（MutationObserver対策）。
 */

/**
 * ボタン要素を生成する。
 *
 * @param id 要素ID
 * @param label ボタンのラベル
 * @param primary 主要ボタンとして強調表示するか
 * @returns {HTMLButtonElement} 生成したボタン
 */
function createButton(id: string, label: string, primary: boolean): HTMLButtonElement {
  const button = document.createElement('button');
  button.id = id;
  button.type = 'button';
  button.textContent = label;

  const style = button.style;
  style.padding = '8px 16px';
  style.fontSize = '14px';
  style.borderRadius = '4px';
  style.cursor = 'pointer';
  style.border = primary ? 'none' : '1px solid #ccc';
  style.backgroundColor = primary ? '#ea352d' : '#fff';
  style.color = primary ? '#fff' : '#333';

  return button;
}

/**
 * ステータス表示を更新する。
 *
 * @param panel パネル要素
 * @param message 表示するメッセージ（空文字列で非表示）
 * @param type 表示種別
 */
function setStatus(panel: HTMLElement, message: string, type: 'info' | 'error'): void {
  const status = panel.querySelector(`#${ID_NAME.AI_DESCRIPTION_STATUS}`);
  if (!(status instanceof HTMLElement)) return;

  status.textContent = message;
  status.style.color = type === 'error' ? '#c62828' : '#666';
  status.style.display = message === '' ? 'none' : 'block';
}

/**
 * 生成結果のプレビュー表示を切り替える。
 *
 * @param panel パネル要素
 * @param visible 表示するかどうか
 */
function setPreviewVisible(panel: HTMLElement, visible: boolean): void {
  const preview = panel.querySelector(`#${ID_NAME.AI_DESCRIPTION_PREVIEW}`);
  const applyButton = panel.querySelector(`#${ID_NAME.AI_DESCRIPTION_APPLY_BTN}`);
  const cancelButton = panel.querySelector(`#${ID_NAME.AI_DESCRIPTION_CANCEL_BTN}`);

  [preview, applyButton, cancelButton].forEach((el) => {
    if (el instanceof HTMLElement) {
      el.style.display = visible ? (el === preview ? 'block' : 'inline-block') : 'none';
    }
  });
}

/**
 * 説明文の生成を実行し、結果をプレビューに表示する。
 *
 * @param panel パネル要素
 */
async function handleGenerateClick(panel: HTMLElement): Promise<void> {
  const generateButton = panel.querySelector(`#${ID_NAME.AI_DESCRIPTION_BTN}`);
  const preview = panel.querySelector(`#${ID_NAME.AI_DESCRIPTION_PREVIEW}`);

  if (!(generateButton instanceof HTMLButtonElement) || !(preview instanceof HTMLTextAreaElement)) {
    warn('AI説明文生成パネルの要素が見つかりません');
    return;
  }

  const context = readDescriptionContext();
  if (context.name === '') {
    setStatus(panel, '商品名が未入力です。先に商品名を入力してください。', 'error');
    return;
  }

  generateButton.disabled = true;
  generateButton.textContent = '生成中...';
  setPreviewVisible(panel, false);
  setStatus(
    panel,
    `Claude で説明文を生成しています（画像${context.imageSources.length}枚）...`,
    'info'
  );

  try {
    const result = await requestDescription(context);

    if (!result.ok) {
      setStatus(panel, result.message, 'error');
      showToast(result.message, 'error');
      return;
    }

    preview.value = result.description;
    setPreviewVisible(panel, true);
    setStatus(panel, '内容を確認・編集して「反映する」を押してください。', 'info');
  } finally {
    // 例外で抜けてもボタンを押せない状態のままにしない
    generateButton.disabled = false;
    generateButton.textContent = 'AIで説明文を作る';
  }
}

/**
 * プレビューの内容を説明欄へ反映する。
 *
 * @param panel パネル要素
 */
function handleApplyClick(panel: HTMLElement): void {
  const preview = panel.querySelector(`#${ID_NAME.AI_DESCRIPTION_PREVIEW}`);
  if (!(preview instanceof HTMLTextAreaElement)) return;

  if (applyDescription(preview.value)) {
    setPreviewVisible(panel, false);
    setStatus(panel, '', 'info');
    showToast('説明文を反映しました', 'success');
  } else {
    setStatus(
      panel,
      '説明欄への反映に失敗しました。ページを再読み込みして再実行してください。',
      'error'
    );
  }
}

/**
 * AI説明文生成パネルを生成する。
 *
 * @returns {HTMLDivElement} 生成したパネル
 */
function createPanel(): HTMLDivElement {
  const panel = document.createElement('div');
  panel.id = ID_NAME.AI_DESCRIPTION_PANEL;

  const panelStyle = panel.style;
  panelStyle.margin = '8px 0 16px';
  panelStyle.padding = '12px';
  panelStyle.border = '1px solid #e0e0e0';
  panelStyle.borderRadius = '8px';
  panelStyle.backgroundColor = '#fafafa';

  const generateButton = createButton(ID_NAME.AI_DESCRIPTION_BTN, 'AIで説明文を作る', true);
  panel.appendChild(generateButton);

  const status = document.createElement('p');
  status.id = ID_NAME.AI_DESCRIPTION_STATUS;
  status.style.margin = '8px 0 0';
  status.style.fontSize = '13px';
  status.style.display = 'none';
  panel.appendChild(status);

  const preview = document.createElement('textarea');
  preview.id = ID_NAME.AI_DESCRIPTION_PREVIEW;
  preview.rows = 12;
  preview.style.width = '100%';
  preview.style.marginTop = '8px';
  preview.style.padding = '8px';
  preview.style.fontSize = '14px';
  preview.style.lineHeight = '1.6';
  preview.style.border = '1px solid #ccc';
  preview.style.borderRadius = '4px';
  preview.style.boxSizing = 'border-box';
  preview.style.display = 'none';
  panel.appendChild(preview);

  const actions = document.createElement('div');
  actions.style.marginTop = '8px';
  actions.style.display = 'flex';
  actions.style.gap = '8px';

  const applyButton = createButton(ID_NAME.AI_DESCRIPTION_APPLY_BTN, '反映する', true);
  applyButton.style.display = 'none';
  const cancelButton = createButton(ID_NAME.AI_DESCRIPTION_CANCEL_BTN, '閉じる', false);
  cancelButton.style.display = 'none';

  actions.appendChild(applyButton);
  actions.appendChild(cancelButton);
  panel.appendChild(actions);

  generateButton.addEventListener('click', () => {
    void handleGenerateClick(panel);
  });
  applyButton.addEventListener('click', () => handleApplyClick(panel));
  cancelButton.addEventListener('click', () => {
    setPreviewVisible(panel, false);
    setStatus(panel, '', 'info');
  });

  return panel;
}

/**
 * 説明欄の直後にAI説明文生成パネルを描画する。
 *
 * - 既にパネルが存在する場合は再生成しません（MutationObserverから繰り返し呼ばれるため）。
 *
 * @returns {boolean} パネルが配置済みならtrue、説明欄が未描画で配置できなければfalse
 * @example
 *   // falseの場合は説明欄の描画を待って再試行する
 *   const rendered = renderDescriptionPanel();
 */
export function renderDescriptionPanel(): boolean {
  if (document.getElementById(ID_NAME.AI_DESCRIPTION_PANEL)) {
    return true;
  }

  const textarea = getDescriptionTextarea();
  if (!textarea) {
    return false;
  }

  // textarea が装飾用のdivに包まれている場合があるため、フォーム項目の外側に挿入する
  const anchor = textarea.closest('div') ?? textarea;
  anchor.insertAdjacentElement('afterend', createPanel());

  debug('AI説明文生成パネルを描画しました');
  return true;
}
