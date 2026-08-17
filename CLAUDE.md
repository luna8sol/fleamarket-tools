# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

ラクマ（fril.jp）の出品中商品を一括再出品し、下書き商品を一括出品する Chrome 拡張機能（Manifest V3 / TypeScript）。

このファイルは**規約の正本**。手順はスキル（`.claude/skills/`）に置き、規約はここ 1 か所に置く。同じ規約を複数のスキルに書かない（片方だけ育ってズレる）。

## このプロジェクトの最重要方針

実装・レビュー・設計判断が競合したときは、この 2 つを他のすべてより優先する。

1. **誤操作・誤出品を起こさない。** 一括出品・一括再出品は取り消せない実操作で、対象を間違えると実際の商品が世に出る。とくに次の 3 つは安全装置なので、**弱める変更をしない**:
   - **編集ページの自動クリックは、Background への `CHECK_AUTO_TAB` 問い合わせに `isAutoTab: true` が返ったタブでのみ実行する**（[src/content/edit/index.ts](src/content/edit/index.ts)）。ユーザーが手動で開いた編集ページでは何もしない。この確認を外すと、ユーザーが自分で開いた下書きが勝手に出品される。
   - **失敗時は編集タブを閉じない**（[queue-manager.ts](src/background/queue-manager.ts) の `handleEditFailed`）。バリデーションエラーの内容をユーザーが確認できなくなる。
   - **商品間の待機を縮めない・外さない**（`WAIT_BETWEEN_ITEMS_MS` + `WAIT_RANDOM_MS` = 60〜75 秒）。短時間の大量実行を避けるための値。

   加えて、処理対象の絞り込み条件と件数、途中で失敗したときに部分適用のまま黙って止まらないこと、失敗が観測できること（`failed` に積まれ、`warn` が出ること）を確かめる。

2. **ラクマ側の DOM 変更に耐える。** セレクタとページ判定はこちらが制御できない外部構造に依存している。
   - 一覧ページのセレクタは必ず [src/content/list/infra/constants.ts](src/content/list/infra/constants.ts) に集約する。
   - **編集ページのボタンはクラス名で特定しない。** ラクマの編集ページは React / Chakra UI 製で `css-*` クラスがビルドごとに変わるため、**テキスト完全一致**で探す（[src/content/edit/button-finder.ts](src/content/edit/button-finder.ts)）。
   - 想定した要素が見つからないときは、**黙って何もしないのではなく、検知して安全に止まる**。`waitForButton` の reject を握り潰さず `EDIT_FAILED` として Background へ伝える、`collectItems` のスキップを `warn` に出す、といった既存の作りを壊さない。

## 着手前に読むもの

**実装判断の前に、該当する一次資料とコードを直接読む。** このファイルには要約を置かない（要約はここだけ更新されずに古い前提で作業される）。

| 領域 | 一次資料 |
| --- | --- |
| 機能概要・処理フロー・開発コマンド | [README.md](README.md) |
| ブランチ運用・コミットメッセージ・コードスタイル | [CONTRIBUTING.md](CONTRIBUTING.md) |
| 拡張機能の権限・対象 URL・エントリーポイント | [manifest.json](manifest.json) |
| Background ⇔ Content のメッセージ型・キューの型 | [src/common/messages.ts](src/common/messages.ts) |
| 処理キュー・タブ追跡・待機時間 | [src/background/queue-manager.ts](src/background/queue-manager.ts) |
| Background の配線（メッセージ・タブ・アラーム） | [src/background/index.ts](src/background/index.ts) |
| セレクタ・クラス名・ID・設定値（一覧ページ） | [src/content/list/infra/constants.ts](src/content/list/infra/constants.ts) |
| ページ種別（`/sell` / `/draft`）の判定 | [src/content/list/infra/page-detector.ts](src/content/list/infra/page-detector.ts) |
| 商品の収集・再出品ボタンの探索 | [src/content/list/logic/item-collector.ts](src/content/list/logic/item-collector.ts) |
| 選択状態・選択順の管理 | [src/content/list/logic/selection-manager.ts](src/content/list/logic/selection-manager.ts) |
| 一覧ページの組み立て | [src/content/list/index.ts](src/content/list/index.ts) |
| 一括操作バー・チェックボックス・トースト | [ui/bulk-bar.ts](src/content/list/ui/bulk-bar.ts), [ui/checkbox-manager.ts](src/content/list/ui/checkbox-manager.ts), [ui/notification.ts](src/content/list/ui/notification.ts) |
| 編集ページの自動出品（確認する → 出品する） | [src/content/edit/auto-submit.ts](src/content/edit/auto-submit.ts) |
| 編集ページのボタン特定 | [src/content/edit/button-finder.ts](src/content/edit/button-finder.ts) |
| 編集ページの自動処理ガード | [src/content/edit/index.ts](src/content/edit/index.ts) |
| ログ出力 | [src/common/logger.ts](src/common/logger.ts) |
| ビルド構成 | [webpack.config.js](webpack.config.js), [tsconfig.json](tsconfig.json) |
| lint / format 構成 | [eslint.config.js](eslint.config.js), [.prettierrc](.prettierrc) |

