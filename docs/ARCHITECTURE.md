# アーキテクチャ設計ドキュメント

## 概要

この拡張機能は Chrome の Manifest V3 アーキテクチャに基づいて構築されています。

- **Content Script**: メルカリサイト上で実行される主要なコード。エントリーポイントは 2 つある
  - `dist/content.js` … 一覧ページ（`jp.mercari.com/mypage/drafts`・`/mypage/listings`）。一括出品・一括再出品
  - `dist/edit.js` … 出品フォームのあるページ（`jp.mercari.com/sell*`）。AI 説明文生成
- **Background Script**: service worker（`dist/background.js`）。content script からの依頼を受けて Claude API を呼ぶ
- **Popup**: ツールバーアイコンから開くポップアップ画面（デバッグモード切り替え）
- **Options Page**: 拡張機能の設定画面（`options.html`）。Claude API キーの保存

## ディレクトリ構造

```
mercari-draft-publisher/
├── docs/                  # ドキュメント
├── dist/                  # ビルド成果物（gitignore 済み。manifest.json が参照する）
├── src/
│   ├── background/        # Background（service worker）
│   ├── common/            # 共通層（DOM操作・汎用関数・ストレージ・メッセージ型）
│   ├── content/           # Content Script
│   │   ├── index.ts       # 一覧ページのエントリーポイント
│   │   ├── edit-entry.ts  # 編集・出品フォームページのエントリーポイント
│   │   ├── infra/         # インフラ層
│   │   ├── logic/         # ロジック層
│   │   └── ui/            # UI層
│   ├── options/           # Options Page
│   └── popup/             # Popup
├── manifest.json
├── options.html
├── popup.html
├── webpack.config.js
└── tsconfig.json
```

**`webpack.config.js` は配列 config になっている。** ブラウザで動く `content` / `edit` / `popup` / `options` は `target: 'web'`、`background` だけ `target: 'webworker'` でビルドする。service worker は単一ファイルである必要があるため、`background` は `LimitChunkCountPlugin` で 1 チャンクにまとめている。

## 共通層（src/common/）

content script・background・popup・options page のどこからでも import できる層です。**background から使うものはここに置きます**（`src/content/` 配下は content script のための層なので、service worker から参照すると層の意味と食い違う）。

| ファイル | 役割 |
|---------|------|
| `ext-storage.ts` | `chrome.storage.local` への読み書き（`ExtStorageKey` enum でキー管理）。ポップアップ・content script・background・options page が同じ領域を共有する |
| `messaging.ts` | content script ⇔ background のメッセージ型と `MESSAGE_ACTION` 定数 |
| `dom.ts` | 例外安全な DOM 操作ラッパー。React 制御下の input へ値を入れる `setReactInputValue` もここ |
| `utils.ts` | 非同期待機・乱数などの汎用関数 |

## Background（src/background/）

service worker として動きます。**Claude API キーを扱うのはこの層だけです。** content script には API キーもクライアントも渡さず、生成依頼は `chrome.runtime.sendMessage` 経由で受け取ります（メルカリのページへ注入されるコードにキーを載せないため）。

| ファイル | 役割 |
|---------|------|
| `index.ts` | エントリーポイント。`chrome.runtime.onMessage` で生成依頼を受け、結果を返す |
| `claude-client.ts` | `@anthropic-ai/sdk` を使った Claude API 呼び出し。API キーの読み込みもここ |
| `prompt.ts` | システムプロンプトとユーザーメッセージの組み立て（画像ブロックの変換を含む） |
| `api-error.ts` | SDK の型付き例外を日本語メッセージへ変換 |

## Options Page（src/options/）

`options.html` のエントリーポイント。Claude API キーの保存・削除だけを担います。キーは `chrome.storage.local`（`ExtStorageKey.CLAUDE_API_KEY`）に入り、実際の API 呼び出しは background が行います。

## 3 層構造

