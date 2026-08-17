# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

フリマサイト向け Chrome 拡張機能（Manifest V3 / TypeScript）2 つを 1 つのリポジトリで管理するモノレポ。**Chrome に読み込む拡張は 2 つのまま**で、製品としては統合しない。規約・ツール設定・スキルを 1 セットにし、サイトに依存しない純粋なユーティリティだけを共有部品に寄せる。

| パッケージ | 拡張名 | 対象サイト | 固有の規約 |
| --- | --- | --- | --- |
| [packages/mercari](packages/mercari/) | Mercari Draft Publisher | jp.mercari.com | [packages/mercari/CLAUDE.md](packages/mercari/CLAUDE.md) |
| [packages/rakuma](packages/rakuma/) | Rakuma Bulk Lister | fril.jp | [packages/rakuma/CLAUDE.md](packages/rakuma/CLAUDE.md) |
| [packages/core](packages/core/) | `@fleamarket/core`。両拡張から使う純粋なユーティリティ | — | このファイルの「共有部品」 |

このファイルは**共通規約の正本**。サイト固有の方針・一次資料の索引・既知のズレ・落とし穴は各パッケージの CLAUDE.md に置く。手順はスキル（[.claude/skills/](.claude/skills/)）に置く。同じ規約を複数の場所に書かない（片方だけ育ってズレる）。

## 2 つの拡張は中身が別物

見た目の機能（一括出品・一括再出品・一括削除・説明文の一括置換）は同じだが、設計は独立している。**動作コードを共通化するために書き換えない。**

- 処理の主導権が逆。メルカリは content script が一覧タブで for ループを回し、background は Claude API とタブを閉じる処理だけ。ラクマは background の QueueManager が `chrome.storage.session` と `alarms` で 1 件ずつ進め、URL 遷移で完了を判定する。
- 元商品の取得方法が別。メルカリは隠し iframe で編集フォームを読む。ラクマは fetch した HTML から JSON-LD を正規表現で抜く。
- 同名のファイル（selection-manager / checkbox-manager / notification / logger / replace-store / replace-panel / page-detector）はどれもほぼ全行が異なる独立実装。片方を直しても、もう片方に同じ変更を入れる義務はない（入れるなら別コミット）。
- 共通点は、再出品が外部拡張「フリマアシスト」の `#clone-item` に乗っていることと、説明文置換の手順・安全装置を揃えてあること。

### 共有部品（`packages/core` = `@fleamarket/core`）

移してよいのは**サイトに依存しない純粋なユーティリティ**だけ。2026-10-05 の調査で対象を 5 つに絞った: **待機・ポーリング・FNV-1a・改行正規化・debounce・randomInt** / **logger のレベル制御**（出力形式は拡張ごとに違うので各パッケージの logger に残る）/ **アイコン**（SVG の組み立てと共通 15 個）/ **スタイルの注入とボタン・進捗部品**（CSS 本文は各パッケージの theme に残る）/ **通知**（トーストの組み立てと表示時間の制御。表示時間の決め方とホバー後の方式は注入）。**5 つとも移行済み**（2026-10-05）。次の 4 つは見送り（移すと分岐だらけになるか、片側にコードを足すことになる）: 確認ダイアログ（答えの確定方式が 2 系統）、テーマ CSS 本体（値・クラス体系・ダーク切替がサイト固有）、置換記録ストア（キー・検証・完了判定がすべて違う）、型付きメッセージの枠組み（メルカリ側に枠組みが無い）。

- **1 ファイル 1 部品**で `packages/core/<name>.ts` に置き、`@fleamarket/core/<name>` のサブパスで import する（`src/` も `index.ts` も無い。npm workspace のシンボリックリンク経由で TS ソースを直接読むので、core 側にビルド工程は無い）。
- **各パッケージ側は従来のファイルを薄いラッパーとして残し、呼び出し側の import を変えない。** 拡張ごとに違うもの（`sleep` の秒単位、FNV-1a の 10 進 / 16 進表記、ログの接頭辞、ストレージのキー名）はラッパー側で付けるか、core に**注入できる形**にする。**既存の文字列・キー名・保存される値は 1 文字も変えない。**
- 1 部品 1 コミットで、移すたびに 3 ワークスペースの型チェック・ビルド・lint を通す。出力値を持つもの（ハッシュなど）は旧実装と同じ入力で出力が一致することを確かめてからコミットする。
- 実機での動作に影響しうるもの（通知・テーマ部品）は、移したあと実機確認を依頼してから次に進む。
- core は `chrome.*` に依存してよいが、サイトの DOM・URL・文言には依存しない。

