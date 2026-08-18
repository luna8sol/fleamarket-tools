/**
 * Shift を押しながら選んだときの範囲（両拡張で共通の純関数）。
 *
 * 一覧の並び `items` の中で、起点 `anchor` から押した `target` へ向かう順に並べた要素を返す。
 * **起点を含み、押した要素は含まない。** 押した要素は呼び出し側が最後に切り替える
 * （選んだ順がそのまま処理順になるため、起点 → 押した側 の順で積み、押した行を最後にする）。
 * どちらかが `items` に無いとき、または同じ要素のときは空配列。
 *
 * 範囲の中で実際に切り替えてよい要素（画面に出ている・無効でない・状態が違う）の判定は
 * 拡張ごとに違うので、呼び出し側で行う。
 */
export function rangeBetween<T>(items: readonly T[], anchor: T, target: T): T[] {
  const from = items.indexOf(anchor);
  const to = items.indexOf(target);
  if (from < 0 || to < 0) return [];
  return from < to ? items.slice(from, to) : items.slice(to + 1, from + 1).reverse();
}
