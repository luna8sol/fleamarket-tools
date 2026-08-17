/**
 * 出品フォームの状態（入力済みか・バリデーションエラーが出ているか）を読むモジュール。
 *
 * relistモードでは、フリマアシストが /item/new へ遷移させたあとに
 * 元商品の内容をフォームへ流し込む。描画直後に「確認する」を押すと
 * 空のフォームを送ってしまうため、値が入るのを待ってからクリックする。
 * publishモード（下書き編集）でも、Reactがフォームに値を復元し終えた
 * ことの確認として同じ判定が使える。
 */

import { waitFor } from './wait';

/**
 * フォームのテキスト入力欄に1つでも値が入っているか。
 *
 * NOTE: Chakra UIのハッシュクラスや動的なname属性には依存できないため、
 * 「テキスト系の入力欄に値があるか」という粗い判定にしている。
 * 実機では空の /item/new で false、入力済みの下書き編集ページで true になる。
 */
export function isFormFilled(): boolean {
  const textareas = Array.from(document.querySelectorAll<HTMLTextAreaElement>('textarea'));
  if (textareas.some((el) => el.value.trim() !== '')) {
    return true;
  }

  const inputs = Array.from(
    document.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])')
  );
  return inputs.some((el) => el.value.trim() !== '');
}

/**
 * フォームに値が入るまで待機する。
 * タイムアウトしてもrejectせず false を返す（判定はあくまで粗い
 * ヒューリスティックであり、これを理由に出品を中断はしない）。
 */
export async function waitForFormFilled(timeoutMs: number): Promise<boolean> {
  try {
    await waitFor(() => (isFormFilled() ? true : null), {
      timeoutMs,
      label: 'フォームへの入力',
    });
    return true;
  } catch {
    return false;
  }
}

/** 失敗理由に添えるエラー文言の最大件数 */
const MAX_ERRORS = 4;

/**
 * 画面に出ているバリデーションエラーの文言を集める。
 *
 * 入力不備で「確認する」が先へ進まない場合、失敗理由としてこれを添えると
 * どの商品がなぜ止まったのかがユーザー側で分かる
 * （例:「商品名を入力してください。」）。
 */
export function collectValidationErrors(): string[] {
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>('[class*="error"], [aria-invalid="true"]')
  );
  const texts = nodes
    .map((el) => el.textContent?.trim() ?? '')
    .filter((text) => text.length > 0 && text.length <= 60);
  return Array.from(new Set(texts)).slice(0, MAX_ERRORS);
}
