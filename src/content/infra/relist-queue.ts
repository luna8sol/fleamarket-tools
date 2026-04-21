import { CONFIG } from './constants';
import { ExtStorageKey, getExtStorage, setExtStorage } from '../../common/ext-storage';
import { debug } from './logger';
import { ItemSnapshot } from './types';

/**
 * 再出品の待ち行列。
 *
 * 一覧ページで再出品ボタンを押す直前に元商品のスナップショットを積み、
 * 別タブで開いた出品フォーム側がそれを取り出して比較に使います。
 */

/**
 * 有効期限切れ（TTL超過）のエントリを除外する
 * @param queue 現在のキュー
 * @returns 有効なエントリのみの配列
 */
function dropExpired(queue: ItemSnapshot[]): ItemSnapshot[] {
  const threshold = Date.now() - CONFIG.RELIST_QUEUE_TTL_MS;
  return queue.filter((entry) => entry.capturedAt >= threshold);
}

/**
 * 現在のキューを取得する
 * @returns 有効期限内のエントリ配列
 */
export async function loadRelistQueue(): Promise<ItemSnapshot[]> {
  const queue = await getExtStorage<ItemSnapshot[]>(ExtStorageKey.RELIST_QUEUE, []);
  return Array.isArray(queue) ? dropExpired(queue) : [];
}

/**
 * スナップショットをキューへ追加する
 *
 * 同一商品のエントリが既にある場合は、新しいスナップショットで置き換えます。
 *
 * @param snapshot 追加する元商品のスナップショット
 * @returns 追加に成功したか
 */
export async function enqueueSnapshot(snapshot: ItemSnapshot): Promise<boolean> {
  const queue = await loadRelistQueue();
  const next = queue.filter((entry) => entry.itemId !== snapshot.itemId);
  next.push(snapshot);

  const saved = await setExtStorage(ExtStorageKey.RELIST_QUEUE, next);
  debug('再出品キューへ追加', { itemId: snapshot.itemId, queueSize: next.length, saved });
  return saved;
}

/**
 * キューに待機中のエントリがあるかを確認する（取り出しはしない）
 *
 * 再出品由来ではない `/sell/create`（ユーザーが自分で開いた新規出品）で
 * フォームの描画を待ってしまわないよう、待機前の足切りに使います。
 *
 * @returns 待機中のエントリがあれば true
 */
export async function hasPendingSnapshot(): Promise<boolean> {
  return (await loadRelistQueue()).length > 0;
}

/**
 * キューの先頭（最も古いエントリ）を取り出す（取り出したエントリは削除される）
 *
 * 再出品ボタンが開く `/sell/create` には**クエリパラメータが付かず、URL から
 * 元商品を特定できません**（2026-09-17 実地確認）。そのため対応付けは
 * 投入順（FIFO）で行います。取り違えを防ぐため、**取り出した側は必ず
 * フォームの商品名とスナップショットの商品名が一致することを確認してください。**
 *
 * @returns 取り出したスナップショット。キューが空の場合は null
 */
export async function dequeueSnapshot(): Promise<ItemSnapshot | null> {
  const queue = await loadRelistQueue();
  if (queue.length === 0) {
    debug('再出品キューが空です');
    return null;
  }

  const [taken] = queue.splice(0, 1);
  await setExtStorage(ExtStorageKey.RELIST_QUEUE, queue);

  debug('再出品キューから取り出し', { itemId: taken.itemId, remaining: queue.length });
  return taken;
}
