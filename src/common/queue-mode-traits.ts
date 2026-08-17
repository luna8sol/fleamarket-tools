/**
 * キューのモードごとの性質表。
 *
 * 「一覧タブに依存するか」「出品フォームを使うか」「一覧の再読み込みで完了を判定するか」
 * 「商品間に待機を挟むか」といった性質は、以前は `mode === 'delete'` のような個別の比較として
 * Background と URL 判定の各所へ散っていた。その形だと QueueMode にモードを足したとき、
 * switch で網羅している箇所（QueueManager.processCurrent）だけがコンパイルエラーになり、
 * 残りは黙って既存の分岐に落ちる。
 *
 * Record<QueueMode, QueueModeTraits> にまとめておくと、モードを足した時点で
 * **全性質の記入が型で強制される**。
 * **モードによって変わる振る舞いを増やすときは、個別の比較を書かずにここへ性質を足すこと。**
 *
 * src/common に置いてあるのは、Background (src/background/queue-manager.ts) と、
 * Background・Content Script の双方から使う URL 判定 (src/common/form-page.ts) の
 * 両方が参照するため。queue-manager.ts は form-page.ts を import しているので、
 * 表を queue-manager.ts へ置くと循環 import になり、かつ Background 専用のコードが
 * Content Script のバンドルに入ってしまう。
 */

import { QueueMode } from './messages';

/**
 * 1つのモードの性質。
 *
 * ここに並ぶのは**モードによって変わる振る舞い**だけで、モード固有の状態
 * （QueueState の deletePage など）は対象外。
 */
export interface QueueModeTraits {
  /**
   * 一覧タブのクリック（再出品ボタン・削除リンク）に依存する。
   *
   * true のモードは一覧タブが閉じられた時点で続行できないため、
   * QueueManager.handleTabRemoved がキューを停止する。
   * publish は下書きの編集ページを Background が自分で開くので false。
   */
  requiresListTab: boolean;

  /**
   * 出品フォームのページ（/item/new・/drafts/{hash}/edit）を開いて操作する。
   *
   * false のモードには対応する出品フォームが無いため、isFormPageUrl は常に false を返す。
   * delete は一覧ページ内で完結する。
   */
  usesFormPage: boolean;

  /**
   * 1商品の完了を、一覧の再読み込み（LIST_READY）で判定する。
   *
   * false のモードは、出品フォームの URL から離れたこと（handleFormDeparture）で判定する。
   */
  completesOnListReady: boolean;

  /**
   * 次の商品へ進む前に、商品間の待機（WAIT_BETWEEN_ITEMS_MS + WAIT_RANDOM_MS）を挟む。
   *
   * false にしてよいのは、ページ遷移そのものが間隔になり、かつクリック前の待機を
   * Content Script 側で入れているモード（delete）だけ。
   * **待機はラクマへの連打を避けるための安全装置なので、他のモードで false にしないこと。**
   */
  waitsBetweenItems: boolean;

  /**
   * ログに出す操作名。「◯◯完了」「◯◯失敗」として使う。
   */
  actionLabel: string;
}

/**
 * モードごとの性質。
 *
 * Record なのでモードを足すと記入漏れがコンパイルエラーになる。
 * **値を変えると停止条件や待機が変わる。とくに delete は実機未検証なので、
 * 変更するなら実機確認までを1単位にすること。**
 */
export const QUEUE_MODE_TRAITS: Record<QueueMode, QueueModeTraits> = {
  relist: {
    requiresListTab: true,
    usesFormPage: true,
    completesOnListReady: false,
    waitsBetweenItems: true,
    actionLabel: '出品',
  },
  publish: {
    requiresListTab: false,
    usesFormPage: true,
    completesOnListReady: false,
    waitsBetweenItems: true,
    actionLabel: '出品',
  },
  delete: {
    requiresListTab: true,
    usesFormPage: false,
    completesOnListReady: true,
    waitsBetweenItems: false,
    actionLabel: '削除',
  },
};
