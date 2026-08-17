# fleamarket-tools

フリマサイト向け Chrome 拡張機能 2 つを 1 つのリポジトリで管理するモノレポです。Chrome に読み込む拡張は 2 つのままで、製品としては統合していません。

| パッケージ | 拡張名 | 対象サイト | 概要 |
| --- | --- | --- | --- |
| [packages/mercari](packages/mercari/) | Mercari Draft Publisher | jp.mercari.com | 下書きの一括出品・一括再出品・一括削除・説明文の一括置換・AI 説明文生成（Claude API） |
| [packages/rakuma](packages/rakuma/) | Rakuma Bulk Lister | fril.jp | 出品中商品の一括下書き保存・下書きの一括出品・一括削除・説明文の一括置換 |

機能の詳細・設計判断・実機で確認済みの DOM 前提は、各パッケージの README を参照してください。

- [packages/mercari/README.md](packages/mercari/README.md)（アーキテクチャは [packages/mercari/docs/ARCHITECTURE.md](packages/mercari/docs/ARCHITECTURE.md)）
- [packages/rakuma/README.md](packages/rakuma/README.md)

## リポジトリ構成

```
fleamarket-tools/
├── package.json          # npm workspaces のルート。devDependencies と共通スクリプト
├── tsconfig.base.json    # 各パッケージの tsconfig.json が extends する
├── eslint.config.js      # ESLint flat config（両パッケージ共通）
├── .prettierrc           # Prettier 設定（両パッケージ共通）
├── .gitattributes        # 改行コードを LF に固定
├── CLAUDE.md             # 共通規約の正本
├── CONTRIBUTING.md       # ブランチ運用・コミットメッセージ
├── .claude/skills/       # 作業手順（commit / merge / quality-check など）
└── packages/
    ├── mercari/          # メルカリ用拡張（manifest.json・webpack.config.js・src/・dist/）
    └── rakuma/           # ラクマ用拡張（同上）
```

webpack の設定はエントリと target が 2 つで異なるため、各パッケージに置いています。`manifest.json` も各パッケージにあり、ビルド出力はそれぞれの `dist/` に入ります。

## セットアップ

```bash
npm install
npm run build
```

`npm install` はリポジトリルートで 1 回実行すれば両方のパッケージに効きます（`node_modules` はルートにだけできます）。

## Chrome への読み込み

2 つの拡張は**別々に**読み込みます。

1. `chrome://extensions` を開き、「デベロッパーモード」をオンにする
2. 「パッケージ化されていない拡張機能を読み込む」で `packages/mercari` を選ぶ
3. 同じ手順で `packages/rakuma` を選ぶ

選ぶのは `manifest.json` があるパッケージのディレクトリで、`dist/` ではありません。ソースを直したら `npm run build` → `chrome://extensions` で拡張の再読み込み → ページのリロード、の 3 つが必要です。

## 開発コマンド

すべてリポジトリルートで実行します。各コマンドは両パッケージを順に回します。

| コマンド | 説明 |
| --- | --- |
| `npm run check` | 型チェック・ビルド・ESLint をまとめて実行 |
| `npm run typecheck` | 型チェック（`tsc --noEmit`） |
| `npm run build` | 開発用ビルド（ソースマップ付き） |
| `npm run build:prod` | 本番用ビルド（最適化・圧縮あり） |
| `npm run lint` / `npm run lint:fix` | ESLint / 自動修正 |
| `npm run format:check` / `npm run format` | Prettier の差分チェック / 整形 |
| `npm run clean` | 各パッケージの `dist/` を削除 |

1 パッケージだけ回すときは `-w` を付けます。

```bash
npm run build -w packages/rakuma
```

自動テストはありません。「テストを回す」は型チェック・ビルド・静的解析を回すことを指します（[CLAUDE.md](CLAUDE.md) の「検証」）。

## 開発の規約

- ブランチ運用・コミットメッセージ: [CONTRIBUTING.md](CONTRIBUTING.md)
- 共通規約（最重要方針・コーディングルール・scope・コミット日時・検証）: [CLAUDE.md](CLAUDE.md)
- サイト固有の規約: [packages/mercari/CLAUDE.md](packages/mercari/CLAUDE.md), [packages/rakuma/CLAUDE.md](packages/rakuma/CLAUDE.md)

## 履歴について

このリポジトリは 2026 年 10 月に `mercari-draft-publisher` と `rakuma-bulk-lister` の 2 リポジトリを `git subtree add` で統合して作りました。元の履歴は `git log` で辿れます。ファイル単位で統合前の履歴を追うときは、取り込み元のコミットから元のパスで引いてください。

```bash
git log --oneline 03722be -- src/content/index.ts        # メルカリ側（統合前の最終コミット）
git log --oneline ef61ca1 -- src/background/queue-manager.ts   # ラクマ側（同上）
```
