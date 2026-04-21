import { sleep } from '../../common/utils';
import { loadAutoSaveSettings } from '../infra/auto-save-settings';
import { CONFIG } from '../infra/constants';
import { debug, debugMethodEnd, debugMethodStart, log, warn } from '../infra/logger';
import { dequeueSnapshot } from '../infra/relist-queue';
import { AutoSaveOutcome, AutoSaveResult, FieldDiff, ItemSnapshot } from '../infra/types';
import { showToast } from '../ui/notification';
import { dumpSellFormStructure, findSubmitButton, readSellForm, waitForSellFormReady } from './sell-form';
import { applyFixes, compareValues, formatDiff } from './relist-verifier';

/**
 * 再出品タブでの自動保存の制御。
 *
 * 一覧ページで積んだ元商品のスナップショットを取り出し、出品フォームの
 * 内容と比較します。差分があれば元商品の値へ書き戻し、それでも解消できない
 * 差分が残る場合は保存せずに中断してユーザーへ引き継ぎます。
 */

/** URLから元商品IDを取り出す際に見るクエリパラメータ名の候補 */
const ITEM_ID_QUERY_KEYS = ['item_id', 'itemId', 'clone_id', 'cloneId', 'source_item_id', 'id'];

/** メルカリの商品IDの形式（m + 数字） */
const ITEM_ID_PATTERN = /^m\d+$/;

/**
 * 現在のURLから元商品IDを推定する
 *
 * 取得できない場合は null を返し、呼び出し側はキューの先頭を使います。
 *
 * @returns 元商品ID。推定できない場合は null
 */
function detectSourceItemId(): string | null {
  const params = new URLSearchParams(window.location.search);

  for (const key of ITEM_ID_QUERY_KEYS) {
    const value = params.get(key);
    if (value && ITEM_ID_PATTERN.test(value)) return value;
  }

  debug('URLから元商品IDを特定できませんでした', { search: window.location.search });
  return null;
}

/**
 * 処理結果を組み立てる
 */
function buildResult(
  outcome: AutoSaveOutcome,
  itemId: string | null,
  message: string,
  diffs: FieldDiff[] = [],
  fixed: FieldDiff[] = [],
  unfixed: FieldDiff[] = []
): AutoSaveResult {
  return { outcome, itemId, diffs, fixed, unfixed, message };
}

/**
 * 修正できない差分が残った場合の中断処理
 */
function abortWithUnfixed(snapshot: ItemSnapshot, diffs: FieldDiff[], fixed: FieldDiff[], unfixed: FieldDiff[]): AutoSaveResult {
  const details = unfixed.map(formatDiff);
  const message = `自動保存を中断しました。手動で確認してください:\n${details.join('\n')}`;

  warn(message, { itemId: snapshot.itemId, unfixed });
  showToast(`自動保存を中断: ${details.join(' / ')}`, 'warning', CONFIG.TOAST_DURATION_MS * 2);

  return buildResult(AutoSaveOutcome.ABORTED, snapshot.itemId, message, diffs, fixed, unfixed);
}

/**
 * 再出品タブで自動保存を実行する
 *
 * @returns 処理結果
 */
