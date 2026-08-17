# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

ラクマ（fril.jp）の出品作業を一括化する Chrome 拡張機能（Manifest V3 / TypeScript）。`/sell` の一括下書き保存、`/draft` の下書き一括出品、`/sell`・`/draft` の一括削除を行う。

このファイルは**規約の正本**。手順はスキル（`.claude/skills/`）に置き、規約はここ 1 か所に置く。同じ規約を複数のスキルに書かない（片方だけ育ってズレる）。

## このプロジェクトの最重要方針

実装・レビュー・設計判断が競合したときは、この 2 つを他のすべてより優先する。

### 1. 取り消せない操作を誤って実行しない

一括出品・一括削除は取り消せない実操作で、対象を間違えると実際の商品が世に出る／消える。次の 6 つは安全装置なので、**弱める変更をしない**。

- **自動クリックは、Background への `CHECK_AUTO_TAB` 問い合わせで `isAutoTab: true` が返ったタブでのみ実行する**（[src/content/form/index.ts](src/content/form/index.ts)）。ユーザーが手動で開いた出品ページでは何もしない。この確認を外すと、ユーザーが自分で開いた下書きが勝手に出品される。
- **`/sell` の一括処理は出品せず「下書きに保存する」で止める。** 再出品は「`/sell` で下書きに溜める → 内容を確認 → `/draft` で公開する」の 2 段構え。この分離が誤出品に対する最大の防御なので、`/sell` 側から直接出品する経路を作らない。
- **保存前の差分チェックを弱めない**（[src/content/form/diff.ts](src/content/form/diff.ts)）。再出品元の商品ページと突き合わせ、**内容が欠けていれば保存しない**。フリマアシストの画像アップロードは遅れるため、待たずに保存すると画像の欠けた下書きができる。
- **一括削除の確認を外さない。** 開始前に拡張側で件数と処理順を出して確認ダイアログ（[ui/confirm-dialog.ts](src/content/list/ui/confirm-dialog.ts)。初期フォーカスはキャンセル、`<dialog>` が使えなければ `window.confirm`）を取る（[src/content/list/bulk-bar-handlers.ts](src/content/list/bulk-bar-handlers.ts)）。削除リンクは `data-method="delete"` と**ラベルが「削除」であること**の両方を確認してからクリックし、`data-confirm` は**クリック直前だけ外して直後に必ず戻す**（[src/content/list/logic/delete-clicker.ts](src/content/list/logic/delete-clicker.ts)）。
- **失敗時は処理中のタブを閉じない。** バリデーションエラーの内容をユーザーが確認できなくなる。
- **説明文の一括置換は、保存前の 4 段の照合（商品名一致 / 現在値が原本と一致 / 書き込み後の値が確定版と一致 / 商品名が変わっていない）を弱めない**（[src/content/form/replace.ts](src/content/form/replace.ts)）。編集ページ `/item/{hash}/edit` で押すのは「確認する」→「更新する」だけで、同じページにある「下書きに保存する」（出品中の商品が下書きへ落ちる）・「出品する」・「削除」には触れない。説明欄以外の項目を変えない。
- **商品間の待機を縮めない・外さない**（`WAIT_BETWEEN_ITEMS_MS` + `WAIT_RANDOM_MS` = 60〜75 秒。削除のみ `DELETE_DELAY_MS` + `DELETE_RANDOM_MS` = 2〜4 秒）。

加えて、処理対象の絞り込み条件と件数、途中で失敗したときに部分適用のまま黙って止まらないこと、失敗が観測できること（`failed` に理由付きで積まれ、`warn` が出ること）を確かめる。

### 2. ラクマ側の DOM 変更に耐える

セレクタとページ判定はこちらが制御できない外部構造に依存している。

- 一覧ページのセレクタは必ず [src/content/list/infra/constants.ts](src/content/list/infra/constants.ts) に集約する。
- **出品フォームのボタンはクラス名で特定しない。** ラクマの出品フォームは React / Chakra UI 製で `css-*` クラスがビルドごとに変わるため、**テキスト完全一致**で探す（[src/content/form/button-finder.ts](src/content/form/button-finder.ts)）。
- **押すボタンはページの中身ではなくキューのモードで決める。** `/item/new` と `/drafts/{hash}/edit` はどちらも「下書きに保存する」と「確認する」を持つため、ボタン名からページを判別してはいけない。
- 想定した要素が見つからないときは、**黙って何もしないのではなく、検知して安全に止まる**。待機の失敗を握り潰さず `FORM_FAILED` として Background へ伝える、`collectItems` のスキップを `warn` に出す、といった既存の作りを壊さない。

