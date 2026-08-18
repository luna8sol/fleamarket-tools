/**
 * 本文の照合に使う「文字数 + ハッシュ」の組（両拡張で共通の骨格）。
 *
 * 説明文の一括置換では、原本・確定版・保存後の本文を何度も突き合わせる。文字数だけでは
 * 置換の取りこぼしを見分けられず、本文そのものをメッセージや記録に載せると肥大化するため、
 * この組で比べる。
 *
 * ハッシュの**文字列表記は拡張ごとに違う**（メルカリ用は 10 進、ラクマ用は 8 桁の 16 進）。
 * どちらも保存済みの記録に入っていて照合に使われるため、表記を付けたハッシュ関数を
 * `createFingerprint` に注入し、ここでは組み立てと比較だけを持つ。
 */

export interface TextFingerprint {
  length: number;
  /** ハッシュの文字列表記（表記は拡張ごとに違う） */
  hash: string;
}

/**
 * 文字数とハッシュの組を作る関数を、ハッシュの表記を決めた関数から組み立てる。
 *
 * @param hash 本文のハッシュを、記録と同じ表記の文字列で返す関数
 */
export function createFingerprint(
  hash: (text: string) => string
): (text: string) => TextFingerprint {
  return (text: string): TextFingerprint => ({ length: text.length, hash: hash(text) });
}

/** 2 つの指紋が一致するか（文字数とハッシュの両方） */
export function sameFingerprint(a: TextFingerprint, b: TextFingerprint): boolean {
  return a.length === b.length && a.hash === b.hash;
}
