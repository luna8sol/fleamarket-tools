/**
 * 拡張機能の UI で使う線画アイコン（24×24、stroke 描画）。
 *
 * SVG の組み立てと、両拡張で共通のアイコンは共有部品 `@fleamarket/core/icons` にある。
 * ここにはこの拡張だけが使うアイコンと、SVG に付けるクラス名（`mdp-icon`）を置く。
 */
import { COMMON_ICON_PATHS, createIconFactory } from '@fleamarket/core/icons';

/** アイコン名とパス（d 属性）の対応 */
const ICON_PATHS = {
  ...COMMON_ICON_PATHS,
  heart: [
    'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z',
  ],
  comment: ['M7.9 20A9 9 0 1 0 4 16.1L2 22Z'],
  sparkles: [
    'M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0l1.58 6.14a2 2 0 0 0 1.44 1.44l6.14 1.58a.5.5 0 0 1 0 .96l-6.14 1.58a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0Z',
    'M20 3v4',
    'M22 5h-4',
  ],
  selectUpTo: ['M5 3h14', 'm18 13-6-6-6 6', 'M12 7v14'],
  relist: [
    'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8',
    'M21 3v5h-5',
    'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16',
    'M8 16H3v5',
  ],
  fileText: [
    'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z',
    'M14 2v4a2 2 0 0 0 2 2h4',
    'M16 13H8',
    'M16 17H8',
    'M10 9H8',
  ],
  retry: ['M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8', 'M3 3v5h5'],
} as const;

/** 使えるアイコン名 */
export type IconName = keyof typeof ICON_PATHS;

const icons = createIconFactory(ICON_PATHS, 'mdp-icon');

/**
 * アイコンの SVG 要素を作る
 *
 * 読み上げには出さない（aria-hidden）。意味はボタンの文言や aria-label で伝える。
 *
 * @param name アイコン名
 * @param size 一辺の大きさ（px）
 * @returns 生成した SVG 要素
 */
export function createIcon(name: IconName, size = 16): SVGSVGElement {
  return icons.createIcon(name, size);
}