export async function runAutoSaveOnSellPage(): Promise<AutoSaveResult> {
  const startTime = performance.now();
  debugMethodStart('runAutoSaveOnSellPage', { url: window.location.href });

  try {
    const settings = await loadAutoSaveSettings();
    if (!settings.autoSaveAfterRelist) {
      debug('自動保存が無効のため何もしません');
      return buildResult(AutoSaveOutcome.SKIPPED, null, '自動保存は無効です');
    }

    const sourceItemId = detectSourceItemId();
    const snapshot = await dequeueSnapshot(sourceItemId);
    if (!snapshot) {
      debug('この出品フォームに対応する再出品エントリがありません');
      return buildResult(AutoSaveOutcome.SKIPPED, sourceItemId, '対応する再出品エントリがありません');
    }

    if (!snapshot.captured) {
      const message = `元商品の情報を取得できていないため自動保存しません: ${snapshot.captureError ?? '理由不明'}`;
      warn(message, { itemId: snapshot.itemId });
      showToast(message, 'warning', CONFIG.TOAST_DURATION_MS);
      return buildResult(AutoSaveOutcome.ABORTED, snapshot.itemId, message);
    }

    if (!(await waitForSellFormReady())) {
      const message = '出品フォームの読み込みを確認できませんでした';
      showToast(message, 'error', CONFIG.TOAST_DURATION_MS);
      return buildResult(AutoSaveOutcome.FAILED, snapshot.itemId, message);
    }

    // セレクタ調整用に、解決状況をデバッグログへ出力する
    dumpSellFormStructure();

    const initial = readSellForm();
    const diffs = compareValues(snapshot.values, initial.values, initial.unresolved);

    if (diffs.length === 0) {
      log('元商品と一致しています', { itemId: snapshot.itemId });
      return await save(snapshot, settings.autoSaveDryRun, diffs, [], []);
    }

    log(`差分を検出しました (${diffs.length}件)`, diffs.map(formatDiff));
    const { fixed, unfixed } = applyFixes(diffs);

    if (unfixed.length > 0) {
      return abortWithUnfixed(snapshot, diffs, fixed, unfixed);
    }

    // 修正がフォームへ反映されるのを待ってから読み直し、残差分がないか確認する
    await sleep(CONFIG.SELL_FORM_FIX_SETTLE_MS / 1000);
    const recheck = readSellForm();
    const remaining = compareValues(snapshot.values, recheck.values, recheck.unresolved);

    if (remaining.length > 0) {
      return abortWithUnfixed(snapshot, diffs, fixed, remaining);
    }

    return await save(snapshot, settings.autoSaveDryRun, diffs, fixed, []);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    warn('自動保存処理でエラーが発生しました', e);
    showToast(`自動保存でエラーが発生しました: ${message}`, 'error', CONFIG.TOAST_DURATION_MS);
    return buildResult(AutoSaveOutcome.FAILED, null, message);
  } finally {
    const duration = Math.round(performance.now() - startTime);
    debugMethodEnd('runAutoSaveOnSellPage', undefined, duration);
  }
}

/**
 * 検証を通過した出品フォームを保存する
 *
 * @param snapshot 元商品のスナップショット
 * @param dryRun ドライラン（保存ボタンを押さない）かどうか
 * @param diffs 検出した差分
 * @param fixed 修正した差分
 * @param unfixed 修正できなかった差分
 * @returns 処理結果
 */
async function save(
  snapshot: ItemSnapshot,
  dryRun: boolean,
  diffs: FieldDiff[],
  fixed: FieldDiff[],
  unfixed: FieldDiff[]
): Promise<AutoSaveResult> {
  const summary = fixed.length > 0 ? `${fixed.length}件を修正して検証通過` : '元商品と一致';

  if (dryRun) {
    const message = `[ドライラン] ${summary}。保存ボタンは押していません`;
    log(message, { itemId: snapshot.itemId, fixed: fixed.map(formatDiff) });
    showToast(message, 'info', CONFIG.TOAST_DURATION_MS);
    return buildResult(AutoSaveOutcome.DRY_RUN, snapshot.itemId, message, diffs, fixed, unfixed);
  }

  const submitButton = findSubmitButton();
  if (!submitButton) {
    const message = '出品ボタンが見つからないため保存できませんでした';
    warn(message, { itemId: snapshot.itemId });
    showToast(message, 'error', CONFIG.TOAST_DURATION_MS);
    return buildResult(AutoSaveOutcome.FAILED, snapshot.itemId, message, diffs, fixed, unfixed);
  }

  if (submitButton.disabled) {
    const message = '出品ボタンが無効状態のため保存できませんでした';
    warn(message, { itemId: snapshot.itemId });
    showToast(message, 'warning', CONFIG.TOAST_DURATION_MS);
    return buildResult(AutoSaveOutcome.ABORTED, snapshot.itemId, message, diffs, fixed, unfixed);
  }

  submitButton.click();

  const message = `${summary}。自動保存しました`;
  log(message, { itemId: snapshot.itemId, itemName: snapshot.itemName });
  showToast(message, 'success', CONFIG.TOAST_DURATION_MS);
  return buildResult(AutoSaveOutcome.SAVED, snapshot.itemId, message, diffs, fixed, unfixed);
}
