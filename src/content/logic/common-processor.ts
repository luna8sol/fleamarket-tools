import { sleep, randomInt } from '../../common/utils';
import { warn, debugMethodStart, debugMethodEnd } from '../infra/logger';
import { BulkProgress } from '../infra/types';

/**
 * アイテムの処理方法を定義するインターフェース
 */
export interface ItemProcessor {
  /**
   * 単一アイテムの処理を実行
   * @param id 処理対象アイテムのID
   * @returns 処理が成功したかどうか
   */
  processItem(id: string): Promise<boolean>;

  /**
   * 処理名を取得（ログやデバッグ用）
   */
  getProcessName(): string;

  /**
   * 待機時間の設定を取得
   */
  getWaitConfig(): { baseSeconds: number; minExtraSeconds: number; maxExtraSeconds: number };

  /**
   * 画面に出す処理名（省略時は getProcessName() を使う）
   */
  getDisplayName?(): string;

  /**
   * 進捗表示に出す商品名を取得する（省略可）
   * @param id 対象アイテムのID
   */
  getItemLabel?(id: string): string;
}

/** 進捗の通知先 */
export type BulkProgressReporter = (progress: BulkProgress) => void;

/**
 * 複数アイテムを順次処理するための共通ロジック
 * @param ids 処理対象のID配列
 * @param processor アイテム処理の実装
 * @returns 処理が完了したかどうか
 */
export async function processItems(
  ids: string[],
  processor: ItemProcessor,
  onProgress?: BulkProgressReporter
): Promise<boolean> {
  const processName = processor.getProcessName();
  const displayName = processor.getDisplayName?.() ?? processName;
  const startTime = performance.now();

  let succeeded = 0;
  let failed = 0;

  /** 進捗を通知する（通知先での例外で本処理を止めない） */
  const report = (progress: Omit<BulkProgress, 'processName' | 'total' | 'succeeded' | 'failed'>): void => {
    if (!onProgress) return;
    try {
      onProgress({ processName: displayName, total: ids.length, succeeded, failed, ...progress });
    } catch (e) {
      warn('進捗の通知に失敗しました', e);
    }
  };

  debugMethodStart(`${processName}.processItems`, {
    idsCount: ids.length,
    ids: ids.slice(0, 5) // 最初の5つだけログ（多すぎる場合を考慮）
  });

  try {
    for (let i = 0; i < ids.length; i++) {
      const currentItemStartTime = performance.now();
      const id = ids[i];

      debugMethodStart(`${processName}.processItems.processItem`, {
        index: i,
        id,
        remaining: ids.length - i
      });

      const itemName = processor.getItemLabel?.(id);
      report({ current: i + 1, phase: 'processing', itemName });

      try {
        const success = await processor.processItem(id);
        if (success) {
          succeeded++;
        } else {
          failed++;
        }

        const currentItemDuration = Math.round(performance.now() - currentItemStartTime);
        debugMethodEnd(`${processName}.processItems.processItem`, {
          index: i,
          id,
          success,
          executionTimeMs: currentItemDuration
        }, currentItemDuration);

        // 最後のアイテム以外は待機を入れる
        if (i < ids.length - 1) {
          const waitConfig = processor.getWaitConfig();
          const extra = randomInt(waitConfig.minExtraSeconds, waitConfig.maxExtraSeconds);
          const waitTime = waitConfig.baseSeconds + extra;

          debugMethodStart(`${processName}.processItems.waitBeforeNext`, {
            waitTimeSeconds: waitTime,
            baseSeconds: waitConfig.baseSeconds,
            extraSeconds: extra
          });

          // 数十秒の待機なので、残り秒数を1秒ごとに知らせる。
          // 表示が止まったままだと「固まった」のか「待っている」のか区別できない。
          for (let remaining = waitTime; remaining > 0; remaining--) {
            report({ current: i + 1, phase: 'waiting', itemName, remainingSeconds: remaining });
            await sleep(1);
          }

          debugMethodEnd(`${processName}.processItems.waitBeforeNext`, {
            completed: true,
            nextIndex: i + 1,
            nextId: ids[i + 1]
          });
        }
      } catch (error) {
        failed++;
        warn(`${processName} 処理中にエラーが発生しました: ID=${id}`, error);

        debugMethodEnd(`${processName}.processItems.processItem`, {
          index: i,
          id,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    report({ current: ids.length, phase: 'done' });

    const duration = Math.round(performance.now() - startTime);
    debugMethodEnd(`${processName}.processItems`, {
      totalItemsProcessed: ids.length,
      allCompleted: true,
      totalExecutionTimeMs: duration
    }, duration);

    return true;
  } catch (error) {
    const duration = Math.round(performance.now() - startTime);
    warn(`${processName} 全体処理中にエラー`, error);

    debugMethodEnd(`${processName}.processItems`, {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      totalExecutionTimeMs: duration
    }, duration);

    return false;
  }
}
