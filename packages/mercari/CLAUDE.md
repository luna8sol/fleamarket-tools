# CLAUDE.md（packages/mercari）

メルカリの下書き商品を一括出品・再出品する Chrome 拡張機能（Manifest V3 / TypeScript）。拡張名は **Mercari Draft Publisher**。

**共通規約（ブランチ運用・コミットメッセージ・scope・コミット日時・検証コマンド・共通のコーディングルール）はルートの [CLAUDE.md](../../CLAUDE.md) にある。** このファイルには**このパッケージに固有のこと**だけを書く。このファイル内の相対パスは `packages/mercari/` 起点。

## このパッケージの最重要方針

ルートの「最重要方針」2 つを、このサイト向けに具体化したもの。実装・レビュー・設計判断が競合したときは他のすべてより優先する。

1. **誤操作・誤出品を起こさない。** 一括出品・一括再出品は取り消せない実操作で、対象を間違えると実際の商品が世に出る。処理対象の絞り込み条件、件数、確定操作のガードを最優先で確かめる。途中で失敗したときに部分適用のまま止まらないこと、失敗が観測できることを含む。
   - 再出品後の自動保存で押すのは**「下書きに保存する」だけ**。「出品する」は押さない（README の「再出品後の自動下書き保存」）。
   - 説明文の一括置換は、原本との照合が通った商品だけ保存する。照合を弱めない。
2. **メルカリ側の DOM 変更に耐える。** セレクタとページ判定はこちらが制御できない外部構造に依存している。セレクタは必ず [src/content/infra/constants.ts](src/content/infra/constants.ts) に集約し、想定した要素が見つからないときは**黙って何もしないのではなく、検知して安全に止まる**こと。`waitForElement` 系の失敗は呼び出し元に伝える（`onNotFound` コールバック）。

### セルフレビューで見る固有の観点

ルートの `self-review` スキルの観点 1 で、このパッケージの変更に対して照らすもの。

- 一括出品・一括再出品の**対象の絞り込み条件と件数**が変わっていないか。ユーザーが選んでいない商品が対象に入りうるか。確定操作（出品ボタンのクリック）に至る経路にガードがあるか。
- 新しいセレクタを `src/content/infra/constants.ts` の外に直書きしていないか。
- 処理中フラグ（`isProcessingPage` 等）が、例外経路も含めて必ず戻るか。
- `catch` で握り潰していないか、[src/content/infra/logger.ts](src/content/infra/logger.ts) のログが出るか。
- `chrome.storage.local` から読んだ値（[src/common/ext-storage.ts](src/common/ext-storage.ts)）を型どおりと信じていないか。
- Claude API キーが content script 側のコードに渡っていないか（下記コーディングルール）。

## 着手前に読むもの

**実装判断の前に、該当する一次資料とコードを直接読む。** このファイルには要約を置かない。

| 領域 | 一次資料 |
| --- | --- |
| アーキテクチャ・3 層構造・処理フロー | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)（※下記の既知のズレを読むこと） |
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
| 一覧の先頭から指定の行までの一括選択・Shift での範囲選択 | [src/content/ui/select-up-to.ts](src/content/ui/select-up-to.ts), [src/content/ui/checkbox-manager.ts](src/content/ui/checkbox-manager.ts) |
| 一覧の各行のチェックボックス列（商品リンクの外に置く） | [src/content/ui/row-gutter.ts](src/content/ui/row-gutter.ts) |
| 選択状態・選択順の管理 | [src/content/logic/selection-manager.ts](src/content/logic/selection-manager.ts) |
| DOM 変更の監視 | [src/content/logic/observer-manager.ts](src/content/logic/observer-manager.ts) |
| UI 全体の組み立て | [src/content/ui/ui-manager.ts](src/content/ui/ui-manager.ts), [ui/index.ts](src/content/ui/index.ts) |
| 注入 UI の見た目（トークン・ライト/ダーク・部品・アイコン・確認ダイアログ） | [theme.ts](src/content/ui/theme.ts), [components.ts](src/content/ui/components.ts), [icons.ts](src/content/ui/icons.ts), [confirm-dialog.ts](src/content/ui/confirm-dialog.ts) |
| 一括操作バー | [bulk-bar-core.ts](src/content/ui/bulk-bar-core.ts), [bulk-bar-ui.ts](src/content/ui/bulk-bar-ui.ts), [bulk-bar-utils.ts](src/content/ui/bulk-bar-utils.ts), [bulk-relist.ts](src/content/ui/bulk-relist.ts) |
| Claude API の呼び出し・プロンプト・APIキーの扱い | [src/background/](src/background/)（[claude-client.ts](src/background/claude-client.ts), [prompt.ts](src/background/prompt.ts), [api-error.ts](src/background/api-error.ts)） |
| AI 説明文生成（編集ページ側） | [edit-entry.ts](src/content/edit-entry.ts), [edit-form.ts](src/content/logic/edit-form.ts), [description-generator.ts](src/content/logic/description-generator.ts), [description-panel.ts](src/content/ui/description-panel.ts) |
| APIキーの設定画面 | [options.html](options.html), [src/options/index.ts](src/options/index.ts) |
| ポップアップ・設定画面の共通スタイル | [extension-pages.css](extension-pages.css)（トークンは `theme.ts` と同じ値） |
| ビルド構成（エントリ 5 つ。browser と service worker で target を分けている） | [webpack.config.js](webpack.config.js), [tsconfig.json](tsconfig.json)（ルートの `tsconfig.base.json` を extends） |
| lint / format 構成 | ルートの [eslint.config.js](../../eslint.config.js), [.prettierrc](../../.prettierrc) |