### 既知の状態（2026-09-19 / `e0c9316` 時点）

**文書とコードが食い違ったらコードが正。** 古い記述を見つけたらその場で直す。

- **`feat/queue-robustness` に develop 未統合のコミットが 13 本ある。** そこでは `src/content/edit/` が `src/content/form/` にリネームされ、ページ送り・一括削除・フォーム内容の検証などが追加されている。上の索引は `develop`（= `main` と同じ内容）に対するもの。**develop に統合したら、索引と下の「検証」の表を更新すること。**
- **`manifest.json` の `https://fril.jp/draft*` は `/drafts/{hash}/edit`（編集ページ）にもマッチする。** 一覧用 content script が編集ページで動かないのは、[page-detector.ts](src/content/list/infra/page-detector.ts) が `/drafts` を `UNKNOWN` に落としているからで、manifest 側では除外していない。**片方だけ変えない。**
- **キューの状態は Service Worker のメモリ上にのみ存在する**（[queue-manager.ts](src/background/queue-manager.ts) の NOTE）。拡張機能を再読み込みすると実行中のキューは失われる。待機に `chrome.alarms` を使っているのは SW の破棄を避けるため。
- **自動テストは存在しない。** 「テストを回す」は型チェック・ビルド・静的解析を回すことを指す（下記「検証」）。

## コーディングルール

- `any` 型は禁止（ESLint で error）
- 関数には戻り値の型を明示する（ESLint で warn）
- 文字列はシングルクォート、文末セミコロン必須
- 未使用 import は自動検出・エラー扱い
- 一覧ページの DOM セレクタ・クラス名・ID・設定値は必ず [src/content/list/infra/constants.ts](src/content/list/infra/constants.ts) に追加する
- Background ⇔ Content のやり取りは必ず [src/common/messages.ts](src/common/messages.ts) の型を経由する。新しいメッセージはまずここに型を足す
- 主要なマネージャークラスはファイル末尾でシングルトンとしてエクスポートする（例: `export const queueManager = new QueueManager()`）
- ログは `console.log` を直接呼ばず [src/common/logger.ts](src/common/logger.ts) の `log` / `warn` / `debug` を使う

## ブランチ運用・コミットルール

**正本は [CONTRIBUTING.md](CONTRIBUTING.md)。** ブランチ構成（`main` / `develop` / `feature/*` / `fix/*` / `docs/*` / `refactor/*`）、コミットメッセージのプレフィックス 8 種（`feat:` / `fix:` / `docs:` / `style:` / `refactor:` / `perf:` / `test:` / `chore:`）、コードスタイルはそちらを参照する。

### ブランチ運用の補足（CONTRIBUTING.md に無い部分）

- **統合ブランチは `develop`。ここで直接作業しない。** 各タスクは `develop` からトピックブランチを切る。
  - `develop` は 2026-09-19 に `main`（`e0c9316`）から作った**ローカルブランチ**で、まだ origin には無い。push するかは人が判断する。
- 命名は CONTRIBUTING.md の規則（`feature/` / `fix/` / `docs/` / `refactor/` + ハイフン区切りの英小文字）。日付・イニシャル・連番は入れない。
  - **`feature/` を既定にしない。** 中身が修正なら `fix/`、ドキュメントなら `docs/`、挙動を変えない整理なら `refactor/`。コミットの prefix と同じく**中身で選ぶ**。
- **エージェントが自動命名したブランチ（`claude/...`、`worktree-...`）のまま作業を終えない。** 規約名に直す。

  ```bash
  git branch -m <規約名>
  ```

- **作業ブランチは origin に push しない**（ローカル限り）。`main` は origin と同期している。
- 統合は **rebase してから `--ff-only`** で行う。**マージコミットを作らない**（履歴を直線に保つ）。手順は [.claude/skills/merge/SKILL.md](.claude/skills/merge/SKILL.md)。
- **マージ後に作業ブランチを削除する**（`git branch -d`）。
- このリポジトリは **worktree を使っている。ブランチ 1 本につき worktree が 1 つ占有される。** ブランチを削除するときは worktree も片付ける（手順は [.claude/skills/local-setup/SKILL.md](.claude/skills/local-setup/SKILL.md)）。

### 件名の書き方の補足

以下は CONTRIBUTING.md に書かれていない**件名の書き方の補足**。

```
<prefix>(<scope>): <subject>
```

