import { MESSAGE_ACTION } from '../../common/messaging';
import { sendToRuntime } from '../../common/send-message';
import { debug, warn } from '../infra/logger';

/**
 * 再出品タブの後始末。
 *
 * 再出品タブは下書き保存に成功すると下書き一覧へ遷移し、開いたまま残ります。
 * 一括再出品では件数ぶんタブが積み上がるため、拡張機能が保存したタブだけを閉じます。
 *
 * **content script は自分のタブIDを知りません。** また `window.close()` は
 * スクリプトが開いたウィンドウでしか確実に動きません。そのため、タブIDを知っている
 * background に依頼する形にしています。
 */

/**
 * このタブを「下書き保存後に閉じる」と印を付ける
 *
 * 保存ボタンを押す**前**に呼びます。押すと遷移して content script ごと
 * 破棄されるため、押したあとでは依頼を送れません。
 *
 * @returns 印を付けられたか
 */
export async function markThisTabForClose(): Promise<boolean> {
  try {
    const response = await sendToRuntime({
      action: MESSAGE_ACTION.MARK_TAB_FOR_CLOSE,
    });

    debug('タブに閉じる印を依頼しました', { ok: response?.ok });
    return response?.ok === true;
  } catch (e) {
    // 印が付かなくてもタブが残るだけなので、保存自体は続行する
    warn('タブに閉じる印を付けられませんでした', e);
    return false;
  }
}

/**
 * 印が付いていればこのタブを閉じてもらう
 *
 * 下書き一覧ページの読み込み時に呼びます。印のタブIDと一致したときだけ閉じるため、
 * ユーザーが自分で開いた下書き一覧が閉じることはありません。
 */
export async function closeThisTabIfMarked(): Promise<void> {
  try {
    const response = await sendToRuntime({
      action: MESSAGE_ACTION.CLOSE_TAB_IF_MARKED,
    });

    if (response?.ok) debug('下書き保存後のタブとして閉じられます');
  } catch (e) {
    warn('タブを閉じる依頼に失敗しました', e);
  }
}