### インフラ層（src/content/infra/）

基盤となる機能を提供します。

| ファイル | 役割 |
|---------|------|
| `constants.ts` | 定数の一元管理（一覧ページの `SELECTOR`・編集フォームの `EDIT_SELECTOR`・出品フォームの `SELL_FORM_FIELDS`・クラス名・ID・待機時間・デフォルト設定） |
| `types.ts` | 型定義（`UserSettings`・自動保存まわりの各型） |
| `page-detector.ts` | URL からページタイプ（`DRAFTS` / `LISTINGS` / `EDIT_DRAFT` / `EDIT_LISTING` / `SELL` / `UNKNOWN`）を検出。出品フォームの有無は `isSellFormPage()` で判定する |
| `user-settings.ts` | ユーザー設定の読み書き（未保存の項目は `DEFAULT_USER_SETTINGS` で補完）。保存先は [`src/common/ext-storage.ts`](../src/common/ext-storage.ts) |
| `relist-queue.ts` | 再出品の待ち行列。一覧ページで積んだ元商品スナップショットを出品フォーム側が FIFO で取り出す |
| `auto-save-settings.ts` | 再出品後の自動保存設定の読み書き |
| `logger.ts` | デバッグ用ロガー（ログレベル制御あり） |
| `debounce.ts` | 連続操作の制御 |
| `error-handler.ts` | エラー処理 |

### ロジック層（src/content/logic/）

拡張機能のコアロジックを実装します。

| ファイル | 役割 |
|---------|------|
| `app-initializer.ts` | アプリ初期化・各層の統合・ページタイプに応じたセットアップ |
| `observer-manager.ts` | MutationObserver による DOM 変更の監視と処理。UI の初期描画もここが担う。リストが現れるまでは `document.body` を監視して待ち、`CONFIG.LIST_WAIT_TIMEOUT_MS` を過ぎたら `list-load-error.ts` で知らせる |
| `selection-manager.ts` | 選択商品の追加・削除・順序管理（**永続化はしない。メモリ上のみ**） |
| `publisher.ts` | 下書きの自動出品処理 |
| `relist-manager.ts` | 出品中商品の再出品処理（クリック前に元商品スナップショットを取得） |
| `common-processor.ts` | 出品・再出品に共通する逐次処理 |
| `edit-form.ts` | 出品・編集フォームの読み書き（商品名・カテゴリ・状態・属性・画像の取得と、説明欄への書き戻し） |
| `description-generator.ts` | background へ説明文の生成を依頼する。例外は投げず、必ず成否を表す結果型で返す |
| `filter-manager.ts` | 出品中一覧のいいね・コメント数によるフィルター。カウントを読めないときは適用せず解除する |
| `item-snapshot.ts` | 元商品の編集フォームを隠し iframe で開き、比較の基準値を読み取る |
| `sell-form.ts` | 出品フォームのアダプタ（入力欄の解決・値の読み書き） |
| `relist-verifier.ts` | 元商品と出品フォームの比較・差分の自動修正 |
| `auto-save-controller.ts` | 再出品タブでの自動保存の制御 |
| `value-normalizer.ts` | 比較用の値の正規化（改行・全角数字・桁区切りの表記ゆれを吸収） |
| `dom-utils.ts` | DOM 操作のユーティリティ関数 |

### UI 層（src/content/ui/）

ユーザーインターフェースを構築します。

