import { CONFIG, ID_NAME } from '../infra/constants';
import { debug, warn } from '../infra/logger';
import { showToast } from './notification';
import {
  getDescriptionTextarea,
  readDescriptionContext,
  applyDescription,
} from '../logic/edit-form';
import { requestDescription } from '../logic/description-generator';
import { decorateButton, setButtonBusy, setButtonLabel } from './components';
import { createIcon } from './icons';
import { ensureTheme } from './theme';

/**
 * 編集ページの説明欄に「AIで説明文を作る」ボタンと生成結果のプレビューパネルを表示するモジュール。
 *
 * - 生成結果はいきなり説明欄へ反映せず、プレビュー上で編集してから「反映する」で書き戻します。
 * - パネルは説明欄の直後に挿入します。既に存在する場合は再生成しません（MutationObserver対策）。
 */

/** 生成ボタンのふだんの文言 */
const GENERATE_LABEL = 'AIで説明文を作る';

/** 生成結果を表示しているときの文言 */
const REGENERATE_LABEL = '作り直す';

/** 生成結果（プレビュー・文字数・反映/閉じる）を包む要素のクラス */
const RESULT_CLASS = 'mdp-ai__result';

/** 文字数表示のクラス */
const COUNT_CLASS = 'mdp-ai__count';

/**
 * ステータス表示を更新する。
 *
 * @param panel パネル要素
 * @param message 表示するメッセージ（空文字列で非表示）
 * @param type 表示種別（loading は生成中。スピナーを添える）
 */
function setStatus(panel: HTMLElement, message: string, type: 'info' | 'error' | 'loading'): void {
  const status = panel.querySelector(`#${ID_NAME.AI_DESCRIPTION_STATUS}`);
  if (!(status instanceof HTMLElement)) return;

  status.replaceChildren();
  status.dataset.tone = type;
  status.style.display = message === '' ? 'none' : '';
  status.setAttribute('role', type === 'error' ? 'alert' : 'status');
  if (message === '') return;

  if (type === 'loading') {
    const spinner = document.createElement('span');
    spinner.className = 'mdp-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    status.appendChild(spinner);
  } else {
    status.appendChild(createIcon(type === 'error' ? 'error' : 'info', 14));
  }

  const text = document.createElement('span');
  text.textContent = message;
  status.appendChild(text);
}

/**
 * プレビューの文字数表示を更新する（メルカリの上限を超えたら警告色にする）
 *
 * @param panel パネル要素
 */
function updateCount(panel: HTMLElement): void {
  const preview = panel.querySelector(`#${ID_NAME.AI_DESCRIPTION_PREVIEW}`);
  const count = panel.querySelector(`.${COUNT_CLASS}`);
  if (!(preview instanceof HTMLTextAreaElement) || !(count instanceof HTMLElement)) return;

  const length = preview.value.length;
  const max = CONFIG.DESCRIPTION_REPLACE_MAX_LENGTH;
  // 色だけに頼らず、超えた字数も文字で出す
  count.textContent =
    length > max ? `${length} / ${max}字（${length - max}字オーバー）` : `${length} / ${max}字`;
  count.dataset.over = length > max ? 'true' : 'false';
}

/**
 * 生成結果のプレビュー表示を切り替える。
 *
 * @param panel パネル要素
 * @param visible 表示するかどうか
 */
function setPreviewVisible(panel: HTMLElement, visible: boolean): void {
  const result = panel.querySelector(`.${RESULT_CLASS}`);
  if (result instanceof HTMLElement) {
    result.hidden = !visible;
  }
  if (visible) updateCount(panel);

  // 生成結果を見ている間は「作り直す」、閉じたら元の文言に戻す
  const generateButton = panel.querySelector(`#${ID_NAME.AI_DESCRIPTION_BTN}`);
  if (generateButton instanceof HTMLButtonElement && !generateButton.disabled) {
    setButtonLabel(generateButton, visible ? REGENERATE_LABEL : GENERATE_LABEL);
  }
}

/**
 * 生成結果を表示中か
 *
 * @param panel パネル要素
 * @returns 表示中なら true
 */
