/**
 * 文字列の照合に使う「文字数 + FNV-1a（32bit）ハッシュ」の組。
 *
 * 説明文の一括置換では、保存前後の本文を何度も突き合わせる。
 * 文字数だけでは置換の取りこぼしを見分けられず、本文そのものを
 * メッセージや記録に載せると肥大化するため、この組で比べる。
 * Background と Content Script の双方から使う。
 */

export interface TextFingerprint {
  length: number;
  /** FNV-1a 32bit を 8 桁の 16 進で表したもの */
  hash: string;
}

/** FNV-1a（32bit）。依存を増やさずに済む軽量なハッシュ */
export function fnv1a32(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function fingerprint(text: string): TextFingerprint {
  return { length: text.length, hash: fnv1a32(text) };
}

export function sameFingerprint(a: TextFingerprint, b: TextFingerprint): boolean {
  return a.length === b.length && a.hash === b.hash;
}

/**
 * 改行コードだけを LF に揃える（CRLF / CR → LF）。改行以外の文字は一切変えない。
 *
 * 確定版は LF で持っているが、サーバーから返る本文は CRLF になりうるため、
 * 照合の前にこれを通す。
 */
export function normalizeLineBreaks(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}
