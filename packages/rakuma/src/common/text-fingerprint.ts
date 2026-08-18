/**
 * 文字列の照合に使う「文字数 + FNV-1a（32bit）ハッシュ」の組。
 *
 * 説明文の一括置換では、保存前後の本文を何度も突き合わせる。
 * 文字数だけでは置換の取りこぼしを見分けられず、本文そのものを
 * メッセージや記録に載せると肥大化するため、この組で比べる。
 * Background と Content Script の双方から使う。
 *
 * ハッシュの計算と改行の正規化は `@fleamarket/core/text-hash`、組の組み立てと比較は
 * `@fleamarket/core/text-fingerprint` にある。
 * 8 桁 16 進という表記は保存済みの記録と照合するための値なので、ここで付けて変えない。
 */
import { createFingerprint } from '@fleamarket/core/text-fingerprint';
import { fnv1a32 as fnv1a32Number } from '@fleamarket/core/text-hash';

export { sameFingerprint } from '@fleamarket/core/text-fingerprint';
export type { TextFingerprint } from '@fleamarket/core/text-fingerprint';
export { normalizeLineBreaks } from '@fleamarket/core/text-hash';

/** FNV-1a（32bit）を 8 桁の 16 進で返す */
export function fnv1a32(text: string): string {
  return fnv1a32Number(text).toString(16).padStart(8, '0');
}

/** 文字数と 8 桁 16 進のハッシュの組を返す */
export const fingerprint = createFingerprint(fnv1a32);
