import { CONFIG } from '../infra/constants';
import { debug } from '../infra/logger';
import { waitFor } from '../../common/utils';

/**
 * 同一オリジンの隠し iframe でメルカリのページを開くための共通処理。
 *
 * 元商品のスナップショット取得と一括削除が、どちらも
 * 「一覧ページから離れずに `/sell/edit/{itemId}` を操作する」ために使います。
 *
 * **`display: none` にしてはいけません。** 表示されていない要素の `innerText` は
 * `textContent` と同じ扱いになり、カテゴリー階層などの改行区切りが失われます。
 * 画面外へ追い出して不可視にします。
 */

/**
 * 隠し iframe を作って document に追加する
 *
 * @param url 読み込むURL
 * @returns 追加済みのiframe。使い終わったら呼び出し側が必ず `remove()` する
 */
export function openHiddenFrame(url: string): HTMLIFrameElement {
  const frame = document.createElement('iframe');

  frame.src = url;
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('tabindex', '-1');
  frame.style.cssText = [
    'position: fixed',
    'left: -10000px',
    'top: 0',
    'width: 1024px',
    'height: 800px',
    'opacity: 0',
    'border: 0',
    'pointer-events: none',
  ].join('; ');

  document.body.appendChild(frame);
  debug('隠しiframeを開きました', { url });
  return frame;
}

/**
 * iframe の Document が同一オリジンとして読める状態かを確認する
 *
 * @param frame 対象のiframe
 * @returns 読める場合はその Document。読めない場合は null
 */
export function readableDocument(frame: HTMLIFrameElement): Document | null {
  try {
    return frame.contentDocument;
  } catch {
    // クロスオリジン扱いになった場合（想定外のリダイレクト等）
    return null;
  }
}

/**
 * iframe の Document が条件を満たすまで待つ
 *
 * **読み込みが完了すると `contentDocument` は別のオブジェクトに差し替わります。**
 * 1度だけ取得して使い回すと、いつまでも古い document を見続けることになるため、
 * ポーリングのたびに取り直します。
 *
 * @param frame 対象のiframe
 * @param isReady 準備完了かどうかの判定
 * @param timeoutMs 待機の上限（ミリ秒）
 * @returns 条件を満たした Document。時間切れなら null
 */
export async function waitForFrameDocument(
  frame: HTMLIFrameElement,
  isReady: (doc: Document) => boolean,
  timeoutMs: number
): Promise<Document | null> {
  return waitFor(
    () => {
      const candidate = readableDocument(frame);
      return candidate && isReady(candidate) ? candidate : null;
    },
    timeoutMs,
    CONFIG.SELL_FORM_POLL_INTERVAL_MS
  );
}
