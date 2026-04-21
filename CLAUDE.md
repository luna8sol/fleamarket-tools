# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

メルカリの下書き商品を一括出品・再出品する Chrome 拡張機能（Manifest V3 / TypeScript）。

このファイルは**規約の正本**。手順はスキル（`.claude/skills/`）に置き、規約はここ 1 か所に置く。同じ規約を複数のスキルに書かない（片方だけ育ってズレる）。

## このプロジェクトの最重要方針

実装・レビュー・設計判断が競合したときは、この 2 つを他のすべてより優先する。

1. **誤操作・誤出品を起こさない。** 一括出品・一括再出品は取り消せない実操作で、対象を間違えると実際の商品が世に出る。処理対象の絞り込み条件、件数、確定操作のガードを最優先で確かめる。途中で失敗したときに部分適用のまま止まらないこと、失敗が観測できることを含む。
2. **メルカリ側の DOM 変更に耐える。** セレクタとページ判定はこちらが制御できない外部構造に依存している。セレクタは必ず `src/content/infra/constants.ts` に集約し、想定した要素が見つからないときは**黙って何もしないのではなく、検知して安全に止まる**こと。

## 着手前に読むもの

**実装判断の前に、該当する一次資料とコードを直接読む。** このファイルには要約を置かない（要約はここだけ更新されずに古い前提で作業される）。