## 着手前に読むもの

**実装判断の前に、該当する一次資料とコードを直接読む。** このファイルには要約を置かない（要約はここだけ更新されずに古い前提で作業される）。

**[README.md](README.md) が設計判断の一次資料。** なぜその作りになっているか（完了判定を Background に置く理由、入力完了の待ち方、差分チェックの向き、削除がページ遷移をまたぐ理由、実機で確認済みの DOM 前提）はすべてそこにある。**コードを変える前に該当する節を読む。**

| 領域 | 一次資料 |
| --- | --- |
| 機能概要・設計判断・実機で確認済みの DOM 前提・開発コマンド | [README.md](README.md) |
| ブランチ運用・コミットメッセージ・コードスタイル | [CONTRIBUTING.md](CONTRIBUTING.md) |
| 拡張機能の権限・対象 URL・エントリーポイント | [manifest.json](manifest.json) |
| Background ⇔ Content のメッセージ型・キューの型 | [src/common/messages.ts](src/common/messages.ts) |
| メッセージ送信のラッパー（応答型の解決） | [src/common/send-message.ts](src/common/send-message.ts) |
| キューのモードごとの性質表（一覧タブ依存・フォーム有無・完了判定・商品間の待機） | [src/common/queue-mode-traits.ts](src/common/queue-mode-traits.ts) |
| 処理キュー・タブ追跡・完了検知・待機・ウォッチドッグ | [src/background/queue-manager.ts](src/background/queue-manager.ts) |
| Background の配線（メッセージ・タブ・アラーム） | [src/background/index.ts](src/background/index.ts) |
| 再出品元の商品ページの取得（JSON-LD / 画像枚数） | [src/background/source-item.ts](src/background/source-item.ts) |
| 出品フォームページの URL 判定（Background と Content で共有） | [src/common/form-page.ts](src/common/form-page.ts) |
| 出品フォームの自動処理ガード・`data-rbl-form` マーカー | [src/content/form/index.ts](src/content/form/index.ts) |
| モード別のボタン操作（下書き保存 / 確認する → 出品する） | [src/content/form/auto-submit.ts](src/content/form/auto-submit.ts) |
| 説明文の置換（編集ページでの 4 段の照合・確認する → 更新する） | [src/content/form/replace.ts](src/content/form/replace.ts) |
| 説明文の置換の入力 JSON の検証・処理対象の振り分け | [src/content/list/logic/replace-plan.ts](src/content/list/logic/replace-plan.ts) |
| 説明文の置換パネル（ファイル選択 → 件数 → 確認 → 開始 / 停止 / 結果出力） | [src/content/list/ui/replace-panel.ts](src/content/list/ui/replace-panel.ts) |
| 説明文の置換の処理記録（`chrome.storage.local`） | [src/common/replace-store.ts](src/common/replace-store.ts) |
| 文字数 + FNV-1a による本文の照合 | [src/common/text-fingerprint.ts](src/common/text-fingerprint.ts) |
| フォーム内容の読み取り・入力完了の待機 | [src/content/form/form-state.ts](src/content/form/form-state.ts) |
| 再出品元との差分チェック | [src/content/form/diff.ts](src/content/form/diff.ts) |
| フォームのボタン特定 | [src/content/form/button-finder.ts](src/content/form/button-finder.ts) |
| 出品フォームのボタンラベル・設定値 | [src/content/form/constants.ts](src/content/form/constants.ts) |
| ポーリング待機ユーティリティ | [src/content/form/wait.ts](src/content/form/wait.ts) |
| 一定時間の待機（一覧・フォーム共通） | [src/content/wait.ts](src/content/wait.ts) |
| セレクタ・クラス名・ID・設定値（一覧ページ） | [src/content/list/infra/constants.ts](src/content/list/infra/constants.ts) |
| ページ種別（`/sell` / `/draft`）の判定 | [src/content/list/infra/page-detector.ts](src/content/list/infra/page-detector.ts) |
| 一覧の描画監視（MutationObserver） | [src/content/list/infra/list-observer.ts](src/content/list/infra/list-observer.ts) |
| 商品の収集・再出品ボタンの探索 | [src/content/list/logic/item-collector.ts](src/content/list/logic/item-collector.ts) |
| 削除リンクの特定とクリック | [src/content/list/logic/delete-clicker.ts](src/content/list/logic/delete-clicker.ts) |
| 削除対象が居るページの探索（ページを跨いで探す） | [src/content/list/logic/delete-locator.ts](src/content/list/logic/delete-locator.ts) |
| ページ送り（削除後に 1 ページ目へ戻る問題の対処） | [src/content/list/logic/pager.ts](src/content/list/logic/pager.ts) |
| 選択状態・選択順の管理 | [src/content/list/logic/selection-manager.ts](src/content/list/logic/selection-manager.ts) |
| Background へ送るメッセージ（LIST_READY・キューの開始/停止・進捗取得） | [src/content/list/logic/queue-client.ts](src/content/list/logic/queue-client.ts) |
| 一覧ページの組み立て（配線のみ） | [src/content/list/index.ts](src/content/list/index.ts) |
| 一括操作バーのボタン処理・一括削除の確認 | [src/content/list/bulk-bar-handlers.ts](src/content/list/bulk-bar-handlers.ts) |
| 一覧の描画に追従したチェックボックスの付与 | [src/content/list/item-sync.ts](src/content/list/item-sync.ts) |
| Background から届くメッセージの処理（クリック指示・進捗の反映） | [src/content/list/message-handlers.ts](src/content/list/message-handlers.ts) |
| 一覧ページ側のキュー実行中状態（`queueRunning`。チェックボックスの有効/無効も同時に切り替える） | [src/content/list/run-state.ts](src/content/list/run-state.ts) |
| 一括操作ドック・チェックボックス・トースト | [ui/bulk-bar.ts](src/content/list/ui/bulk-bar.ts), [ui/checkbox-manager.ts](src/content/list/ui/checkbox-manager.ts), [ui/notification.ts](src/content/list/ui/notification.ts) |
| 確認ダイアログ（削除・置換の前） | [ui/confirm-dialog.ts](src/content/list/ui/confirm-dialog.ts) |
| 注入 UI のスタイル・共通部品 | [ui/theme.ts](src/content/list/ui/theme.ts), [ui/components.ts](src/content/list/ui/components.ts) |
| デザイントークン・ライト/ダークの設定（注入 UI と popup で共有） | [src/common/theme.ts](src/common/theme.ts), [src/common/icons.ts](src/common/icons.ts) |
| ログ出力 | [src/common/logger.ts](src/common/logger.ts) |
| ビルド構成 | [webpack.config.js](webpack.config.js), [tsconfig.json](tsconfig.json) |
| lint / format / 改行コード | [eslint.config.js](eslint.config.js), [.prettierrc](.prettierrc), [.gitattributes](.gitattributes) |