| ファイル | 役割 |
|---------|------|
| `ui-manager.ts` / `index.ts` | UI 全体の管理・ページタイプに応じた切り替え |
| `bulk-bar-core.ts` / `bulk-bar-ui.ts` / `bulk-bar-utils.ts` | 一括操作バー（出品・再出品ボタン・件数表示）。中核・描画・補助に分割されている |
| `bulk-relist.ts` | 一括再出品バー固有の組み立て |
| `checkbox-manager.ts` | 商品選択用チェックボックスの生成とイベント処理 |
| `list.ts` | 商品リスト要素の取得・走査 |
| `order-display.ts` / `order.ts` | 選択順序のビジュアル表示 |
| `notification.ts` | 処理結果・エラーの通知表示 |
| `list-load-error.ts` | 商品リストを読み込めなかったことを知らせるパネル（再試行ボタン付き） |
| `filter-bar.ts` | 出品中一覧のフィルターバー（いいね・コメント数の絞り込みトグル） |
| `description-panel.ts` | 編集ページの説明欄直下に出す「AIで説明文を作る」ボタンと生成結果のプレビューパネル |
| `ai-description-link.ts` | 一覧ページの各商品に、編集ページを開く導線リンクを追加する |

## 処理フロー

### 初期化フロー（一覧ページ / dist/content.js）

```
content/index.ts
  ├── appInitializer.initialize()
  │     ├── applyUserSettings()（chrome.storage.local から設定を読み、デバッグモードを反映）
  │     ├── observerManager.startObserving()（DOM 監視開始。UI の初期描画もここが担う）
  │     └── detectCurrentPage()（ページタイプの記録）
  └── chrome.runtime.onMessage（ポップアップからのデバッグモード切り替えを受信）
```

**`DOMContentLoaded` を初期化の起点にしない。** `manifest.json` の `content_scripts` は `"run_at": "document_idle"` で注入されるため、その時点で `document.readyState` は既に `interactive` / `complete` であり、`DOMContentLoaded` は二度と発火しない。SPA 内のクライアントサイド遷移でも再発火しない。初期描画は `observerManager.startObserving()` が担い、要素の遅延読み込みにも追従する。

### 下書き出品フロー

1. ユーザーが下書きページで商品にチェックを入れる
2. `selection-manager` が選択状態と順序を管理
3. 「選択した下書きを順番に出品」ボタンをクリック
4. `publisher.ts` の `publishAllDrafts()` が選択商品を順番に出品
5. 完了後、成功通知を表示

### 再出品フロー

1. ユーザーが出品中ページで商品にチェックを入れる
2. `selection-manager` が選択状態と順序を管理
3. 「選択した商品を再出品」ボタンをクリック
4. `relist-manager.ts` の `executeRelist()` が、各商品について
   元商品のスナップショットを取得・キューへ登録してから再出品ボタンをクリック
5. 完了後、成功通知を表示

### AI 説明文生成フロー（編集・出品ページ / dist/edit.js）

```
content/edit-entry.ts
  ├── renderWhenReady()（説明欄が描画されるまで待ってパネルを挿入。打ち切ったら warn を残す）
  └── MutationObserver（SPA 遷移・フォーム再描画のあとでもパネルを復活させる）
        └── isSellFormPage() で表示可否を都度判定する
```

1. ユーザーが編集ページで「AIで説明文を作る」をクリック
2. `edit-form.ts` の `readDescriptionContext()` がフォームから商品情報と画像を読み取る
3. `description-generator.ts` が `chrome.runtime.sendMessage` で background に生成を依頼
4. background が Claude API を呼び、生成文または日本語のエラーメッセージを返す
5. 結果を**プレビュー欄に表示する。説明欄には直接書き込まない**
6. ユーザーが内容を確認・編集して「反映する」を押したときだけ、`applyDescription()` が説明欄へ書き戻す

**生成結果を自動で反映しない。** 生成文は事実誤りを含みうるため、人が目を通さないまま出品内容が書き換わる経路を作らない。

**説明欄への書き戻しは `setReactInputValue()` を通す。** 説明欄は React 制御下にあり、`el.value = x` では React の state が更新されず、メルカリ側の文字数カウンタや保存対象の値に反映されない。ネイティブの value セッターを呼んだうえで `input` / `change` を発火させる必要がある。

**API キーは content script に渡さない。** 生成処理をすべて background 経由にしているのはこのため。

### ページ種別と注入されるスクリプト

