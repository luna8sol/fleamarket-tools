import { CONFIG } from './constants';
import { ExtStorageKey, getExtStorage, setExtStorage } from './ext-storage';
import { debug, warn } from './logger';
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
 * キューからスナップショットを取り出す（取り出したエントリは削除される）
 *
 * @param itemId 取り出したい商品ID。null の場合は最も古いエントリを取り出す
 * @returns 取り出したスナップショット。該当なしの場合は null
 */
export async function dequeueSnapshot(itemId: string | null): Promise<ItemSnapshot | null> {
  const queue = await loadRelistQueue();
  if (queue.length === 0) {
    debug('再出品キューが空です', { requestedItemId: itemId });
    return null;
  }

  const index = itemId ? queue.findIndex((entry) => entry.itemId === itemId) : 0;
  if (index < 0) {
    warn(`再出品キューに商品 ${itemId} のエントリがありません`);
    return null;
  }

  const [taken] = queue.splice(index, 1);
  await setExtStorage(ExtStorageKey.RELIST_QUEUE, queue);

  debug('再出品キューから取り出し', { itemId: taken.itemId, remaining: queue.length });
  return taken;
}

/**
 * キューを空にする
 * @returns 消去に成功したか
 */
export async function clearRelistQueue(): Promise<boolean> {
  return setExtStorage<ItemSnapshot[]>(ExtStorageKey.RELIST_QUEUE, []);
}