| 領域 | 一次資料 |
| --- | --- |
| アーキテクチャ・3 層構造・処理フロー | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)（※下記の既知のズレを読むこと） |
| ブランチ運用・コミットメッセージ・コードスタイル | [CONTRIBUTING.md](CONTRIBUTING.md) |
| 機能概要・セットアップ・開発コマンド | [README.md](README.md)（※下記の既知のズレを読むこと） |
| 拡張機能の権限・対象ページ・エントリーポイント | [manifest.json](manifest.json) |
| セレクタ・クラス名・ID・待機時間・既定設定 | [src/content/infra/constants.ts](src/content/infra/constants.ts) |
| 型定義 | [src/content/infra/types.ts](src/content/infra/types.ts) |
| ページ種別（下書き / 出品中 / 編集・出品フォーム）の判定 | [src/content/infra/page-detector.ts](src/content/infra/page-detector.ts) |
| 永続化（`chrome.storage.local`） | [src/common/ext-storage.ts](src/common/ext-storage.ts) |
| ユーザー設定の読み書き | [src/content/infra/user-settings.ts](src/content/infra/user-settings.ts) |
| content script ⇔ background のメッセージ型 | [src/common/messaging.ts](src/common/messaging.ts) |
| 初期化とページ種別ごとの分岐 | [src/content/logic/app-initializer.ts](src/content/logic/app-initializer.ts) |
| 出品処理 | [src/content/logic/publisher.ts](src/content/logic/publisher.ts) |
| 再出品処理 | [src/content/logic/relist-manager.ts](src/content/logic/relist-manager.ts) |
| 出品・再出品の共通処理 | [src/content/logic/common-processor.ts](src/content/logic/common-processor.ts) |
| 再出品後の自動保存（全体の制御） | [src/content/logic/auto-save-controller.ts](src/content/logic/auto-save-controller.ts) |
| 元商品のスナップショット取得（隠し iframe で編集フォームを読む） | [src/content/logic/item-snapshot.ts](src/content/logic/item-snapshot.ts) |
| 出品フォームの読み書き・出品ボタン | [src/content/logic/sell-form.ts](src/content/logic/sell-form.ts) |
| カテゴリー・状態・配送方法の選び直し（遷移操作） | [src/content/logic/sell-form-navigator.ts](src/content/logic/sell-form-navigator.ts) |
| 一括削除 | [src/content/logic/delete-manager.ts](src/content/logic/delete-manager.ts), [item-deleter.ts](src/content/logic/item-deleter.ts) |
| 説明文の一括置換（入力の読み込み・1件処理・全体制御・記録・パネル） | [description-replace-data.ts](src/content/logic/description-replace-data.ts), [description-replacer.ts](src/content/logic/description-replacer.ts), [description-replace-manager.ts](src/content/logic/description-replace-manager.ts), [description-replace-store.ts](src/content/infra/description-replace-store.ts), [description-replace-panel.ts](src/content/ui/description-replace-panel.ts) |
| 隠し iframe の共通処理 | [src/content/logic/hidden-frame.ts](src/content/logic/hidden-frame.ts) |
| 下書き保存後のタブを閉じる | [src/content/logic/tab-closer.ts](src/content/logic/tab-closer.ts), [src/background/index.ts](src/background/index.ts) |
| 元商品との比較・差分の自動修正 | [src/content/logic/relist-verifier.ts](src/content/logic/relist-verifier.ts) |
| 再出品の待ち行列（FIFO）・自動保存設定 | [src/content/infra/relist-queue.ts](src/content/infra/relist-queue.ts), [auto-save-settings.ts](src/content/infra/auto-save-settings.ts) |
| 一覧の先頭から指定の行までの一括選択 | [src/content/ui/select-up-to.ts](src/content/ui/select-up-to.ts) |
| 選択状態・選択順の管理 | [src/content/logic/selection-manager.ts](src/content/logic/selection-manager.ts) |
| DOM 変更の監視 | [src/content/logic/observer-manager.ts](src/content/logic/observer-manager.ts) |
| UI 全体の組み立て | [src/content/ui/ui-manager.ts](src/content/ui/ui-manager.ts), [ui/index.ts](src/content/ui/index.ts) |
| 一括操作バー | [bulk-bar-core.ts](src/content/ui/bulk-bar-core.ts), [bulk-bar-ui.ts](src/content/ui/bulk-bar-ui.ts), [bulk-bar-utils.ts](src/content/ui/bulk-bar-utils.ts), [bulk-relist.ts](src/content/ui/bulk-relist.ts) |
| Claude API の呼び出し・プロンプト・APIキーの扱い | [src/background/](src/background/)（[claude-client.ts](src/background/claude-client.ts), [prompt.ts](src/background/prompt.ts), [api-error.ts](src/background/api-error.ts)） |
| AI 説明文生成（編集ページ側） | [edit-entry.ts](src/content/edit-entry.ts), [edit-form.ts](src/content/logic/edit-form.ts), [description-generator.ts](src/content/logic/description-generator.ts), [description-panel.ts](src/content/ui/description-panel.ts) |
| APIキーの設定画面 | [options.html](options.html), [src/options/index.ts](src/options/index.ts) |
| ビルド構成 | [webpack.config.js](webpack.config.js), [tsconfig.json](tsconfig.json) |
| lint / format 構成 | [eslint.config.js](eslint.config.js), [.prettierrc](.prettierrc) |

### ドキュメントとコードの既知のズレ

**文書とコードが食い違ったらコードが正。**

**2026-09-19 時点（`01e445a`）で既知のズレは無い。** `docs/ARCHITECTURE.md` の 3 つの表・共通層・background・options page の記載は、`src/` 配下の全ファイルと 1 対 1 で突き合わせて確認した。`README.md` のセットアップ手順も現状どおり。

古い記述を見つけたらその場で直す。**ここに列挙して放置しない**（リストが育つとどれが現役の注意書きか分からなくなる）。ファイルを増やす・動かすときは、同じコミットで `docs/ARCHITECTURE.md` の表とこのファイルの索引も直すこと。

## コーディングルール

- `any` 型は禁止（ESLint で error）
- 関数には戻り値の型を明示する（ESLint で warn）
- 文字列はシングルクォート、文末セミコロン必須
- 未使用 import は自動検出・エラー扱い
- DOM セレクタ・設定値は必ず `src/content/infra/constants.ts` に追加する
- 主要なマネージャークラスはファイル末尾でシングルトンとしてエクスポートする（例: `export const appInitializer = new AppInitializer()`）
- **Claude API キーを読むのは `src/background/` と options page だけ。** content script 側のコードに渡さない（メルカリのページへ注入されるバンドルにキーを載せないため）。生成処理は `chrome.runtime.sendMessage` で background に依頼する
- **background・options page から使うモジュールは `src/common/` に置く。** `src/content/` 配下は content script のための層。service worker から参照すると層の意味と食い違う