## 最重要方針（両拡張に共通）

実装・レビュー・設計判断が競合したときは、この 2 つを他のすべてより優先する。サイトごとの具体的な安全装置は各パッケージの CLAUDE.md の「最重要方針」にある。

1. **取り消せない操作を誤って実行しない。** 一括出品・一括再出品・一括削除・説明文の置換は取り消せない実操作で、対象を間違えると実際の商品が世に出る／消える。処理対象の絞り込み条件と件数、確定操作のガード、途中で失敗したときに部分適用のまま黙って止まらないこと、失敗が観測できることを最優先で確かめる。**各パッケージの CLAUDE.md に列挙された安全装置を弱める変更をしない。**
2. **サイト側の DOM 変更に耐える。** セレクタとページ判定はこちらが制御できない外部構造に依存している。セレクタは各パッケージの定数ファイルに集約し、想定した要素が見つからないときは**黙って何もしないのではなく、検知して安全に止まる**。

## 着手前に読むもの

**実装判断の前に、該当する一次資料とコードを直接読む。** このファイルには要約を置かない（要約はここだけ更新されずに古い前提で作業される）。**どちらのパッケージのタスクかを最初に確定し、そのパッケージの CLAUDE.md の索引から入る。**

| 領域 | 一次資料 |
| --- | --- |
| メルカリ用拡張の方針・索引・既知のズレ・落とし穴 | [packages/mercari/CLAUDE.md](packages/mercari/CLAUDE.md) |
| ラクマ用拡張の方針・索引・既知の状態・落とし穴 | [packages/rakuma/CLAUDE.md](packages/rakuma/CLAUDE.md) |
| ブランチ運用・コミットメッセージ・コードスタイル | [CONTRIBUTING.md](CONTRIBUTING.md) |
| リポジトリ構成・開発コマンド・Chrome への読み込み | [README.md](README.md) |
| 共有部品（待機・ポーリング・FNV-1a・改行正規化・debounce・randomInt・logger のレベル制御・アイコン・スタイル注入・ボタンと進捗部品・トースト） | [packages/core/](packages/core/)（[wait.ts](packages/core/wait.ts), [text-hash.ts](packages/core/text-hash.ts), [debounce.ts](packages/core/debounce.ts), [random.ts](packages/core/random.ts), [logger.ts](packages/core/logger.ts), [icons.ts](packages/core/icons.ts), [style.ts](packages/core/style.ts), [components.ts](packages/core/components.ts), [toast.ts](packages/core/toast.ts)） |
| 共通のビルド・lint・format・改行コード設定 | [package.json](package.json), [tsconfig.base.json](tsconfig.base.json), [eslint.config.js](eslint.config.js), [.prettierrc](.prettierrc), [.gitattributes](.gitattributes) |
| 各パッケージのビルド構成（webpack のエントリと target は 2 つで違う） | `packages/*/webpack.config.js`, `packages/*/tsconfig.json`, `packages/*/package.json`, `packages/*/manifest.json` |

**文書とコードが食い違ったらコードが正。** 古い記述を見つけたらその場で直す。ファイルを増やす・動かすときは、同じコミットで該当パッケージの CLAUDE.md の索引も直す。

## コーディングルール（共通）

- `any` 型は禁止（ESLint で error）
- 関数には戻り値の型を明示する（ESLint で warn）
- 文字列はシングルクォート、文末セミコロン必須
- 未使用 import は自動検出・エラー扱い
- DOM セレクタ・設定値はコードに直書きせず、各パッケージの定数ファイルに置く（場所は各パッケージの CLAUDE.md）
- 主要なマネージャークラスはファイル末尾でシングルトンとしてエクスポートする
- ログは `console.log` を直接呼ばず、各パッケージの logger を使う
- **パッケージをまたいで import しない。** `packages/mercari` から `packages/rakuma` を参照しない（逆も同じ）。共有するなら `packages/core` に置く

## ブランチ運用・コミットルール

**正本は [CONTRIBUTING.md](CONTRIBUTING.md)。** ブランチ構成（`main` / `develop` / `feature/*` / `fix/*` / `docs/*` / `refactor/*`）、コミットメッセージのプレフィックス 8 種（`feat:` / `fix:` / `docs:` / `style:` / `refactor:` / `perf:` / `test:` / `chore:`）、コードスタイルはそちらを参照する。

### ブランチ運用の補足（CONTRIBUTING.md に無い部分）