### ドキュメントとコードの既知のズレ

**文書とコードが食い違ったらコードが正。** 古い記述を見つけたらその場で直す。**ここに列挙して放置しない**（リストが育つとどれが現役の注意書きか分からなくなる）。ファイルを増やす・動かすときは、同じコミットで `docs/ARCHITECTURE.md` の表とこのファイルの索引も直すこと。

- **README.md の「セットアップ」「開発コマンド」は単独リポジトリ時代の記述**（2026-10-05 のモノレポ化で古くなった）。`npm install` / `npm run build` はリポジトリルートで実行し、Chrome に読み込むディレクトリは「リポジトリルート」ではなく **`packages/mercari`**。正しい手順はルートの [README.md](../../README.md) と `local-setup` スキル。README の機能説明・設計の節は現状どおり。
- `docs/ARCHITECTURE.md` の 3 つの表・共通層・background・options page の記載は、2026-09-19 時点（元リポジトリ `01e445a`）で `src/` 配下の全ファイルと 1 対 1 で突き合わせて確認済み。それ以降に足したファイル（Shift 範囲選択など）が表に載っているかは、触るときに確かめる。

## コーディングルール（このパッケージ固有）

共通ルール（`any` 禁止・戻り値型・クォート・未使用 import・シングルトン）はルートの CLAUDE.md。加えて:

- DOM セレクタ・設定値は必ず [src/content/infra/constants.ts](src/content/infra/constants.ts) に追加する
- ログは [src/content/infra/logger.ts](src/content/infra/logger.ts) を使う。接頭辞は `[Mercari Draft Publisher]`（共有部品へ移すときもこの文字列を変えない）
- **Claude API キーを読むのは `src/background/` と options page だけ。** content script 側のコードに渡さない（メルカリのページへ注入されるバンドルにキーを載せないため）。生成処理は `chrome.runtime.sendMessage` で background に依頼する
- **background・options page から使うモジュールは `src/common/` に置く。** `src/content/` 配下は content script のための層。service worker から参照すると層の意味と食い違う
  - **既知の例外: `src/common/` と `src/background/` が `src/content/infra/logger` に依存している**（層の逆依存）。logger を `packages/core` に移すと解消する予定。それまでは踏襲してよいが、新たな逆依存を増やさない

## 落とし穴（このパッケージ固有）

共通の落とし穴（`format:check` の既存分・改行コード・`--workspaces` の挙動）はルートの CLAUDE.md。加えて:

- **`npm run format:check` はこのパッケージが元から落ちる。** コミット済み内容で `src/` 配下 21 ファイル（2026-10-05 / `40f0179`）。自分が触ったファイルが指摘に増えていないかで判断する。
- **`@anthropic-ai/sdk` はこのパッケージの `dependencies`**（ルートの devDependencies ではない）。`src/background/` が実行時に使う唯一のランタイム依存。バンドルに入るので、ここに増やすものは慎重に選ぶ（現状 `dist/background.js` は開発ビルドで約 930KB）。
- **background は `target: 'webworker'` で、`LimitChunkCountPlugin` で 1 チャンクにまとめている**（service worker は単一ファイルである必要があるため）。動的 import を足してもチャンクは分かれない。
- **選択状態は永続化していない**（メモリ上のみ）。リロードやページ遷移で消えるのが現在の仕様。