| URL | ページ種別 | 注入される content script |
|---|---|---|
| `/mypage/drafts*` | `DRAFTS` | `dist/content.js` |
| `/mypage/listings*` | `LISTINGS` | `dist/content.js` |
| `/sell/draft/{id}` | `EDIT_DRAFT` | `dist/edit.js` |
| `/sell/edit/{id}` | `EDIT_LISTING` | `dist/edit.js` |
| `/sell/create` | `SELL` | `dist/edit.js` |

`/sell*` にマッチする他のページ（`/sell` トップ、`/sell/drafts` 一覧など）にも `dist/edit.js` は注入されるが、`isSellFormPage()` が false になるため UI は出ない。
### 再出品後の自動保存フロー

再出品ボタンを押すと、コピー内容が入った出品フォームが別タブで開きます。
その内容が元商品と一致しているかを検証し、問題がなければ自動で保存します。

```
一覧ページ（LISTINGS）                     出品フォーム（SELL / 別タブ）
  relist-manager.executeRelist()
    ├── item-snapshot.captureItemSnapshot()
    │     └── /item/{id} の __NEXT_DATA__ から比較値を抽出
    ├── relist-queue.enqueueSnapshot()  ──►  chrome.storage.local
    └── 再出品ボタンをクリック  ─────────►  appInitializer.initialize()
                                              └── auto-save-controller.runAutoSaveOnSellPage()
                                                    ├── relist-queue.dequeueSnapshot()
                                                    ├── sell-form.waitForSellFormReady()
                                                    ├── sell-form.readSellForm()
                                                    ├── relist-verifier.compareValues()
                                                    ├── relist-verifier.applyFixes()（差分があれば）
                                                    └── sell-form.findSubmitButton().click()
```

比較対象は商品名・販売価格・商品の説明・カテゴリー・商品の状態・
配送料の負担・配送の方法・発送元の地域・発送までの日数・画像枚数です。

判定は次の 3 通りです。

- 差分なし → そのまま保存
- 差分あり・自動修正可能 → 元商品の値へ書き戻し、再読み取りで解消を確認してから保存
- 自動修正できない差分が残る → **保存せずに中断**し、内容を通知して手動確認へ引き継ぐ

自動修正できないのは次のケースです。

| ケース | 理由 |
|-------|------|
| 画像枚数の不一致 | 画像ファイルの実体を持たないため再アップロードできない |
| 入力欄を解決できない | 値を確認できない以上「問題なし」と判断できない |
| 選択肢に存在しない値 | 元商品の値をフォームへ設定できない |
| 元商品の情報を取得できなかった | 比較の基準がないため |

#### 出品フォームのセレクタ

出品フォームの入力欄は `constants.ts` の `SELL_FORM_FIELDS` で定義します。
メルカリの DOM は予告なく変わるため、各フィールドは複数の候補セレクタを持ち、
すべて外れた場合は画面上のラベル文言（「商品名」「販売価格」など）から
入力欄を辿るフォールバックが働きます。

値の書き込みは `HTMLInputElement.prototype` の setter 経由で行い、
`input` / `change` / `blur` を発火させます。React 管理下の入力欄で
`value` への直接代入が内部状態に反映されない問題を避けるためです。

## 設計原則

- **レイヤー分離**: インフラ層・ロジック層・UI 層を明確に分離し、上位層が下位層に依存する一方向の依存関係を保つ
- **シングルトンパターン**: 主要なマネージャークラスはファイル末尾でシングルトンインスタンスとしてエクスポートする
- **定数の一元管理**: DOM セレクタ・設定値は必ず `constants.ts` に追加する
- **イベント駆動**: MutationObserver による DOM 変更の監視とイベントベースの処理
- **型安全**: TypeScript strict モード、`any` 型の使用禁止
- **secret は background に閉じる**: Claude API キーを読むのは `src/background/` と options page だけ。content script のコードには渡さない
