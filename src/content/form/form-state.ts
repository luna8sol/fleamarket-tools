import { delay } from '../wait';

/**
 * 出品フォームの内容を読み取り、入力が落ち着くまで待つモジュール。
 *
 * relistモードでは、フリマアシストが /item/new へ遷移させたあとに元商品の
 * 内容を流し込む。テキストは速いが、**画像は img.fril.jp/tmp_img/ へ
 * アップロードされるまで時間がかかる**。そのため「何か値が入ったか」では早すぎ、
 * 一部が欠けたまま保存されてしまう。
 *
 * ここでは各項目のスナップショットを取り、一定時間まったく変化しなくなった
 * ことをもって入力完了とみなす。
 */

/** ポーリング間隔 (ms) */
const POLL_INTERVAL_MS = 500;

/**
 * 出品フォームの内容のスナップショット。
 *
 * NOTE: カテゴリや配送方法はボタンのラベルとして表示されるが、
 *       手数料の案内など内容が変わりうるボタンも混ざるため、
 *       安定判定には含めない（変化し続けて落ち着かなくなるのを避ける）。
 */
export interface FormSnapshot {
  itemName: string;
  sellPrice: string;
  description: string;
  /** select の name → 選択値 */
  selects: Record<string, string>;
  /** アップロード済みの商品画像の枚数 */
  imageCount: number;
}

/**
 * アップロード済みの商品画像の枚数を数える。
 *
 * 画像は img.fril.jp 配下のURLとして現れる（/item/new では tmp_img/）。
 * UIの素材画像は asset.fril.jp など別ホストなので混ざらない。
 */
export function countFormImages(): number {
  const srcs = Array.from(document.querySelectorAll<HTMLImageElement>('img'))
    .map((img) => img.src)
    .filter((src) => src.includes('img.fril.jp/'));
  return new Set(srcs).size;
}

/**
 * 画像の枚数とURLの形を、失敗理由に載せられる短い文字列にする。
 *
 * 枚数の数え方（`img.fril.jp` の重複を除いたURL数）が実際のページとズレていた場合、
 * 一致しない理由が分からず延々と待つことになる。1回の失敗でURLの形が分かるようにする。
 */
export function describeFormImages(): string {
  const srcs = Array.from(document.querySelectorAll<HTMLImageElement>('img'))
    .map((img) => img.src)
    .filter((src) => src.includes('img.fril.jp/'));

  const shapes = new Set(
    srcs.map((src) =>
      src
        .replace('https://img.fril.jp/', '')
        .split('?')[0]
        .replace(/\d{4,}/g, 'N')
    )
  );
  return `${new Set(srcs).size}枚 [${Array.from(shapes).slice(0, 4).join(' ')}]`;
}

export function collectFormSnapshot(): FormSnapshot {
  const value = (selector: string): string =>
    document.querySelector<HTMLInputElement>(selector)?.value ?? '';

  const selects: Record<string, string> = {};
  for (const select of Array.from(document.querySelectorAll<HTMLSelectElement>('select'))) {
    if (select.name) {
      selects[select.name] = select.value;
    }
  }

  return {
    itemName: value('input[name="itemName"]'),
    sellPrice: value('input[name="sellPrice"]'),
    description: document.querySelector<HTMLTextAreaElement>('textarea')?.value ?? '',
    selects,
    imageCount: countFormImages(),
  };
}

/** 安定判定に使う、スナップショットの文字列表現 */
function fingerprint(snapshot: FormSnapshot): string {
  return JSON.stringify(snapshot);
}

/**
 * 必須項目が埋まっているか。
 * これが満たされないうちは、変化が止まっていても「入力完了」とはみなさない。
 */
function hasRequiredValues(snapshot: FormSnapshot, requireImages: boolean): boolean {
  if (snapshot.itemName.trim() === '') return false;
  if (snapshot.description.trim() === '') return false;
  if (snapshot.sellPrice.trim() === '') return false;
  if (requireImages && snapshot.imageCount === 0) return false;
  return true;
}

export interface SettleOptions {
  /** この時間だけ内容が変化しなければ入力完了とみなす (ms) */
  stableMs: number;
  /** 全体の最大待機時間 (ms) */
  timeoutMs: number;
  /** 画像が1枚以上あることを必須にするか */
  requireImages: boolean;
  /**
   * 入力完了の判定条件。再出品元の内容が分かっている場合に渡す。
   *
   * これがあるときは「変化が止まったか」ではなく「元と一致したか」で待つ。
   * 画像は1枚ずつ間隔を空けてアップロードされるため、アップロードの合間が
   * 安定時間を超えると、変化が止まっただけで完了と誤判定してしまうため。
   */
  matchesSource?: ((snapshot: FormSnapshot) => boolean) | null;
}

export interface SettleResult {
  /** 入力完了とみなせたか。false はタイムアウト */
  settled: boolean;
  snapshot: FormSnapshot;
  /** 実際に待った時間 (ms) */
  waitedMs: number;
}

/**
 * フォームの入力が完了するまで待つ。
 *
 * - 再出品元の内容が分かっている場合（matchesSource あり）は、**元と一致するまで**待つ。
 *   画像は1枚ずつ間隔を空けてアップロードされるので、その合間に「変化が止まった」と
 *   判断すると、画像が足りないまま完了扱いになってしまう。
 * - 分からない場合は、一定時間まったく変化しなくなるまで待つ。
 *
 * タイムアウトしてもrejectせず、settled: false を返す（呼び出し側で判断する）。
 */
export async function waitForFormSettled(options: SettleOptions): Promise<SettleResult> {
  const startedAt = Date.now();
  let snapshot = collectFormSnapshot();
  let lastFingerprint = fingerprint(snapshot);
  let lastChangedAt = Date.now();

  for (;;) {
    if (options.matchesSource) {
      if (options.matchesSource(snapshot)) {
        return { settled: true, snapshot, waitedMs: Date.now() - startedAt };
      }
    } else {
      const stableFor = Date.now() - lastChangedAt;
      if (stableFor >= options.stableMs && hasRequiredValues(snapshot, options.requireImages)) {
        return { settled: true, snapshot, waitedMs: Date.now() - startedAt };
      }
    }

    if (Date.now() - startedAt >= options.timeoutMs) {
      return { settled: false, snapshot, waitedMs: Date.now() - startedAt };
    }

    await delay(POLL_INTERVAL_MS);

    snapshot = collectFormSnapshot();
    const current = fingerprint(snapshot);
    if (current !== lastFingerprint) {
      lastFingerprint = current;
      lastChangedAt = Date.now();
    }
  }
}

/** 失敗理由に添えるエラー文言の最大件数 */
const MAX_ERRORS = 4;

/**
 * 画面に出ているバリデーションエラーの文言を集める。
 *
 * 入力不備で先へ進まない場合、失敗理由としてこれを添えると
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
