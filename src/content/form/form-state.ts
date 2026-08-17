/**
 * 出品フォームが「入力済み」になったかを判定するモジュール。
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
