/**
 * 拡張機能の UI で使う線画アイコン（24×24、stroke 描画）の共通部分。
 *
 * **innerHTML を使わず createElementNS で組み立てる。** サイト側の CSP
 * （Trusted Types など）が変わったときに、文字列からの DOM 生成だけが
 * 突然失敗するのを避けるため。
 *
 * アイコンの一覧と SVG に付けるクラス名は拡張ごとに違うため、ここには
 * 両拡張で同じパスを持つアイコンと、一覧・クラス名を受け取って `createIcon` を
 * 作る工場関数だけを置く。各拡張の `IconName` 型は、それぞれの一覧から導く。
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** 半径 10 の円（12,12 中心）をパスで表したもの */
export const CIRCLE = 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z';

/** アイコン名とパス（d 属性）の対応 */
export type IconPaths = Record<string, readonly string[]>;

/** 両拡張で同じパスを使っているアイコン */
export const COMMON_ICON_PATHS = {
  close: ['M18 6 6 18', 'm6 6 12 12'],
  check: ['M20 6 9 17l-5-5'],
  success: [CIRCLE, 'm9 12 2 2 4-4'],
  error: [CIRCLE, 'M12 8v4', 'M12 16h.01'],
  warning: [
    'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3',
    'M12 9v4',
    'M12 17h.01',
  ],
  info: [CIRCLE, 'M12 16v-4', 'M12 8h.01'],
  publish: [
    'M14.54 21.69a.5.5 0 0 0 .94-.03l6.5-19a.5.5 0 0 0-.64-.63l-19 6.5a.5.5 0 0 0-.02.93l7.93 3.18a2 2 0 0 1 1.11 1.11Z',
    'm21.85 2.15-10.94 10.94',
  ],
  trash: [
    'M3 6h18',
    'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6',
    'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2',
    'M10 11v6',
    'M14 11v6',
  ],
  fileJson: [
    'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z',
    'M14 2v4a2 2 0 0 0 2 2h4',
    'M10 12a1 1 0 0 0-1 1v1a1 1 0 0 1-1 1 1 1 0 0 1 1 1v1a1 1 0 0 0 1 1',
    'M14 18a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1 1 1 0 0 1-1-1v-1a1 1 0 0 0-1-1',
  ],
  upload: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm17 8-5-5-5 5', 'M12 3v12'],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm7 10 5 5 5-5', 'M12 15V3'],
  play: ['M6 3 20 12 6 21Z'],
  stop: ['M8 6h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z'],
  clock: [CIRCLE, 'M12 6v6l4 2'],
  layers: [
    'M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z',
    'm22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65',
    'm22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65',
  ],
} as const;

export interface IconFactory<P extends IconPaths> {
  /**
   * アイコンの SVG 要素を作る
   *
   * 読み上げには出さない（aria-hidden）。意味はボタンの文言や aria-label で伝える。
   *
   * @param name アイコン名
   * @param size 一辺の大きさ（px）
   */
  createIcon(name: keyof P & string, size?: number): SVGSVGElement;
  /** HTML の data 属性など、型の付かない文字列がアイコン名かどうか */
  isIconName(value: string | undefined): value is keyof P & string;
}

/**
 * アイコンの一覧と SVG に付けるクラス名から、その拡張用の `createIcon` を作る
 */
export function createIconFactory<P extends IconPaths>(
  paths: P,
  className: string
): IconFactory<P> {
  return {
    createIcon(name: keyof P & string, size = 16): SVGSVGElement {
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('width', String(size));
      svg.setAttribute('height', String(size));
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      svg.classList.add(className);

      for (const d of paths[name]) {
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', d);
        svg.appendChild(path);
      }

      return svg;
    },
    isIconName(value: string | undefined): value is keyof P & string {
      return value !== undefined && Object.prototype.hasOwnProperty.call(paths, value);
    },
  };
}
