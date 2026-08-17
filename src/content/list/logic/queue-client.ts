import {
  ListReadyMessage,
  MessageType,
  QueueItem,
  QueueMode,
  QueueProgress,
  StartQueueMessage,
} from '../../../common/messages';
import { sendToRuntime } from '../../../common/send-message';
import { PageTypeValue } from '../infra/page-detector';
import { collectItems } from './item-collector';
import { getTotalItemCount } from './pager';

/**
 * 一覧ページから Background へ送るメッセージをまとめたモジュール。
 */

/**
 * 現在表示中の商品IDをBackgroundへ伝える。
 * 削除キューは、対象商品がこのIDリストに残っていないことで成否を判定する。
 */
export function sendListReady(pageType: PageTypeValue): void {
  const message: ListReadyMessage = {
    type: MessageType.LIST_READY,
    ids: collectItems(pageType).map((item) => item.id),
    totalCount: getTotalItemCount(),
  };
  void sendToRuntime(message);
}

/**
 * キューの開始をBackgroundへ依頼する。
 *
 * listPage は削除モードでのみ使う（削除のたびに1ページ目へ戻されるため、
 * 対象が居るページ番号を覚えておく）。
 */
export function sendStartQueue(mode: QueueMode, items: QueueItem[], listPage?: number): void {
  const message: StartQueueMessage = { type: MessageType.START_QUEUE, mode, items, listPage };
  void sendToRuntime(message);
}

/**
 * キューの停止をBackgroundへ依頼する。
 */
export function sendStopQueue(): void {
  void sendToRuntime({ type: MessageType.STOP_QUEUE });
}

/**
 * Backgroundが保持している現在の進捗を取得する。
 */
export async function requestProgress(): Promise<QueueProgress | undefined> {
  return sendToRuntime({ type: MessageType.GET_PROGRESS });
}
