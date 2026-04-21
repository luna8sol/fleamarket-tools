import { ITEM_JSON_IMAGE_PATHS, ITEM_JSON_PATHS, SELL_FORM_FIELDS } from '../infra/constants';
import { debug, debugMethodEnd, debugMethodStart, warn } from '../infra/logger';
import { CompareFieldKey, CompareValues, ItemSnapshot } from '../infra/types';
import { normalizeFieldValue } from './value-normalizer';

/**
 * 元商品のスナップショット取得。
 *
 * 再出品ボタンを押す前に商品詳細ページを取得し、比較の基準となる値を
 * 記録します。一覧ページのDOMには説明文や配送設定が含まれないため、
 * 商品詳細ページの __NEXT_DATA__ を参照します。
 */

/** 商品詳細ページのURLを組み立てる */
function buildItemUrl(itemId: string): string {
  return `${window.location.origin}/item/${encodeURIComponent(itemId)}`;
}

/**
 * 値がプレーンなオブジェクトかどうかを判定
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * ドット区切りパスで値を取り出す
 * @param source 探索対象のオブジェクト
 * @param path 'shippingFromArea.id' のようなパス
 * @returns 見つかった値。存在しない場合は undefined
 */
function readPath(source: Record<string, unknown>, path: string): unknown {
  let current: unknown = source;
  for (const segment of path.split('.')) {
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }
  return current;
}

/**
 * 値を比較用の文字列へ変換する
 * @param value 変換対象
 * @returns 文字列。変換できない場合は null
 */
function toComparableString(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

/**
 * HTML文字列から __NEXT_DATA__ のJSONを取り出す
 * @param html 商品詳細ページのHTML
 * @returns パース済みのJSON。取得できない場合は null
 */
function extractNextData(html: string): unknown {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const script = parsed.querySelector('#__NEXT_DATA__');
  const json = script?.textContent;
  if (!json) {
    warn('__NEXT_DATA__ が見つかりませんでした');
    return null;
  }

  try {
    return JSON.parse(json);
  } catch (e) {
    warn('__NEXT_DATA__ のパースに失敗しました', e);
    return null;
  }
}

/**
 * JSON構造を幅優先で走査し、対象商品のオブジェクトを探す
 *
 * @param root 走査対象のJSON
 * @param itemId 探したい商品ID
 * @returns 商品オブジェクト。見つからない場合は null
 */
function findItemObject(root: unknown, itemId: string): Record<string, unknown> | null {
  const queue: unknown[] = [root];
  let fallback: Record<string, unknown> | null = null;

  while (queue.length > 0) {
    const current = queue.shift();

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    if (!isRecord(current)) continue;

    const hasItemShape = typeof current.name === 'string' && 'price' in current;
    if (hasItemShape) {
      if (current.id === itemId) return current;
      // ID一致が見つからなかった場合に備え、商品らしい最初のオブジェクトを覚えておく
      if (!fallback && 'description' in current) fallback = current;
    }

    queue.push(...Object.values(current));
  }

  return fallback;
}

/**
 * 商品オブジェクトの画像枚数を数える
 * @param item 商品オブジェクト
 * @returns 画像枚数。判定できない場合は null
 */
function countImages(item: Record<string, unknown>): number | null {
  for (const path of ITEM_JSON_IMAGE_PATHS) {
    const value = item[path];
    if (Array.isArray(value)) return value.length;
  }
  return null;
}

/**
 * 商品オブジェクトから比較対象の値を抽出する
 * @param item 商品オブジェクト
 * @returns 正規化済みの比較値
 */
function extractValues(item: Record<string, unknown>): CompareValues {
  const values: CompareValues = {};

  for (const spec of SELL_FORM_FIELDS) {
    const key: CompareFieldKey = spec.key;

    if (key === 'imageCount') {
      const count = countImages(item);
      if (count !== null) values[key] = normalizeFieldValue(key, String(count));
      continue;
    }

    for (const path of ITEM_JSON_PATHS[key]) {
      const raw = toComparableString(readPath(item, path));
      if (raw !== null) {
        values[key] = normalizeFieldValue(key, raw);
        break;
      }
    }
  }

  return values;
}

/**
 * 取得に失敗したスナップショットを作る
 */
function failedSnapshot(itemId: string, itemName: string, reason: string): ItemSnapshot {
  warn(`元商品のスナップショット取得に失敗: ${itemId} - ${reason}`);
  return {
    itemId,
    itemName,
    captured: false,
    captureError: reason,
    capturedAt: Date.now(),
    values: {},
  };
}

/**
 * 元商品のスナップショットを取得する
 *
 * 取得に失敗した場合も captured: false のスナップショットを返します。
 * 比較の基準がない状態で自動保存しないよう、呼び出し側で判定してください。
 *
 * @param itemId 元商品のID
 * @param itemName 元商品の商品名（ログ・通知用）
 * @returns 元商品のスナップショット
 */
export async function captureItemSnapshot(itemId: string, itemName: string): Promise<ItemSnapshot> {
  const startTime = performance.now();
  debugMethodStart('captureItemSnapshot', { itemId, itemName });

  try {
    const response = await fetch(buildItemUrl(itemId), { credentials: 'include' });
    if (!response.ok) {
      return failedSnapshot(itemId, itemName, `商品ページの取得に失敗しました (HTTP ${response.status})`);
    }

    const nextData = extractNextData(await response.text());
    if (nextData === null) {
      return failedSnapshot(itemId, itemName, '商品ページから商品データを取り出せませんでした');
    }

    const item = findItemObject(nextData, itemId);
    if (!item) {
      return failedSnapshot(itemId, itemName, '商品データが商品ページ内に見つかりませんでした');
    }

    const values = extractValues(item);
    if (Object.keys(values).length === 0) {
      return failedSnapshot(itemId, itemName, '比較対象の項目を1つも抽出できませんでした');
    }

    const snapshot: ItemSnapshot = {
      itemId,
      itemName,
      captured: true,
      capturedAt: Date.now(),
      values,
    };

    const duration = Math.round(performance.now() - startTime);
    debug('元商品のスナップショットを取得しました', { itemId, values });
    debugMethodEnd('captureItemSnapshot', { itemId, capturedKeys: Object.keys(values) }, duration);

    return snapshot;
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    debugMethodEnd('captureItemSnapshot', { itemId, success: false, error: reason });
    return failedSnapshot(itemId, itemName, reason);
  }
}
