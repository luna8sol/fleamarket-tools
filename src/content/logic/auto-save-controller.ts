import { sleep } from '../../common/utils';
import { loadAutoSaveSettings } from '../infra/auto-save-settings';
import { CONFIG } from '../infra/constants';
import { debug, debugMethodEnd, debugMethodStart, log, warn } from '../infra/logger';
import { dequeueSnapshot } from '../infra/relist-queue';
import { AutoSaveOutcome, AutoSaveResult, FieldDiff, ItemSnapshot } from '../infra/types';
import { showToast } from '../ui/notification';
import {
  dumpSellFormStructure,
  findSaveDraftButton,
  readSellForm,
  readSellFormField,
  waitForSellFormAttributes,
  waitForSellFormImages,
  waitForSellFormReady,
} from './sell-form';
import { isBackOnSellForm } from './sell-form-navigator';
import { applyFixes, compareValues, formatDiff } from './relist-verifier';

/**
 * 再出品タブでの自動保存の制御。
 *
 * 一覧ページで積んだ元商品のスナップショットを取り出し、出品フォームの
 * 内容と比較します。差分があれば元商品の値へ書き戻し、それでも解消できない
 * 差分が残る場合は保存せずに中断してユーザーへ引き継ぎます。
 *
 * **押すのは「下書きに保存する」だけで、「出品する」は押しません。**
 * 流し込みが途中の内容でも世に出てしまい取り消せないためです。
 * 公開は下書き一覧からの一括出品で、人が見てから行います。
 */

/**
 * 処理結果を組み立てる
 *
 * @param outcome 結果種別
 * @param itemId 対象の元商品ID
 * @param message 表示・ログ用のメッセージ
 * @param diffs 検出した差分
 * @param fixed 修正できた差分
 * @param unfixed 修正できなかった差分
 * @returns 自動保存の処理結果
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
 * 中断を記録してユーザーへ通知する
 *
 * @param snapshot 元商品のスナップショット
 * @param message 中断理由
 * @param diffs 検出した差分
 * @param fixed 修正できた差分
 * @param unfixed 修正できなかった差分
 * @returns 中断を表す処理結果
 */
function abort(
  snapshot: ItemSnapshot,
  message: string,
  diffs: FieldDiff[] = [],
  fixed: FieldDiff[] = [],
  unfixed: FieldDiff[] = []
): AutoSaveResult {
  warn(message, { itemId: snapshot.itemId, unfixed });
  showToast(`自動保存を中断: ${message}`, 'warning', CONFIG.TOAST_DURATION_MS * 2);
  return buildResult(AutoSaveOutcome.ABORTED, snapshot.itemId, message, diffs, fixed, unfixed);
}

/**
 * 修正できない差分が残った場合の中断処理
 *
 * @param snapshot 元商品のスナップショット
 * @param diffs 検出した差分
 * @param fixed 修正できた差分
 * @param unfixed 修正できなかった差分
 * @returns 中断を表す処理結果
 */
function abortWithUnfixed(
  snapshot: ItemSnapshot,
  diffs: FieldDiff[],
  fixed: FieldDiff[],
  unfixed: FieldDiff[]
): AutoSaveResult {
  const details = unfixed.map(formatDiff);
  return abort(snapshot, `手動で確認してください: ${details.join(' / ')}`, diffs, fixed, unfixed);
}

/**
 * フォームの商品名がスナップショットと同じ商品のものかを確認する
 *
 * `/sell/create` の URL には元商品の手がかりが無く、キューとの対応付けは
 * 投入順（FIFO）に頼っています。順序がずれていた場合に**別商品の値で
 * 上書き保存してしまう事故**を防ぐため、比較・修正へ進む前に商品名で照合します。
 *
 * @param snapshot 元商品のスナップショット
 * @returns 一致すれば null、一致しなければ不一致の内容を表す文字列
 */
