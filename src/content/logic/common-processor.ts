import { sleep, randomInt } from '../../common/utils';
import { warn, debugMethodStart, debugMethodEnd } from '../infra/logger';

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
}

/**
 * 複数アイテムを順次処理するための共通ロジック
 * @param ids 処理対象のID配列
 * @param processor アイテム処理の実装
 * @returns 処理が完了したかどうか
 */
export async function processItems(ids: string[], processor: ItemProcessor): Promise<boolean> {
  const processName = processor.getProcessName();
  const startTime = performance.now();

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

      try {
        const success = await processor.processItem(id);

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

          await sleep(waitTime);

          debugMethodEnd(`${processName}.processItems.waitBeforeNext`, {
            completed: true,
            nextIndex: i + 1,
            nextId: ids[i + 1]
          });
        }
      } catch (error) {
        warn(`${processName} 処理中にエラーが発生しました: ID=${id}`, error);

        debugMethodEnd(`${processName}.processItems.processItem`, {
          index: i,
          id,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

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