### 既知の状態（2026-09-28 時点）

**文書とコードが食い違ったらコードが正。** 古い記述を見つけたらその場で直す。

- **一括削除はコードが入っているだけで、実行しての動作確認がされていない**（README の「未検証」）。DOM の構造と `data-confirm` の挙動までは実機確認済み。**取り消せない操作なので、変更するなら実機確認までを 1 単位にする。**
- **説明文の一括置換（replace モード）は 123 件の実運用で確認済み**（2026-09-28。README の「未検証」の節にある）。最初の 3 件で完了処理の再入（次の商品を飛ばす）を見つけて直し、修正後に 120/120 成功。
- **`manifest.json` の content-form の `matches` に `https://fril.jp/item/*/edit*` を足した**（2026-09-28）。`/item/{hash}/edit` は [form-page.ts](src/common/form-page.ts) で `replace` に判定される。`/item/new` は従来どおり `relist`。
- **`manifest.json` の `https://fril.jp/draft*` は `/drafts/{hash}/edit`（出品フォーム）にもマッチする。** 一覧用 content script がフォームで動かないのは、[page-detector.ts](src/content/list/infra/page-detector.ts) が `/drafts` を `UNKNOWN` に落としているからで、manifest 側では除外していない。**片方だけ変えない。**
- **キューの状態は `chrome.storage.session` に保存され、Service Worker の破棄に耐える。** 変更のたびに書き戻し、各イベントハンドラの先頭で復元する。タイマーは `setTimeout` ではなく `chrome.alarms`（SW の破棄で消えるため）。**`chrome.alarms` は 30 秒未満の遅延がクランプされる**ので、短い待機には使えない。
- **2026-09-19 に履歴を書き換えて push し直した。** ルートコミットの日時を揃えたうえで全コミットを 10 分刻みに並べ直し（旧ルート `e0c9316` → 新ルート `d99546a`）、`main` を force push した。`main` は現在も `origin` と一致している（`develop` は origin/develop より先行しており、未 push のコミットがある）。**この書き換えより前のクローンが手元にあれば `git fetch && git reset --hard origin/main` で追随させること**（そのままでは pull が失敗する）。
- **自動テストは存在しない。** 「テストを回す」は型チェック・ビルド・静的解析を回すことを指す（下記「検証」）。

