/**
 * 一覧ページのContent Scriptが持つ実行中の状態。
 *
 * 一覧の再描画・一括操作バー・Backgroundからのメッセージの3か所から
 * 読み書きされるため、暗黙に共有されるローカル変数ではなくここにまとめる。
 * Content Scriptはページ読み込みごとに作り直されるので、この状態も
 * 読み込みごとに初期化される。
 */
export class QueueState {
  /** キュー実行中は、後から現れたチェックボックスも無効にしておく */
  private queueRunning = false;
  /** LIST_READY はページ読み込みごとに1回だけ送る */
  private listReadySent = false;

  isQueueRunning(): boolean {
    return this.queueRunning;
  }

  setQueueRunning(running: boolean): void {
    this.queueRunning = running;
  }

  isListReadySent(): boolean {
    return this.listReadySent;
  }

  markListReadySent(): void {
    this.listReadySent = true;
  }
}

/**
 * QueueStateのシングルトンインスタンス
 */
export const queueState = new QueueState();