## ブランチ運用・コミットルール

**正本は [CONTRIBUTING.md](CONTRIBUTING.md)。** ブランチ構成（`main` / `develop` / `feature/*` / `fix/*` / `docs/*` / `refactor/*`）、コミットメッセージのプレフィックス 8 種（`feat:` / `fix:` / `docs:` / `style:` / `refactor:` / `perf:` / `test:` / `chore:`）、コードスタイルはそちらを参照する。

### ブランチ運用の補足（CONTRIBUTING.md に無い部分）

- **統合ブランチは `develop`。ここで直接作業しない。** 各タスクは `develop` からトピックブランチを切る。
- 命名は CONTRIBUTING.md の規則（`feature/` / `fix/` / `docs/` / `refactor/` + ハイフン区切りの英小文字）。日付・イニシャル・連番は入れない。
  - **`feature/` を既定にしない。** 中身が修正なら `fix/`、ドキュメントなら `docs/`、挙動を変えない整理なら `refactor/`。コミットの prefix と同じく**中身で選ぶ**。
- **エージェントが自動命名したブランチ（`claude/...`、`worktree-...`）のまま作業を終えない。** 規約名に直す。

  ```bash
  git branch -m <規約名>
  ```

- **作業ブランチは origin に push しない**（ローカル限り）。`develop` は origin と同期する。
- 統合は **rebase してから `--ff-only`** で行う。**マージコミットを作らない**（履歴を直線に保つ）。手順は [.claude/skills/merge/SKILL.md](.claude/skills/merge/SKILL.md)。
- **マージ後に作業ブランチを削除する**（`git branch -d`）。履歴はマージコミットに残るので情報は失われない。
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
  | `content` | `src/content/` 全体にまたがる変更 |
  | `infra` | `src/content/infra/` |
  | `logic` | `src/content/logic/` |
  | `ui` | `src/content/ui/` |
  | `popup` | `src/popup/`, `popup.html` |
  | `options` | `src/options/`, `options.html` |
  | `background` | `src/background/` |
  | `common` | `src/common/` |
  | `manifest` | `manifest.json` |
  | `build` | `webpack.config.js`, `tsconfig.json`, `package.json`, `eslint.config.js`, `.prettierrc` |
  | `docs` | `README.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `docs/`, `.claude/` |

- 件名は**動詞の原形で始める**（imperative mood）。`Fixed` / `Fixes` / 名詞句にしない
- 先頭は小文字、**末尾にピリオドを打たない**
- **50 字以内**（`<prefix>(<scope>): ` は字数に含めない）
- **「何を」「どうした」を両方入れる**（`fix: bug fix` のような無情報の件名は不可）
- 本文は任意。書くなら**なぜそうしたか**を書く（差分を読めば分かるファイル列挙は書かない）

### 良い例（develop の実際のコミットから）

```
fix: propagate waitForElement failure via onNotFound callback
refactor: move observer retry constants from ObserverManager to CONFIG
fix: reset isProcessingPage immediately after synchronous processing
```

### 悪い例

```
feat: initial implementation of Mercari draft publisher Chrome extension
```
→ 件名 66 字で 50 字超過（`main` の `564678f`）。今後は踏襲しない。

```
fix: bug fix
```
→ 「何を」「どうした」が無い。どのコードのどの不具合か分からない。

```
update observer-manager.ts
```
→ プレフィックスが無い。ファイル名だけで「何をどうしたか」が無い。

### コミット日時

**コミット日時に実時間を使わない。直前のコミット（`HEAD` の親）の 10 分後に揃える。** `develop` の履歴が 10 分刻みで並んでおり、その並びを保つ。

- **author date と committer date の両方**を揃える（`--date` だけでは author date しか変わらない）
- 連続して複数コミットするときは 1 本ごとに 10 分進める
- **push 済みのコミットには適用しない**（ハッシュが変わるため）。必要なら実行前に確認を取る
- 手順は [.claude/skills/commit/SKILL.md](.claude/skills/commit/SKILL.md) の「コミット日時を揃える」

## 検証

**このリポジトリには自動テストが存在しない。** `package.json` に `test` スクリプトは無く、テストフレームワークも依存に入っていない。「テストを回す」は現状**型チェック・ビルド・静的解析を回す**ことを指す。

パッケージは**ルート 1 つだけ**（モノレポではない）。すべてリポジトリルートで実行する。

| 項目 | コマンド | 現状（2026-09-19 / `01e445a` 実測） |
| --- | --- | --- |
| 型チェック | `npx tsc --noEmit` | **通過**（exit 0）。約 7 秒 |
| ビルド | `npm run build` | **通過**（exit 0）。約 14 秒 |
| 静的解析 | `npm run lint` | **通過**（exit 0）。約 6 秒 |
| フォーマット | `npm run format:check` | **落ちる**（exit 1）。既存コードが未通過。**件数は当てにならない**（下記） |
| テスト | （無し） | テストフレームワーク未導入 |

その他のコマンドは [README.md の「開発コマンド」](README.md) を参照。

### 落とし穴

- **`npm run lint` は現在通っている。落ちたらそれは自分の変更のせい。** `main` では 17 errors あったが `develop` で解消済み（`refactor/codebase-cleanup` のマージ。`7f80007` で戻り値型を明示）。**通っている状態を壊さないこと。**
- **`npm run format:check` は元から落ちる。** これだけは自分の変更が正しくても落ちる。自分が触ったファイルが指摘に増えていないかで判断する。**リポジトリ全体をここで一括 `npm run format` しない**（差分が膨れて本来の変更が埋もれる）。
- **`npm run format:check` の「N ファイル」を信用しない。** `core.autocrlf=true` の Windows チェックアウトでは、git が書き戻したファイルは CRLF・エディタやツールが書いたファイルは LF になる。Prettier の既定は `endOfLine: "lf"` なので、**git が触った直後（checkout / rebase / cherry-pick の後）は件数が跳ね上がる**。実測で 23 → 41 まで動いた。コミットされる内容は git が LF に正規化するので、**判定はコミット済みの内容に対して行う**:

  ```bash
  git show HEAD:<path> | npx prettier --stdin-filepath <path> --check
  ```

  `01e445a` 時点でコミット済み内容が未通過なのは `src/` 配下 23 ファイル。増えていなければ自分の変更は白。
- **型チェックに `npm run build:tsc` を使わない。** これは `tsc`（`--noEmit` なし）なので `dist/` に成果物を吐いてビルド出力を汚す。型チェックは必ず `npx tsc --noEmit`。
- **ESLint の設定ファイルが 2 つある。** `eslint.config.js`（flat config、ESLint 9 が実際に読むのはこちら）と `.eslintrc.json`（legacy、**無視されている**）。ルールを変えるなら `eslint.config.js` 側。`.eslintrc.json` を直しても何も変わらない。
- **`lint` スクリプトの `--ext .ts,.js` は flat config では効いていない。** lint の対象は `src` 配下だけで、ルート直下の `webpack.config.js` / `eslint.config.js` は見られていない。
- **`@anthropic-ai/sdk` は `devDependencies` ではなく `dependencies`。** `src/background/` が実行時に使う唯一のランタイム依存。バンドルに入るので、ここに増やすものは慎重に選ぶ（現状 `dist/background.js` は開発ビルドで約 900KB）。

### CI

CI は存在しない（`.github/workflows/` 無し）。CI を追加したら、そのワークフローが実行するコマンドをこの表と一致させること。
