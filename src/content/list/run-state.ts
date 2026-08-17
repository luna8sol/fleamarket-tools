import { setCheckboxesEnabled } from './ui/checkbox-manager';

/**
 * 一覧ページのContent Scriptが持つ「キュー実行中かどうか」。
 *
 * 一覧の再描画・一括操作バー・Backgroundからのメッセージの3か所から
 * 読み書きされるため、暗黙に共有されるローカル変数ではなくここにまとめる。
 * Content Scriptはページ読み込みごとに作り直されるので、この状態も
 * 読み込みごとに初期化される。
 *
 * チェックボックスの有効/無効を切り替えるためui層へ依存する。
 * logic層からui層を参照しないよう、このモジュールだけ直下に置いている。
 */
export class ListRunState {
  /** キュー実行中は、後から現れたチェックボックスも無効にしておく */
  private queueRunning = false;

  isQueueRunning(): boolean {
    return this.queueRunning;
  }

  /**
   * 実行中かどうかを切り替える。
   *
   * チェックボックスの有効/無効は実行中かどうかと必ず一致していなければ
   * ならない（ずれると、操作できるのに一覧の再描画で突然無効化される）。
   * 呼び出し側が組で呼ぶことに頼らず、ここで必ず同時に切り替える。
   */
  setQueueRunning(running: boolean): void {
    this.queueRunning = running;
    setCheckboxesEnabled(!running);
  }
}

/**
 * ListRunStateのシングルトンインスタンス
 */
export const listRunState = new ListRunState();