## コーディングルール

- `any` 型は禁止（ESLint で error）
- 関数には戻り値の型を明示する（ESLint で warn）
- 文字列はシングルクォート、文末セミコロン必須
- 未使用 import は自動検出・エラー扱い
- 一覧ページの DOM セレクタ・クラス名・ID・設定値は必ず [src/content/list/infra/constants.ts](src/content/list/infra/constants.ts) に追加する
- 出品フォームページのボタンラベル・タイムアウト等の設定値は必ず [src/content/form/constants.ts](src/content/form/constants.ts) に追加する。**ラベルはボタン特定に使うテキスト完全一致の値なので、実機を確認せずに変えない**
- Background ⇔ Content のやり取りは必ず [src/common/messages.ts](src/common/messages.ts) の型を経由する。新しいメッセージはまずここに型を足す
- 送信は [src/common/send-message.ts](src/common/send-message.ts) の `sendToTab` / `sendToRuntime` を使う。`chrome.tabs.sendMessage` / `chrome.runtime.sendMessage` を呼び出し側から直接呼ばない（戻り値が `any` のため、呼び出し側ごとに型アサーションを書くと応答型の食い違いを検査できない）。応答型は `messages.ts` の `MessageResponses` に書く
- 出品フォームページの URL 判定は [src/common/form-page.ts](src/common/form-page.ts) に集約する（Background と Content の双方から使うため、片側に直書きしない）
- モードによって変わる振る舞いを増やすときは、`mode === 'delete'` のような個別の比較を書かずに [src/common/queue-mode-traits.ts](src/common/queue-mode-traits.ts) の `QUEUE_MODE_TRAITS` へ性質を足す（`Record<QueueMode, QueueModeTraits>` なので、モードを足したときに記入漏れがコンパイルエラーになる）
- キューの状態を増やしたら `chrome.storage.session` に保存される形にする（Service Worker が破棄されても続きから処理できること）
- 主要なマネージャークラスはファイル末尾でシングルトンとしてエクスポートする（例: `export const queueManager = new QueueManager()`）
- ログは `console.log` を直接呼ばず [src/common/logger.ts](src/common/logger.ts) の `log` / `warn` / `debug` を使う
- 拡張の外から挙動を切り分けられるようにする。出品フォーム側の状態は `<html data-rbl-form="checking|auto|manual">` に出す（console ログは拡張の外からは読めない）

## ブランチ運用・コミットルール

**正本は [CONTRIBUTING.md](CONTRIBUTING.md)。** ブランチ構成（`main` / `develop` / `feature/*` / `fix/*` / `docs/*` / `refactor/*`）、コミットメッセージのプレフィックス 8 種（`feat:` / `fix:` / `docs:` / `style:` / `refactor:` / `perf:` / `test:` / `chore:`）、コードスタイルはそちらを参照する。

### ブランチ運用の補足（CONTRIBUTING.md に無い部分）

- **統合ブランチは `develop`。ここで直接作業しない。** 各タスクは `develop` からトピックブランチを切る。
  - `develop` は 2026-09-19 に `main` から作ったブランチで、`origin/develop` と同期している。
- 命名は CONTRIBUTING.md の規則（`feature/` / `fix/` / `docs/` / `refactor/` + ハイフン区切りの英小文字）。日付・イニシャル・連番は入れない。
  - **`feature/` を既定にしない。** 中身が修正なら `fix/`、ドキュメントなら `docs/`、挙動を変えない整理なら `refactor/`。コミットの prefix と同じく**中身で選ぶ**。
- **エージェントが自動命名したブランチ（`claude/...`、`worktree-...`）のまま作業を終えない。** 規約名に直す。

  ```bash
  git branch -m <規約名>
  ```

