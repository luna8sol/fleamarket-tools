import { SourceItem } from '../common/messages';
import { warn } from '../common/logger';

/**
 * 再出品元の商品ページ (https://item.fril.jp/{hash}) から、
 * 出品フォームに入るべき内容を取得するモジュール。
 *
 * 商品ページはサーバーレンダリングされており、JSON-LD (Product) に
 * 商品名・説明・価格・ブランドが入っている。画像は JSON-LD には1枚しか
 * 無いため、HTML中の画像URLから枚数を数える。
 *
 * NOTE: Service Worker には DOMParser が無いため、正規表現で抜き出す。
 */

/**
 * JSON-LD ブロック。
 *
 * 1ページに複数ある（BreadcrumbList など）ことを前提に全部を走査し、
 * `@type` が Product のものを選ぶ。先頭のブロックを決め打ちすると、
 * ラクマ側が Product より前に別の JSON-LD を足した瞬間に全項目が null になり、
 * 差分チェックが黙って省略される。
 *
 * NOTE: g フラグ付きだが、matchAll は内部で正規表現を複製するため lastIndex は汚れない。
 * exec で書き直すとモジュール定数の lastIndex が持ち越されて2回目以降が壊れる。
 */
const LD_JSON_RE = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
/** og:image（属性の順序が逆のこともあるため2パターン見る） */
const OG_IMAGE_RE = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i;
const OG_IMAGE_REVERSED_RE = /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i;

/** 商品画像URL中の商品番号 */
const IMAGE_ITEM_NO_RE = /\/img\/(\d+)\//;

interface ProductJsonLd {
  name?: string;
  description?: string;
  brand?: { name?: string };
  offers?: { price?: number | string };
}

/**
 * JSON-LD のルート値から、型を判定する対象になるノードを平坦に取り出す。
 * ルートが配列のこともあれば、`@graph` の下にまとめられていることもある。
 */
function flattenNodes(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.flatMap(flattenNodes);
  if (typeof value !== 'object' || value === null) return [];
  const graph = (value as { '@graph'?: unknown })['@graph'];
  return graph === undefined ? [value] : [value, ...flattenNodes(graph)];
}

/** `@type` が Product か（複数の型を配列で持つこともある） */
function isProductNode(value: unknown): value is ProductJsonLd {
  if (typeof value !== 'object' || value === null) return false;
  const type = (value as { '@type'?: unknown })['@type'];
  return Array.isArray(type) ? type.includes('Product') : type === 'Product';
}

/** HTML中のJSON-LDから Product のものを探す。見つからなければ null */
function findProductJsonLd(html: string): ProductJsonLd | null {
  for (const match of html.matchAll(LD_JSON_RE)) {
    const block = match[1].trim();
    if (block === '') continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(block);
    } catch {
      // 壊れたブロックがあっても、他に Product があるかもしれないので続ける
      continue;
    }
    const product = flattenNodes(parsed).find(isProductNode);
    if (product) return product;
  }
  return null;
}

function extractOgImage(html: string): string | null {
  return (html.match(OG_IMAGE_RE) ?? html.match(OG_IMAGE_REVERSED_RE))?.[1] ?? null;
}

/**
 * 商品画像の枚数を数える。
 *
 * 商品ページには関連商品の画像も含まれるため、og:image と同じ商品番号を持つ
 * 大サイズ (/l/) の画像URLだけを重複を除いて数える。
 */
function countImages(html: string): number | null {
  const ogImage = extractOgImage(html);
  const itemNo = ogImage?.match(IMAGE_ITEM_NO_RE)?.[1];
  if (!itemNo) return null;

  const pattern = new RegExp(`https://img\\.fril\\.jp/img/${itemNo}/l/[^"'\\s)]+`, 'g');
  const urls = new Set(html.match(pattern) ?? []);
  return urls.size > 0 ? urls.size : null;
}

/**
 * 再出品元の商品情報を取得する。取得・解析に失敗した場合は null を返す
 * （差分チェックができないだけで、処理自体は止めない）。
 */
export async function fetchSourceItem(itemId: string): Promise<SourceItem | null> {
  const url = `https://item.fril.jp/${itemId}`;
  try {
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) {
      warn(`商品ページの取得に失敗しました: ${response.status}`);
      return null;
    }
    const html = await response.text();

    const ld = findProductJsonLd(html);
    if (!ld) {
      warn('商品ページにProductのJSON-LDが見つかりません（差分チェックを省略します）');
      return null;
    }

    const price = typeof ld.offers?.price === 'string' ? Number(ld.offers.price) : ld.offers?.price;

    return {
      name: ld.name ?? null,
      description: ld.description ?? null,
      price: typeof price === 'number' && Number.isFinite(price) ? price : null,
      brand: ld.brand?.name ?? null,
      imageCount: countImages(html),
    };
  } catch (e) {
    warn('商品ページの取得・解析に失敗しました', e);
    return null;
  }
}