function detectItemMismatch(snapshot: ItemSnapshot): string | null {
  const formName = readSellFormField('name');
  const expectedName = snapshot.values.name;

  if (formName === null) {
    return '出品フォームの商品名を読み取れませんでした';
  }

  if (expectedName === undefined) {
    return '元商品の商品名を取得できていません';
  }

  if (formName !== expectedName) {
    return `別商品のフォームの可能性があります（フォーム: "${formName}" / 元商品: "${expectedName}"）`;
  }

  return null;
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

    // 先に取り出す。1タブが必ず1エントリを消費する形にして、キューとタブの
    // 対応（FIFO）がずれないようにする。待ってから取り出すと、待機が時間切れに
    // なったときにエントリが残り、次の再出品タブがそれを掴んで
    // 「別商品のフォーム」と誤判定する連鎖が起きる。
    // 再出品由来でないフォームはここで null になり、待機も通知もせず抜ける。
    const snapshot = await dequeueSnapshot();
    if (!snapshot) {
      debug('この出品フォームに対応する再出品エントリがありません');
      return buildResult(AutoSaveOutcome.SKIPPED, null, '対応する再出品エントリがありません');
    }

    if (!snapshot.captured) {
      // 取得からの経過時間を添える。古いエントリが残っていて今回の再出品とは
      // 無関係なものを掴んでいる場合に、それがログだけで分かるようにするため。
      const ageSeconds = Math.round((Date.now() - snapshot.capturedAt) / 1000);
      return abort(
        snapshot,
        `元商品の情報を取得できていません（${ageSeconds}秒前のエントリ）: ${snapshot.captureError ?? '理由不明'}`
      );
    }

    // 取り違え防止の照合にフォームの商品名が要るため、コピー内容の反映を待つ
    if (!(await waitForSellFormReady())) {
      return abort(snapshot, '出品フォームにコピー内容が反映されませんでした');
    }

    // 取り違え防止。一致しない場合は比較も修正もしない
    const mismatch = detectItemMismatch(snapshot);
    if (mismatch !== null) {
      return abort(snapshot, mismatch);
    }

    // 再出品フォームの画像は外部ツールが1枚ずつ上げ直すため、枚数が徐々に増える。
    // 元商品の枚数に達するまで待たないと、途中の枚数で差分と判定してしまう。
    const expectedImages = Number(snapshot.values.imageCount);
    await waitForSellFormImages(document, Number.isFinite(expectedImages) ? expectedImages : null);

    // 「商品の特徴」の欄もカテゴリー確定後に遅れて現れる
    await waitForSellFormAttributes();

    // セレクタ調整用に、解決状況をデバッグログへ出力する
    dumpSellFormStructure();

    const initial = readSellForm();
    const diffs = compareValues(snapshot.values, initial.values, initial.unresolved);

    if (diffs.length === 0) {
      log('元商品と一致しています', { itemId: snapshot.itemId });
      return await save(snapshot, settings.autoSaveDryRun, diffs, [], []);
    }

    log(`差分を検出しました (${diffs.length}件)`, diffs.map(formatDiff));
    const { fixed, unfixed } = await applyFixes(diffs);

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
    const message = `[ドライラン] ${summary}。下書き保存ボタンは押していません`;
    log(message, { itemId: snapshot.itemId, fixed: fixed.map(formatDiff) });
    showToast(message, 'info', CONFIG.TOAST_DURATION_MS);
    return buildResult(AutoSaveOutcome.DRY_RUN, snapshot.itemId, message, diffs, fixed, unfixed);
  }

  // 遷移操作の途中で選択ページに取り残されていないことを最後に確認する
  if (!isBackOnSellForm()) {
    return abort(snapshot, '選択ページから出品フォームへ戻れていません', diffs, fixed, unfixed);
  }

  // 修正操作でフォームが再描画されている可能性があるため、直前に取り直す
  const saveButton = findSaveDraftButton();
  if (!saveButton) {
    const message = '下書き保存ボタンが見つからないため保存できませんでした';
    warn(message, { itemId: snapshot.itemId });
    showToast(message, 'error', CONFIG.TOAST_DURATION_MS);
    return buildResult(AutoSaveOutcome.FAILED, snapshot.itemId, message, diffs, fixed, unfixed);
  }

  if (saveButton.disabled) {
    return abort(
      snapshot,
      '下書き保存ボタンが無効状態のため保存できませんでした',
      diffs,
      fixed,
      unfixed
    );
  }

  const message = `${summary}。下書きに保存しました`;

  // クリックすると遷移して content script ごと破棄されるため、押す前に記録する
  log(message, { itemId: snapshot.itemId, itemName: snapshot.itemName });
  showToast(message, 'success', CONFIG.TOAST_DURATION_MS);

  saveButton.click();

  return buildResult(AutoSaveOutcome.SAVED, snapshot.itemId, message, diffs, fixed, unfixed);
}