- **トピックブランチは origin に push しない**（ローカル限り）。origin と同期するのは `main` と `develop` の 2 本だけ。
- 統合は **rebase してから `--ff-only`** で行う。**マージコミットを作らない**（履歴を直線に保つ）。手順は [.claude/skills/merge/SKILL.md](.claude/skills/merge/SKILL.md)。
- **マージ後に作業ブランチを削除する**（`git branch -d`）。
- **対応済みのセッション・ブランチ・worktree がまとめて溜まったら整理する**（手順は [.claude/skills/cleanup/SKILL.md](.claude/skills/cleanup/SKILL.md)）。
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
  | `form` | `src/content/form/` |
  | `content` | `src/content/` 全体にまたがる変更 |
  | `common` | `src/common/` |
  | `popup` | `src/popup/`, `popup.html` |
  | `manifest` | `manifest.json` |
  | `build` | `webpack.config.js`, `tsconfig.json`, `package.json`, `eslint.config.js`, `.prettierrc`, `.gitignore`, `.gitattributes` |
  | `docs` | `README.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `.claude/` |

- 件名は**動詞の原形で始める**（imperative mood）。`Fixed` / `Fixes` / 名詞句にしない
- 先頭は小文字、**末尾にピリオドを打たない**
- **50 字以内**（`<prefix>(<scope>): ` は字数に含めない）
- **「何を」「どうした」を両方入れる**（`fix: bug fix` のような無情報の件名は不可）
- 本文は任意。書くなら**なぜそうしたか**を書く（差分を読めば分かるファイル列挙は書かない）
- **`Co-Authored-By` と生成表示（「🤖 Generated with Claude Code」等）を付けない。**

### 良い例（`develop` の実際のコミットから）

```
fix: add checkboxes as the list renders instead of once at document_idle
feat: make the queue survive SW teardown and detect completion in background
perf: return to the recorded page when deleting instead of scanning from page 1
```

### 悪い例

```
feat: initial scaffold with bulk relist/publish core flow
```
→ 件名 52 字で 50 字超過（ルートコミットの `d99546a`）。今後は踏襲しない。

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
- **push 済みのコミットには適用しない**（ハッシュが変わるため）。必要なら**実行前に理由と影響範囲を報告して指示を仰ぐ**（2026-09-19 のルートコミット書き換えは、この手順で承認を得たうえで実施した）
- 手順は [.claude/skills/commit/SKILL.md](.claude/skills/commit/SKILL.md) の「コミット日時を揃える」

## 検証

**このリポジトリには自動テストが存在しない。** `package.json` に `test` スクリプトは無く、テストフレームワークも依存に入っていない。「テストを回す」は現状**型チェック・ビルド・静的解析を回す**ことを指す。

パッケージは**ルート 1 つだけ**（モノレポではない）。すべてリポジトリルートで実行する。

| 項目 | コマンド | 現状（2026-09-19 実測） |
| --- | --- | --- |
| 型チェック | `npm run typecheck` | **通過**（exit 0）。約 5 秒 |
| ビルド | `npm run build` | **通過**（exit 0）。約 6 秒（初回は 30 秒以上かかることがある） |
| 静的解析 | `npm run lint` | **通過**（exit 0）。約 4 秒 |
| フォーマット | `npm run format:check` | **通過**（exit 0）。約 3 秒 |
| テスト | （無し） | テストフレームワーク未導入 |

**4 つとも通るのが正常。落ちたらそれは自分の変更のせい。** その他のコマンドは [README.md の「コマンド」](README.md) を参照。

### 落とし穴

- **改行コードは [.gitattributes](.gitattributes) で LF に固定している。** Prettier の `endOfLine` 既定値が `"lf"` のため、作業ツリーが CRLF になると中身が整形済みでも `format:check` が全ファイルを差分として報告する（2026-09-19 まで実際にそうなっていた）。`core.autocrlf` の設定に関わらず LF でチェックアウトされる。**`format:check` が全ファイルで落ちたら、まず改行コードを疑う**（`git ls-files --eol <パス>` の `w/` が `lf` か）。
- **`npm run format` でリポジトリ全体を一括整形しない。** 触ったファイルだけ `npx prettier --write <パス>` で直す（差分が膨れて本来の変更が埋もれる）。
- **`lint` の対象は [eslint.config.js](eslint.config.js) の `files: ['**/*.ts', '**/*.tsx']` で決まる。** `webpack.config.js` や `eslint.config.js` 自身は lint されない。
- **ビルドが通っても動作確認にはならない。** 自動テストが無いため、挙動を変えたら Chrome に読み込んで確かめる（`local-setup` スキル）。確かめていないなら報告に「未検証」と書く。
- **`manifest.json` を変えたらページのリロードでは反映されない。** `chrome://extensions` で拡張自体を再読み込みする（`dist/*.js` の変更はページのリロードで反映される）。

### CI

CI は存在しない（`.github/workflows/` 無し）。CI を追加したら、そのワークフローが実行するコマンドをこの表と一致させること。
