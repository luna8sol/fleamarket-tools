import { waitFor } from '../../common/utils';
import { CONFIG } from '../infra/constants';
import { debug, debugMethodEnd, debugMethodStart, warn } from '../infra/logger';
import { ItemSnapshot } from '../infra/types';
import { isSellFormReady, readSellForm, waitForSellFormImages } from './sell-form';

/**
 * 元商品のスナップショット取得。
 *
 * 再出品ボタンを押す前に、元商品の**編集フォーム**（`/sell/edit/{itemId}`）を
 * 同一オリジンの隠しiframeで読み込み、比較の基準となる値を記録します。
 *
 * **商品ページのHTMLからは商品データを取り出せません。** メルカリは
 * Next.js App Router (RSC) に移行済みで `#__NEXT_DATA__` は存在せず、
 * 商品ページを fetch しても `loading-skeleton` しか返りません（2026-09-17 実地確認）。
 *
 * 編集フォームを基準にするのは、再出品フォームと**同じ部品でできている**ためです。
 * カテゴリー・商品の状態・配送の方法は表示テキストで比較することになりますが、
 * フォーム対フォームなら表現が一致し、表示テキストと ID の変換表を持たずに済みます。
 *
 * **このiframeでフォームを保存することはありません。** 読み取り専用で使い、
 * 読み終えたら必ず破棄します。
 */

/** メルカリの商品IDの形式（m + 数字） */
const ITEM_ID_PATTERN = /^m\d+$/;

/**
 * 一覧ページが保持する商品IDから、URL に使える商品IDを取り出す
 *
 * 出品中一覧のチェックボックスは `data-item-id` に商品リンクの href を
 * そのまま入れているため、値は `/item/m123...` の形で渡ってきます。
 * 形式が想定と違う場合は URL を組み立てず null を返します
 * （存在しない URL を開いてタイムアウトを待つより、その場で失敗させるため）。
 *
 * @param rawId 一覧ページから渡された商品ID
 * @returns `m` + 数字 の商品ID。解釈できない場合は null
 */
function toItemId(rawId: string): string | null {
  const id = rawId.replace(/^\/item\//, '').trim();
  return ITEM_ID_PATTERN.test(id) ? id : null;
}

/**
 * スナップショット取得用の隠しiframeを作る
 *
 * `display: none` にはしません。表示されていない要素の `innerText` は
 * `textContent` と同じ扱いになり、カテゴリー階層や配送の方法の
 * **改行区切りが失われる**ためです。画面外へ追い出して不可視にします。
 *
 * @param url 読み込む編集フォームのURL
 * @returns 生成したiframe（まだ document には追加していない）
 */
function createHiddenFrame(url: string): HTMLIFrameElement {
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

  return frame;
}

/**
 * iframe の Document が同一オリジンとして読める状態かを確認する
 *
 * @param frame 対象のiframe
 * @returns 読める場合はその Document。読めない場合は null
 */
function readableDocument(frame: HTMLIFrameElement): Document | null {
  try {
    return frame.contentDocument;
  } catch {
    // クロスオリジン扱いになった場合（想定外のリダイレクト等）
    return null;
  }
}

/**
 * 取得に失敗したスナップショットを作る
 *
 * @param itemId 元商品のID
 * @param itemName 元商品の商品名
 * @param reason 失敗理由
 * @returns captured: false のスナップショット
 */
function failedSnapshot(itemId: string, itemName: string, reason: string): ItemSnapshot {
  warn(`元商品のスナップショット取得に失敗: ${itemId} - ${reason}`);
  return {
    itemId,
    itemName,
    captured: false,
    captureError: reason,
    capturedAt: Date.now(),
    values: {},
  };
}

/**
 * 元商品のスナップショットを取得する
 *
 * 取得に失敗した場合も captured: false のスナップショットを返します。
 * 比較の基準がない状態で自動保存しないよう、呼び出し側で判定してください。
 *
 * @param itemId 元商品のID
 * @param itemName 元商品の商品名（ログ・通知用）
 * @returns 元商品のスナップショット
 */
export async function captureItemSnapshot(itemId: string, itemName: string): Promise<ItemSnapshot> {
  const startTime = performance.now();
  debugMethodStart('captureItemSnapshot', { itemId, itemName });

  const resolvedId = toItemId(itemId);
  if (!resolvedId) {
    return failedSnapshot(itemId, itemName, `商品IDを解釈できません: "${itemId}"`);
  }

  // 失敗したときにどのURLを開いたのかが分かるよう、組み立てた結果を残す
  const frameUrl = `${window.location.origin}/sell/edit/${encodeURIComponent(resolvedId)}`;
  const frame = createHiddenFrame(frameUrl);

  try {
    document.body.appendChild(frame);

    // 読み込みが完了すると contentDocument は別のオブジェクトに差し替わるため、
    // 1度だけ取得して使い回さず、ポーリングのたびに取り直す。
    // 編集フォームは React で遅延描画されるので、商品名が埋まるまで待つ。
    const loaded = await waitFor(
      () => {
        const candidate = readableDocument(frame);
        return candidate && isSellFormReady(candidate) ? candidate : null;
      },
      CONFIG.SNAPSHOT_IFRAME_TIMEOUT_MS,
      CONFIG.SELL_FORM_POLL_INTERVAL_MS
    );

    if (!loaded) {
      return failedSnapshot(
        itemId,
        itemName,
        `編集フォームの読み込みがタイムアウトしました: ${frameUrl}（${Math.round(CONFIG.SNAPSHOT_IFRAME_TIMEOUT_MS / 1000)}秒）`
      );
    }

    // 画像は商品名より遅れて描画されるため、枚数が安定するまで待つ
    await waitForSellFormImages(loaded);

    const { values, unresolved } = readSellForm(loaded);

    if (values.name === undefined || values.name === '') {
      return failedSnapshot(itemId, itemName, '編集フォームから商品名を読み取れませんでした');
    }

    if (unresolved.length > 0) {
      // 読めなかった項目は values に入らず、比較の対象外になる。
      // 「一致していた」と誤認しないよう、必ず記録に残す。
      warn('元商品の一部の項目を読み取れませんでした', { itemId, unresolved });
    }

    const snapshot: ItemSnapshot = {
      itemId: resolvedId,
      itemName,
      captured: true,
      capturedAt: Date.now(),
      values,
    };

    const duration = Math.round(performance.now() - startTime);
    debug('元商品のスナップショットを取得しました', { itemId, values });
    debugMethodEnd('captureItemSnapshot', { itemId, capturedKeys: Object.keys(values) }, duration);

    return snapshot;
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    debugMethodEnd('captureItemSnapshot', { itemId, success: false, error: reason });
    return failedSnapshot(itemId, itemName, reason);
  } finally {
    // 読み取りに成功しても失敗しても、iframe は必ず片付ける
    frame.remove();
  }
}
