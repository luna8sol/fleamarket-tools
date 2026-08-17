/**
 * 拡張機能の UI で使う線画アイコン（24×24、stroke 描画）。
 *
 * SVG の組み立てと、両拡張で共通のアイコンは共有部品 `@fleamarket/core/icons` にある。
 * ここにはこの拡張だけが使うアイコンと、SVG に付けるクラス名（`rbl-icon`）を置く。
 *
 * 注入 UI と popup の両方で使うので src/common に置く。
 */
import { COMMON_ICON_PATHS, createIconFactory } from '@fleamarket/core/icons';

/** アイコン名とパス（d 属性）の対応 */
const ICON_PATHS = {
  ...COMMON_ICON_PATHS,
  /** 下書きに保存（トレイに入れる） */
  draft: [
    'M22 12h-6l-2 3h-4l-2-3H2',
    'M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z',
  ],
  /** 説明文の置換 */
  replace: [
    'M12 20h9',
    'M16.38 3.62a1 1 0 0 1 3 3L7.37 18.64a2 2 0 0 1-.85.5l-2.87.84a.5.5 0 0 1-.62-.62l.84-2.87a2 2 0 0 1 .5-.85Z',
  ],
  arrowRight: ['M5 12h14', 'm12 5 7 7-7 7'],
  sun: [
    'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    'M12 2v2',
    'M12 20v2',
    'm4.93 4.93 1.41 1.41',
    'm17.66 17.66 1.41 1.41',
    'M2 12h2',
    'M20 12h2',
    'm6.34 17.66-1.41 1.41',
    'm19.07 4.93-1.41 1.41',
  ],
  moon: ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z'],
  monitor: [
    'M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z',
    'M8 21h8',
    'M12 17v4',
  ],
  shield: [
    'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z',
    'm9 12 2 2 4-4',
  ],
} as const;

/** 使えるアイコン名 */
export type IconName = keyof typeof ICON_PATHS;

const icons = createIconFactory(ICON_PATHS, 'rbl-icon');

/** HTML の data 属性など、型の付かない文字列がアイコン名かどうか */
export function isIconName(value: string | undefined): value is IconName {
  return icons.isIconName(value);
}

/**
 * アイコンの SVG 要素を作る
 *
 * 読み上げには出さない（aria-hidden）。意味はボタンの文言や aria-label で伝える。
 */
export function createIcon(name: IconName, size = 16): SVGSVGElement {
  return icons.createIcon(name, size);
}