- **統合ブランチは `develop`。ここで直接作業しない。** 各タスクは `develop` からトピックブランチを切る。`main` はリリース済み安定版で、`develop` → `main` の取り込みは人が判断する。
- 命名は CONTRIBUTING.md の規則（`feature/` / `fix/` / `docs/` / `refactor/` + ハイフン区切りの英小文字）。日付・イニシャル・連番は入れない。
  - **`feature/` を既定にしない。** 中身が修正なら `fix/`、ドキュメントなら `docs/`、挙動を変えない整理なら `refactor/`。コミットの prefix と同じく**中身で選ぶ**。
- **エージェントが自動命名したブランチ（`claude/...`、`worktree-...`）のまま作業を終えない。** 規約名に直す。

  ```bash
  git branch -m <規約名>
  ```

- **トピックブランチは origin に push しない**（ローカル限り）。origin と同期するのは `main` と `develop` の 2 本だけ。
- 統合は **rebase してから `--ff-only`** で行う。**マージコミットを作らない**（履歴を直線に保つ）。手順は [.claude/skills/merge/SKILL.md](.claude/skills/merge/SKILL.md)。
  - 例外は 2026-08-17 の `git subtree add` 2 本（`1847302` / `4facd83`）だけ。元リポジトリの履歴を保持するために作ったマージコミットで、今後は踏襲しない。
- **マージ後に作業ブランチを削除する**（`git branch -d`）。
- **対応済みのセッション・ブランチ・worktree がまとめて溜まったら整理する**（手順は [.claude/skills/cleanup/SKILL.md](.claude/skills/cleanup/SKILL.md)）。
- worktree で作業するなら、**ブランチ 1 本につき worktree が 1 つ占有される。** ブランチを削除するときは worktree も片付ける（手順は [.claude/skills/local-setup/SKILL.md](.claude/skills/local-setup/SKILL.md)）。

### 件名の書き方の補足

以下は CONTRIBUTING.md に書かれていない**件名の書き方の補足**。

```
<prefix>(<scope>): <subject>
```

- `<prefix>: ` は必須（CONTRIBUTING.md の 8 種から選ぶ。独自に増やさない）、`(<scope>)` は省略可
- scope は**この閉じた選択肢から選ぶ**（増やさない。複数に跨るときは付けない）。**層ごとの scope（`ui` / `logic` / `list` / `form` / `background` / `popup` / `manifest` など）は 2026-10-05 に廃止した。** 層の情報は件名で表す。

  | scope | 対象 |
  | --- | --- |
  | `mercari` | `packages/mercari/` 配下のすべて（コード・`manifest.json`・webpack 設定・パッケージの README / CLAUDE.md を含む） |
  | `rakuma` | `packages/rakuma/` 配下のすべて（同上） |
  | `core` | `packages/core/` 配下のすべて |
  | `build` | ルートのツール設定: `package.json`, `package-lock.json`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc`, `.prettierignore`, `.gitignore`, `.gitattributes` |
  | `docs` | ルートの `README.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `.claude/` |

  - 2 つ以上のパッケージにまたがる変更は scope を付けない（例: `refactor: move the logger into packages/core`）。
  - パッケージ配下のドキュメントだけを直したら prefix が `docs:` で scope がパッケージ名（例: `docs(rakuma): record the verified delete run`）。

- 件名は**動詞の原形で始める**（imperative mood）。`Fixed` / `Fixes` / 名詞句にしない
- 先頭は小文字、**末尾にピリオドを打たない**
- **50 字以内**（`<prefix>(<scope>): ` は字数に含めない）
- **「何を」「どうした」を両方入れる**（`fix: bug fix` のような無情報の件名は不可）
- 本文は任意。書くなら**なぜそうしたか**を書く（差分を読めば分かるファイル列挙は書かない）
- **`Co-Authored-By` と生成表示（「🤖 Generated with Claude Code」等）を付けない。**

### 良い例（元リポジトリの `develop` の実際のコミットから。scope は新しい規約に読み替える）

```
fix: add checkboxes as the list renders instead of once at document_idle
feat: make the queue survive SW teardown and detect completion in background
refactor: move observer retry constants from ObserverManager to CONFIG
```

### 悪い例

```
feat: initial implementation of Mercari draft publisher Chrome extension
```
→ 件名 66 字で 50 字超過。今後は踏襲しない。

```
fix: bug fix
```
→ 「何を」「どうした」が無い。どのコードのどの不具合か分からない。

```
update queue-manager.ts
```
→ プレフィックスが無い。ファイル名だけで「何をどうしたか」が無い。

### コミット日時

**コミット日時に実時間を使わない。直前のコミット（`HEAD` の親）の 10 分後に揃える。** `develop` の履歴が 10 分刻みで並んでおり、その並びを保つ。