function isPreviewVisible(panel: HTMLElement): boolean {
  const result = panel.querySelector(`.${RESULT_CLASS}`);
  return result instanceof HTMLElement && !result.hidden;
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

  setButtonBusy(generateButton, true);
  setButtonLabel(generateButton, '生成中…');
  panel.dataset.loading = 'true';
  setPreviewVisible(panel, false);
  setStatus(
    panel,
    `Claude で説明文を生成しています（画像${context.imageSources.length}枚）…`,
    'loading'
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
    preview.focus();
  } finally {
    // 例外で抜けてもボタンを押せない状態のままにしない
    setButtonBusy(generateButton, false);
    setButtonLabel(generateButton, isPreviewVisible(panel) ? REGENERATE_LABEL : GENERATE_LABEL);
    delete panel.dataset.loading;
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
 * パネルの見出し（アイコン・題名・説明・生成ボタン）を組み立てる
 *
 * @param generateButton 生成ボタン
 * @returns 見出しの要素
 */
function createHeader(generateButton: HTMLButtonElement): HTMLDivElement {
  const head = document.createElement('div');
  head.className = 'mdp-ai__head';

  const tile = document.createElement('span');
  tile.className = 'mdp-icon-tile';
  tile.appendChild(createIcon('sparkles', 18));

  const titles = document.createElement('div');
  titles.className = 'mdp-ai__titles';

  const title = document.createElement('p');
  title.className = 'mdp-ai__title';
  title.textContent = 'AI 説明文アシスタント';

  const caption = document.createElement('p');
  caption.className = 'mdp-ai__caption';
  caption.textContent =
    '商品名・カテゴリー・画像から下書きを作ります。「反映する」までは説明欄を変えません。';

  titles.append(title, caption);
  head.append(tile, titles, generateButton);
  return head;
}

/**
 * AI説明文生成パネルを生成する。
 *
 * @returns {HTMLDivElement} 生成したパネル
 */
function createPanel(): HTMLDivElement {
  ensureTheme();

  const panel = document.createElement('div');
  panel.id = ID_NAME.AI_DESCRIPTION_PANEL;
  panel.className = 'mdp-ai mdp-scope';
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', 'AI 説明文アシスタント');

  const generateButton = decorateButton(document.createElement('button'), {
    label: GENERATE_LABEL,
    variant: 'primary',
    icon: 'sparkles',
  });
  generateButton.id = ID_NAME.AI_DESCRIPTION_BTN;

  const status = document.createElement('p');
  status.id = ID_NAME.AI_DESCRIPTION_STATUS;
  status.className = 'mdp-ai__status';
  status.style.display = 'none';

  // 生成結果（最初は隠しておく）
  const result = document.createElement('div');
  result.className = RESULT_CLASS;
  result.hidden = true;

  const preview = document.createElement('textarea');
  preview.id = ID_NAME.AI_DESCRIPTION_PREVIEW;
  preview.className = 'mdp-textarea';
  preview.rows = 12;
  preview.setAttribute('aria-label', '生成した説明文（編集できます）');

  const foot = document.createElement('div');
  foot.className = 'mdp-ai__foot';

  const applyButton = decorateButton(document.createElement('button'), {
    label: '反映する',
    variant: 'primary',
    icon: 'check',
  });
  applyButton.id = ID_NAME.AI_DESCRIPTION_APPLY_BTN;

  const cancelButton = decorateButton(document.createElement('button'), {
    label: '閉じる',
    variant: 'secondary',
  });
  cancelButton.id = ID_NAME.AI_DESCRIPTION_CANCEL_BTN;

  const count = document.createElement('span');
  count.className = `${COUNT_CLASS} mdp-num`;
  count.setAttribute('aria-live', 'polite');

  foot.append(applyButton, cancelButton, count);
  result.append(preview, foot);

  panel.append(createHeader(generateButton), status, result);

  generateButton.addEventListener('click', () => {
    void handleGenerateClick(panel);
  });
  applyButton.addEventListener('click', () => handleApplyClick(panel));
  cancelButton.addEventListener('click', () => {
    setPreviewVisible(panel, false);
    setStatus(panel, '', 'info');
  });
  preview.addEventListener('input', () => updateCount(panel));

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