- `<prefix>: ` は必須（CONTRIBUTING.md の 8 種から選ぶ。独自に増やさない）、`(<scope>)` は省略可
- scope は**この閉じた選択肢から選ぶ**（増やさない。複数に跨るときは付けない）

  | scope | 対象 |
  | --- | --- |
  | `background` | `src/background/` |
  | `list` | `src/content/list/` |
  | `edit` | `src/content/edit/` |
  | `content` | `src/content/` 全体にまたがる変更 |
  | `common` | `src/common/` |
  | `popup` | `src/popup/`, `popup.html` |
  | `manifest` | `manifest.json` |
  | `build` | `webpack.config.js`, `tsconfig.json`, `package.json`, `eslint.config.js`, `.prettierrc`, `.gitignore` |
  | `docs` | `README.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `.claude/` |

- 件名は**動詞の原形で始める**（imperative mood）。`Fixed` / `Fixes` / 名詞句にしない
- 先頭は小文字、**末尾にピリオドを打たない**
- **50 字以内**（`<prefix>(<scope>): ` は字数に含めない）
- **「何を」「どうした」を両方入れる**（`fix: bug fix` のような無情報の件名は不可）
- 本文は任意。書くなら**なぜそうしたか**を書く（差分を読めば分かるファイル列挙は書かない）
- **`Co-Authored-By` と生成表示（「🤖 Generated with Claude Code」等）を付けない。**

### 良い例（`feat/queue-robustness` の実際のコミットから）

```
fix: add checkboxes as the list renders instead of once at document_idle
feat: make the queue survive SW teardown and detect completion in background
perf: return to the recorded page when deleting instead of scanning from page 1
```

### 悪い例

```
feat: initial scaffold with bulk relist/publish core flow
```
→ 件名 52 字で 50 字超過（`main` の `e0c9316`）。今後は踏襲しない。

```
fix: bug fix
```
→ 「何を」「どうした」が無い。どのコードのどの不具合か分からない。

```
update queue-manager.ts
```
→ プレフィックスが無い。ファイル名だけで「何をどうしたか」が無い。

### コミット日時

**コミット日時に実時間を使わない。直前のコミット（`HEAD` の親）の 10 分後に揃える。**

- **author date と committer date の両方**を揃える（`--date` だけでは author date しか変わらない）
- 連続して複数コミットするときは 1 本ごとに 10 分進める
- **push 済みのコミットには適用しない**（ハッシュが変わるため）。`main` は origin と同期しているので、そこに入ったコミットは対象外。必要なら実行前に確認を取る
- 手順は [.claude/skills/commit/SKILL.md](.claude/skills/commit/SKILL.md) の「コミット日時を揃える」

## 検証

**このリポジトリには自動テストが存在しない。** `package.json` に `test` スクリプトは無く、テストフレームワークも依存に入っていない。「テストを回す」は現状**型チェック・ビルド・静的解析を回す**ことを指す。

パッケージは**ルート 1 つだけ**（モノレポではない）。すべてリポジトリルートで実行する。

| 項目 | コマンド | 現状（2026-09-19 / `e0c9316` 実測） |
| --- | --- | --- |
| 型チェック | `npx tsc --noEmit` | **通過**（exit 0）。約 5 秒 |
| ビルド | `npm run build` | **通過**（exit 0）。約 6 秒（webpack 自体は約 2 秒。初回は 30 秒以上かかることがある） |
| 静的解析 | `npm run lint` | **通過**（exit 0）。約 6 秒 |
| フォーマット | `npm run format:check` | **落ちる**（exit 1 / `src` の全 16 ファイルに差分） |
| テスト | （無し） | テストフレームワーク未導入 |

その他のコマンドは [README.md の「コマンド」](README.md) を参照。

### 落とし穴

- **`npm run lint` は現在通っている。落ちたらそれは自分の変更のせい。** 通っている状態を壊さないこと。
- **`npm run format:check` は元から落ちる**（`src` の全 16 ファイル。つまり全ソースが未整形）。これだけは自分の変更が正しくても落ちる。**自分が触ったファイルの指摘が増えていないか**で判断する。
  - **一括整形は `feat/queue-robustness` を `develop` に統合した後に行う**（2026-09-19 に決定）。先に整形すると、同じファイルを大きく書き換えている未統合の 13 コミットと衝突する。統合後の一括整形（`style:` の独立コミット）が済んだら、この項目と上の表を更新する。
  - それまでの間、**リポジトリ全体に `npm run format` をかけない**（差分が膨れて本来の変更が埋もれる）。触ったファイルだけ `npx prettier --write <パス>` で直す。
- **型チェックに `npm run build:tsc` を使わない。** これは `tsc`（`--noEmit` なし）なので `dist/` に成果物を吐いてビルド出力を汚す。型チェックは必ず `npx tsc --noEmit`。
- **`lint` スクリプトの `--ext .ts,.js` は flat config では効いていない。** 実際の対象は [eslint.config.js](eslint.config.js) の `files: ['**/*.ts', '**/*.tsx']` だけで、`webpack.config.js` や `eslint.config.js` 自身は lint されない。

### CI

CI は存在しない（`.github/workflows/` 無し）。CI を追加したら、そのワークフローが実行するコマンドをこの表と一致させること。