- **author date と committer date の両方**を揃える（`--date` だけでは author date しか変わらない）
- 連続して複数コミットするときは 1 本ごとに 10 分進める
- 基準は**直前の通常コミット**の日時。マージコミット（`subtree add` の 2 本）の日時には合わせない
- **push 済みのコミットには適用しない**（ハッシュが変わるため）。必要なら**実行前に理由と影響範囲を報告して指示を仰ぐ**
- 手順は [.claude/skills/commit/SKILL.md](.claude/skills/commit/SKILL.md) の「コミット日時を揃える」

## 検証

**このリポジトリには自動テストが存在しない。** どのパッケージにも `test` スクリプトは無く、テストフレームワークも依存に入っていない。「テストを回す」は現状**型チェック・ビルド・静的解析を回す**ことを指す。

**すべてリポジトリルートで実行する。** npm workspaces なので `node_modules` はルートにだけあり、ルートのスクリプトが 3 つのワークスペース（core / mercari / rakuma）を順に回す。core には `build` が無いので `--if-present` で飛ばされる。

| 項目 | コマンド | 現状（2026-10-05 / `40f0179` 実測） |
| --- | --- | --- |
| 型チェック | `npm run typecheck` | **通過**（exit 0） |
| ビルド | `npm run build` | **通過**（exit 0）。出力は `packages/*/dist/` |
| 静的解析 | `npm run lint` | **通過**（exit 0） |
| 上の 3 つをまとめて | `npm run check` | **通過**（exit 0）。約 40 秒 |
| フォーマット | `npm run format:check` | **メルカリで落ちる**（exit 1）。既存コードが未通過で、コミット済み内容で `packages/mercari/src/` 配下 21 ファイル。ラクマは通過 |
| テスト | （無し） | テストフレームワーク未導入 |

**型チェック・ビルド・lint は通るのが正常。落ちたらそれは自分の変更のせい。** 1 パッケージだけ回すときは `-w` を付ける（例: `npm run typecheck -w packages/rakuma`）。

### 落とし穴（共通）

- **`npm run format:check` はメルカリ側が元から落ちる。** 自分が触ったファイルが指摘に増えていないかで判断する。判定はコミット済みの内容に対して行う:

  ```bash
  git show HEAD:<path> | npx prettier --stdin-filepath <path> --check
  ```

  `40f0179` 時点で未通過なのは `packages/mercari/src/` 配下 21 ファイル。増えていなければ自分の変更は白。**リポジトリ全体を `npm run format` で一括整形しない**（差分が膨れて本来の変更が埋もれる）。触ったファイルだけ `npx prettier --write <パス>` で直す。
- **Prettier は 3.6 系に固定している**（ルート `package.json` の `~3.6.2`）。3.9 系ではメルカリの未通過が 24 ファイルに増える。上げるなら、その 3 ファイルの整形を `style:` の別コミットにしてから上げる。
- **改行コードは [.gitattributes](.gitattributes) で LF に固定している。** `core.autocrlf` の設定に関わらず LF でチェックアウトされる。`format:check` が全ファイルで落ちたら、まず改行コードを疑う（`git ls-files --eol <パス>` の `w/` が `lf` か）。
- **`npm run <script>` はルートの `--workspaces` 経由で両パッケージを回す。** 片方が失敗しても、もう片方も実行されてから exit 1 になる。出力のどのパッケージで落ちたかを見る（`npm error workspace <name>` の行）。
- **`lint` の対象は [eslint.config.js](eslint.config.js) の `files: ['**/*.ts', '**/*.tsx']` と各パッケージの `eslint src` で決まる。** `webpack.config.js` や `eslint.config.js` 自身は lint されない。
- **ビルドが通っても動作確認にはならない。** 自動テストが無いため、挙動を変えたら Chrome に読み込んで確かめる（[.claude/skills/local-setup/SKILL.md](.claude/skills/local-setup/SKILL.md)）。確かめていないなら報告に「未検証」と書く。
- **`manifest.json` を変えたらページのリロードでは反映されない。** `chrome://extensions` で拡張自体を再読み込みする（`dist/*.js` の変更はページのリロードで反映される）。
- **`npm install` はルートで実行する。** パッケージディレクトリで実行しても動くが、`package-lock.json` はルートの 1 つだけが正。パッケージ配下に `package-lock.json` や `node_modules` ができていたら消す。

### CI

CI は存在しない（`.github/workflows/` 無し）。CI を追加したら、そのワークフローが実行するコマンドをこの表と一致させること。
