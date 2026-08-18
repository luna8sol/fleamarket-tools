/**
 * 説明文の一括置換パネルの部品（両拡張で共通の骨格）。
 *
 * ファイルを選ぶ欄・番号付きの手順見出し・件数タイル・件数と対象外の内訳・結果種別ごとの
 * バッジ・処理記録の JSON ダウンロードを組み立てる。DOM の構造とクラス名の体系は両拡張で
 * 同じなので、クラス接頭辞（`mdp` / `rbl`）とアイコンの作り方、拡張ごとに違う文言・
 * 表示の細部（見出しの文字を span で包むか、商品IDを短縮するか、ファイル名を title に
 * 出すか）を注入する。両拡張で同じ文言（結果種別のバッジ）はここに置く。
 *
 * パネル本体の組み立て、開始前の確認、待機秒数の検証、二重開始の防止、実行中の入力ロックは
 * 各パッケージのパネルに残す（安全装置に当たるため共通化しない）。
 */
import { ReplaceOutcome } from './replace-store';

export interface ReplacePanelPartsDeps<I extends string> {
  /** クラス接頭辞（`mdp` / `rbl`） */
  prefix: string;
  createIcon: (name: I, size?: number) => SVGSVGElement;
}

export interface FileFieldSpec {
  /** ファイル入力欄。id・type・accept は呼び出し側で設定済みのもの */
  input: HTMLInputElement;
  /** 欄の名前 */
  label: string;
  /** ファイルが選ばれていないときに出す文言 */
  emptyText: string;
  /** 選んだファイル名を欄の title にも出すか */
  titleFromFile?: boolean;
  /** ファイルが選ばれた（または外された）ときに呼ぶ */
  onChange?: () => void;
}

export interface SectionSpec {
  /** 手順の番号 */
  step: number;
  /** 見出し */
  title: string;
  /** まとまりに付ける id */
  id?: string;
  /** 見出しの文字を span で包むか（包まないならテキストノードのまま） */
  wrapTitle?: boolean;
}

/** 計画のうち、件数と内訳の表示が参照する項目 */
export interface PlanSummaryLike {
  total: number;
  targets: readonly unknown[];
  alreadyDone: readonly unknown[];
  excluded: readonly { id: string; name: string; reason: string }[];
}

export interface SummarySpec<I extends string> {
  /** 未読み込みのときの文言 */
  emptyText: string;
  emptyIcon: I;
  emptyIconSize: number;
  /** 件数タイル 4 つの名前 */
  tileLabels: { targets: string; total: string; alreadyDone: string; excluded: string };
  /** 対象外の内訳の見出し */
  exclusionsHead: (count: number) => string;
  /** 対象外の商品IDの出し方。`title` を返すと code 要素の title に入る */
  formatExclusionId: (id: string) => { text: string; title?: string };
  /** 対象外の内訳を並べる上限 */
  maxExclusionLines: number;
}

export type BadgeTone = 'success' | 'info' | 'warning' | 'danger';

/** 結果種別のバッジの並び・文言・色調（両拡張で同じ） */
export const OUTCOME_BADGES: readonly { key: ReplaceOutcome; label: string; tone: BadgeTone }[] = [
  { key: 'applied', label: '成功', tone: 'success' },
  { key: 'already', label: '適用済み', tone: 'info' },
  { key: 'skipped', label: 'スキップ', tone: 'warning' },
  { key: 'failed', label: '失敗', tone: 'danger' },
  { key: 'unverified', label: '未確認', tone: 'warning' },
];

export interface ReplacePanelParts<I extends string> {
  /** ファイルを選ぶ欄を作る（ラベル全体を押せる大きな的にする） */
  buildFileField(spec: FileFieldSpec): HTMLLabelElement;
  /** 番号付きの見出しを持つまとまりを作る */
  buildSection(spec: SectionSpec): HTMLElement;
  /** 件数のタイルを作る */
  buildStatTile(label: string, value: number, emphasis?: boolean): HTMLDivElement;
  /**
   * 計画の件数と対象外の内訳を描く（中身は置き換える）。
   * `plan` が null なら未読み込みの表示にする。
   */
  renderPlanSummary(
    container: HTMLElement,
    plan: PlanSummaryLike | null,
    spec: SummarySpec<I>
  ): void;
  /** 結果種別ごとの件数を丸いバッジで並べる（中身は置き換える） */
  renderOutcomeBadges(container: HTMLElement, counts: Record<ReplaceOutcome, number>): void;
}

