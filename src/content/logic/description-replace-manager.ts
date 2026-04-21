import { randomInt, sleep } from '../../common/utils';
import { CONFIG } from '../infra/constants';
import { loadReplaceRecords, saveReplaceRecord } from '../infra/description-replace-store';
import { debugMethodEnd, debugMethodStart, log, warn } from '../infra/logger';
import {
  DescriptionReplaceCounts,
  DescriptionReplacePhase,
  DescriptionReplacePlan,
  DescriptionReplaceProgress,
  DescriptionReplaceRecord,
} from '../infra/types';
import { replaceItemDescription } from './description-replacer';

/**
 * 説明文の一括置換の全体制御。
 *
 * 実行計画に載った商品を 1 件ずつ {@link replaceItemDescription} に渡し、
 * 結果を記録しながら進捗を通知します。
 *
 * - **1 件失敗しても止めません。** 残りを処理し、内訳を最後に知らせます
 *   （途中で止めると「どこまで置き換わったか」が分からなくなる）
 * - ただし**説明欄や確定ボタンが見つからない**ときは、メルカリ側の変更を疑うべき
 *   状況なので残りを開かずに止めます（`halted`）
 * - 利用者の中断要求は、処理中の 1 件が確定ボタンを押す前なら保存せずに打ち切り、
 *   押したあとなら照合まで終えてから止めます
 */

/** 進捗の通知先 */
export type DescriptionReplaceProgressReporter = (progress: DescriptionReplaceProgress) => void;

/**
 * 結果種別ごとの件数を 0 で初期化する
 * @returns すべて 0 の件数
 */
export function emptyCounts(): DescriptionReplaceCounts {
  return { applied: 0, already: 0, skipped: 0, failed: 0, unverified: 0 };
}

export class DescriptionReplaceManager {
  /** 実行中か（二重起動の防止） */
  private running = false;

  /** 利用者から中断を求められているか */
  private abortRequested = false;

  /** 直近の実行で記録した結果（出力用） */
  private lastRunRecords: DescriptionReplaceRecord[] = [];

  /**
   * 実行中かどうか
   * @returns 実行中なら true
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * 中断を求める
   *
   * 処理中の 1 件は、確定ボタンを押す前なら保存せずに打ち切ります。
   * 押したあとなら商品ページでの照合まで終えてから止まります。
   */
  requestAbort(): void {
    if (!this.running) return;
    this.abortRequested = true;
    log('説明文の一括置換の中断を受け付けました');
  }

  /**
   * 実行計画に沿って置き換えを実行する
   *
   * **確認は呼び出し側で済ませてから呼ぶこと。** ここでは確認を取りません。
   *
   * @param plan 実行計画（この `targets` 以外は 1 件も開かない）
   * @param waitBaseSeconds 1 件ごとの待機の基準秒数（これにランダム分が足される）
   * @param onProgress 進捗の通知先
   * @returns 結果種別ごとの件数
   */
  async run(
    plan: DescriptionReplacePlan,
    waitBaseSeconds: number,
    onProgress: DescriptionReplaceProgressReporter
  ): Promise<DescriptionReplaceCounts> {
    if (this.running) {
      throw new Error('説明文の一括置換はすでに実行中です');
    }

    this.running = true;
    this.abortRequested = false;
    this.lastRunRecords = [];

    const counts = emptyCounts();
    const total = plan.targets.length;
    const startTime = performance.now();

    debugMethodStart('DescriptionReplaceManager.run', { total, waitBaseSeconds });

    /** 進捗を通知する（通知先での例外で本処理を止めない） */
    const report = (
      phase: DescriptionReplacePhase,
      current: number,
      extra: Pick<DescriptionReplaceProgress, 'itemName' | 'remainingSeconds' | 'message'> = {}
    ): void => {
      try {
        onProgress({ phase, current, total, counts: { ...counts }, ...extra });
      } catch (e) {
        warn('進捗の通知に失敗しました', e);
      }
    };

    try {
      for (let i = 0; i < total; i++) {
        if (this.abortRequested) {
          report('aborted', i);
          return counts;
        }

        const target = plan.targets[i];
        report('processing', i + 1, { itemName: target.entry.name });

        const result = await replaceItemDescription(target, () => this.abortRequested);

        if (result.record) {
          counts[result.record.outcome]++;
          this.lastRunRecords.push(result.record);

          // 記録できなくても処理は続ける。記録が無くても二重保存は起きない（開いた時点で照合する）
          if (!(await saveReplaceRecord(result.record))) {
            warn('処理記録を保存できませんでした', { id: result.record.id });
          }
        }

        if (result.halt) {
          warn(`説明文の一括置換を止めました: ${result.halt}`);
          report('halted', i + 1, { message: result.halt });
          return counts;
        }

        if (!result.record) {
          // 中断要求で保存前に打ち切られた
          report('aborted', i);
          return counts;
        }

        // 最後の 1 件のあとは待たない
        if (i < total - 1) {
          const waitSeconds =
            Math.max(0, Math.round(waitBaseSeconds)) +
            randomInt(0, Math.round(CONFIG.DESCRIPTION_REPLACE_WAIT_RANDOM_MS / 1000));

          // 残り秒数を 1 秒ごとに知らせる。表示が止まったままだと「固まった」のか
          // 「待っている」のか区別できない。中断要求もここで 1 秒以内に拾う
          for (let remaining = waitSeconds; remaining > 0; remaining--) {
            if (this.abortRequested) {
              report('aborted', i + 1);
              return counts;
            }
            report('waiting', i + 1, { itemName: target.entry.name, remainingSeconds: remaining });
            await sleep(1);
          }
        }
      }

      report('done', total);
      return counts;
    } finally {
      this.running = false;
      this.abortRequested = false;

      const duration = Math.round(performance.now() - startTime);
      debugMethodEnd('DescriptionReplaceManager.run', { counts }, duration);
    }
  }

  /**
   * 処理記録を JSON 文字列にまとめる（ファイル出力用）
   *
   * ストレージにある全商品の最新記録と、直近の実行で記録した結果の両方を含めます。
   *
   * @returns 整形済みの JSON 文字列
   */
  async exportRecordsJson(): Promise<string> {
    const records = Object.values(await loadReplaceRecords()).sort((a, b) =>
      a.at.localeCompare(b.at)
    );

    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        recordCount: records.length,
        records,
        lastRun: this.lastRunRecords,
      },
      null,
      2
    );
  }
}

// シングルトンインスタンス
export const descriptionReplaceManager = new DescriptionReplaceManager();