export function createReplacePanelParts<I extends string>(
  deps: ReplacePanelPartsDeps<I>
): ReplacePanelParts<I> {
  const { prefix, createIcon } = deps;
  const cls = (name: string): string => `${prefix}-${name}`;

  const buildStatTile = (label: string, value: number, emphasis = false): HTMLDivElement => {
    const tile = document.createElement('div');
    tile.className = cls('fact');
    if (emphasis) tile.dataset.emphasis = 'true';

    const num = document.createElement('span');
    num.className = `${cls('fact__value')} ${cls('num')}`;
    num.textContent = String(value);

    const name = document.createElement('span');
    name.className = cls('fact__label');
    name.textContent = label;

    tile.append(num, name);
    return tile;
  };

  return {
    buildFileField(spec: FileFieldSpec): HTMLLabelElement {
      const { input } = spec;
      const field = document.createElement('label');
      field.className = cls('file');

      const text = document.createElement('span');
      text.className = cls('file__text');

      const label = document.createElement('span');
      label.className = cls('file__label');
      label.textContent = spec.label;

      const name = document.createElement('span');
      name.className = cls('file__name');
      name.textContent = spec.emptyText;

      text.append(label, name);
      field.append(createIcon('fileJson' as I, 20), text, input);

      input.addEventListener('change', () => {
        const file = input.files?.[0];
        name.textContent = file ? file.name : spec.emptyText;
        if (spec.titleFromFile) field.title = file ? file.name : '';
        field.dataset.filled = file ? 'true' : 'false';
        spec.onChange?.();
      });

      return field;
    },

    buildSection(spec: SectionSpec): HTMLElement {
      const wrap = document.createElement('section');
      if (spec.id !== undefined) wrap.id = spec.id;
      wrap.className = cls('section');

      const title = document.createElement('h3');
      title.className = cls('section__title');

      const badge = document.createElement('span');
      badge.className = cls('step');
      badge.textContent = String(spec.step);

      if (spec.wrapTitle) {
        const text = document.createElement('span');
        text.textContent = spec.title;
        title.append(badge, text);
      } else {
        title.append(badge, spec.title);
      }

      wrap.appendChild(title);
      return wrap;
    },

    buildStatTile,

    renderPlanSummary(container, plan, spec): void {
      container.replaceChildren();

      if (!plan) {
        const empty = document.createElement('div');
        empty.className = cls('empty');
        const text = document.createElement('span');
        text.textContent = spec.emptyText;
        empty.append(createIcon(spec.emptyIcon, spec.emptyIconSize), text);
        container.appendChild(empty);
        return;
      }

      const stats = document.createElement('div');
      stats.className = cls('stats');
      stats.append(
        buildStatTile(spec.tileLabels.targets, plan.targets.length, true),
        buildStatTile(spec.tileLabels.total, plan.total),
        buildStatTile(spec.tileLabels.alreadyDone, plan.alreadyDone.length),
        buildStatTile(spec.tileLabels.excluded, plan.excluded.length)
      );
      container.appendChild(stats);

      if (plan.excluded.length > 0) {
        const list = document.createElement('ul');
        list.className = cls('exclusions');

        const head = document.createElement('li');
        head.className = cls('exclusions__head');
        head.textContent = spec.exclusionsHead(plan.excluded.length);
        list.appendChild(head);

        for (const exclusion of plan.excluded.slice(0, spec.maxExclusionLines)) {
          const li = document.createElement('li');
          const id = document.createElement('code');
          const shown = spec.formatExclusionId(exclusion.id);
          id.textContent = shown.text;
          if (shown.title !== undefined) id.title = shown.title;
          li.append(id, ` ${exclusion.name}: ${exclusion.reason}`);
          list.appendChild(li);
        }

        if (plan.excluded.length > spec.maxExclusionLines) {
          const rest = document.createElement('li');
          rest.textContent = `…ほか${plan.excluded.length - spec.maxExclusionLines}件`;
          list.appendChild(rest);
        }

        container.appendChild(list);
      }
    },

    renderOutcomeBadges(container, counts): void {
      container.replaceChildren();
      for (const { key, label, tone } of OUTCOME_BADGES) {
        const value = counts[key];
        const badge = document.createElement('span');
        badge.className = cls('badge');
        badge.dataset.tone = tone;
        badge.dataset.nonzero = value > 0 ? 'true' : 'false';

        const num = document.createElement('b');
        num.textContent = String(value);
        badge.append(`${label} `, num);
        container.appendChild(badge);
      }
    },
  };
}

/** ファイル名に使う日時（UTC。区切り記号とミリ秒を落とす） */
export function fileStamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z');
}

/**
 * JSON 文字列をファイルとしてダウンロードさせる。
 *
 * Blob の URL は `revokeAfterMs` 後に解放する（ダウンロードの開始を待つため、すぐには解放しない）。
 */
export function downloadJson(json: string, filename: string, revokeAfterMs: number): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), revokeAfterMs);
}
