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
| `ext-storage.ts` | `chrome.storage.local` への読み書き（`ExtStorageKey` enum でキー管理）。ポップアップ・content script・background・options page が同じ領域を共有する。再出品キューと自動保存設定もここに入る |
| `messaging.ts` | content script ⇔ background のメッセージ型と `MESSAGE_ACTION` 定数 |
| `dom.ts` | 例外安全な DOM 操作ラッパー。React 制御下の input へ値を入れる `setReactInputValue` もここ |
| `utils.ts` | 非同期待機・乱数などの汎用関数。条件が満たされるまでポーリングする `waitFor` もここ |

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
| `sell-form.ts` | 出品フォームのアダプタ（入力欄の解決・値の読み書き）。読み取りは Document を受け取るので iframe にも使える |
| `sell-form-navigator.ts` | カテゴリー・商品の状態・配送の方法を選択ページへ遷移して選び直す |
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
| `/sell/create` | `SELL` | `dist/content.js`（自動保存）+ `dist/edit.js` |

`/sell*` にマッチする他のページ（`/sell` トップ、`/sell/drafts` 一覧など）にも `dist/edit.js` は注入されるが、`isSellFormPage()` が false になるため UI は出ない。

**`dist/content.js` のマッチは `/sell/create*` に絞っている。** 一覧向けの DOM 監視を編集ページにまで持ち込まないため。`all_frames` は既定の false なので、スナップショット用の隠し iframe には content script は注入されない。
### 再出品後の自動下書き保存フロー

再出品ボタンを押すと、コピー内容が入った出品フォームが別タブで開きます。
その内容が元商品と一致しているかを検証し、問題がなければ**下書きに保存**します。

**押すのは `[data-testid="save-draft"]`（下書きに保存する）だけ。**
「出品する」（`[data-testid="list-item-button"]`）は押さない。流し込みが途中の内容でも
世に出てしまい取り消せないため、公開は下書き一覧からの一括出品で人が見てから行う。
下書き保存ボタンが見つからないときも公開ボタンへフォールバックせず、中断する。

```
一覧ページ（LISTINGS）                     出品フォーム（SELL / 別タブ）
  relist-manager.executeRelist()
    ├── item-snapshot.captureItemSnapshot()
    │     └── 隠し iframe で /sell/edit/{itemId} を開き sell-form.readSellForm()
    ├── relist-queue.enqueueSnapshot()  ──►  chrome.storage.local
    └── 再出品ボタンをクリック  ─────────►  appInitializer.initialize()
                                              └── auto-save-controller.runAutoSaveOnSellPage()
                                                    ├── sell-form.waitForSellFormReady()
                                                    ├── relist-queue.dequeueSnapshot()（FIFO）
                                                    ├── 商品名の照合（不一致なら中断）
                                                    ├── sell-form.readSellForm()
                                                    ├── relist-verifier.compareValues()
                                                    ├── relist-verifier.applyFixes()（差分があれば）
                                                    └── sell-form.findSaveDraftButton().click()
```

比較対象は商品名・販売価格・商品の説明・カテゴリー・商品の状態・配送料の負担・
配送の方法・発送元の地域・発送までの日数・商品の特徴・画像枚数です。

判定は次の 3 通りです。

- 差分なし → そのまま下書き保存
- 差分あり・自動修正可能 → 元商品の値へ書き戻し、再読み取りで解消を確認してから下書き保存
- 自動修正できない差分が残る → **保存せずに中断**し、内容を通知して手動確認へ引き継ぐ

自動修正できないのは次のケースです。

| ケース | 理由 |
|-------|------|
| 画像枚数の不一致 | 画像ファイルの実体を持たないため再アップロードできない |
| 入力欄・表示要素を解決できない | 値を確認できない以上「問題なし」と判断できない |
| 選択肢に存在しない値 | 元商品の値をフォームへ設定できない |
| 選択ページから戻れない | 遷移操作が途中で止まった状態で保存してはいけない |
| 元商品の情報を取得できなかった | 比較の基準がないため |

#### 比較の基準は「元商品の編集フォーム」

**商品ページの HTML から商品データは取り出せない。** メルカリは Next.js App Router (RSC) に
移行済みで `#__NEXT_DATA__` は存在せず、`/item/{id}` を fetch しても `loading-skeleton` しか
返らない（2026-09-17 実地確認）。

そのため `item-snapshot.ts` は、元商品の**編集フォーム** `/sell/edit/{itemId}` を同一オリジンの
隠し iframe で読み込み、再出品フォームと**同じ読み取りコード**で値を取る。フォーム対フォームなら
表現が一致するので、表示テキストと ID の変換表を持たずに済む。

- iframe は `display: none` にしない。**表示されていない要素の `innerText` は `textContent` と
  同じ扱いになり、カテゴリー階層や配送の方法の改行区切りが失われる**ため、画面外へ追い出して
  不可視にしている
- 描画完了はポーリングで待ち、上限（`CONFIG.SNAPSHOT_IFRAME_TIMEOUT_MS`）を超えたら
  `captured: false` で返す。読み終えたら成否によらず `finally` で破棄する
- **この iframe でフォームを保存することはない**（読み取り専用）

#### 取り違え防止

再出品ボタンが開く `/sell/create` には**クエリパラメータが付かず、URL から元商品を特定できない**
（2026-09-17 実地確認。再出品ボタン `#clone-item` はこのリポジトリでもメルカリ本体でもない
外部ツールが生成している）。そのためキューとの対応付けは投入順（FIFO）で行う。

順序がずれたときに**別商品の値で上書き保存する**事故を防ぐため、
`auto-save-controller` はキューから取り出したあと、**フォームの商品名とスナップショットの
商品名が一致することを確認してから**でなければ比較にも修正にも進まない。一致しなければ中断する。

#### 出品フォームのセレクタ

出品フォームの項目は `constants.ts` の `SELL_FORM_FIELDS` で定義する。
2026-09-17 にログイン状態で実地調査した DOM に基づく。

name 属性を持つ実コントロールは `name` `description` `price` `shippingPayer`
`shippingFromArea` `shippingDuration` `listingType` の 7 つだけで、
**カテゴリー・商品の状態・配送の方法は select ではなく「変更する」リンクで別ページへ遷移する**。
この 3 項目は表示テキストとして読み、直すときは遷移操作で選び直す。

| 項目 | 読み取り | 直し方 |
|---|---|---|
| 商品名 / 販売価格 / 商品の説明 | `input[name=...]` / `textarea[name="description"]` | 入力欄へ直接書き込む |
| 配送料の負担 / 発送元の地域 / 発送までの日数 | `select[name=...]` の値（ID 文字列） | select へ直接書き込む |
| カテゴリー | `[data-testid="sell-category"]` の innerText を ` > ` で連結 | `/sell/categories` で各階層の表示名を順にクリック。最深階層で自動的に戻る |
| 商品の状態 | `[data-testid="item-condition"] p` の 1 つ目 | `/sell/conditions` で表示名が一致する行をクリック。自動的に戻る |
| 配送の方法 | `[data-testid="shipping-method-link"]` の innerText 最終行 | `/sell/shipping_methods` でラジオを選び、**「更新する」ボタンを押して初めて戻る** |
| 商品の特徴 | `[data-testid="attribute-select"]` の各欄の「ラベル=選択値」 | 各 select を表示テキストで選び直す |
| 画像枚数 | `[data-testid="photo-thumbnail"] img` の個数 | 自動修正不可 |

**「商品の特徴」はカテゴリーごとに項目数も内容も変わる。** ブランド・シリーズ・サイズなどが
可変個の select として並ぶ（実測でポケモンカードのカテゴリーは 14 欄）。`ラベル=選択値` の組を
ラベル順に連結して 1 つの文字列として比較し、欄の並び順の違いを差分と誤認しないようにしている。
期待値に無い欄は「選択してください」へ戻すので、余分な値が残って差分が消えないことはない。

**欄には親子関係がある。** 「セット」は「シリーズ」を選んで初めて現れるなど、依存先の欄に値が
入るまで存在しない欄がある。書き込み前に一度だけ欄を集めると、親を設定した結果あとから現れる
子の欄を「フォームにありません」と誤報する（実測で親の設定から 43ms 後に判定していた）。
**欄が増えなくなるまで走査と書き込みを繰り返す**（`CONFIG.SELL_FORM_ATTRIBUTE_MAX_PASSES`）。

**再出品フォームには「商品の特徴」がコピーされてこない。** 外部ツールのクローンは商品名・価格・
説明・カテゴリー・配送設定は引き継ぐが、カテゴリー固有の属性は空のまま（2026-09-20 実測）。
この項目の比較と書き戻しが無いと、属性がすべて落ちた状態で「一致」と判定してしまう。

**画像と「商品の特徴」は商品名より遅れて描画される。** 再出品フォームの画像は外部ツールが
1 枚ずつアップロードし直すため枚数が時間をかけて増え、「商品の特徴」の欄はカテゴリーが
確定してから現れる。商品名が入った直後に読むと途中の状態を拾って差分と判定してしまうため、
読み取り前に**枚数・欄数が落ち着くまで待つ**（実測で prefill 全体に約 31 秒かかる）。

遷移はいずれも SPA 内遷移で document が維持され、フォームの入力値・画像も保持される。
遷移完了・復帰完了はポーリングで待ち、戻らない場合はタイムアウトして中断する。

**ラベル文言から入力欄を辿るフォールバックは持たない。** 実地検証で「配送の方法」の見出しから
近傍の `select[name="shippingPayer"]` を掴むことが確認されており、**別項目を上書きする事故**に
つながるため。セレクタが外れた項目は未解決として扱い、自動保存を中断する。

入力欄への書き込みは `common/dom.ts` の `setReactInputValue`（select はプロトタイプの setter）
を通し、`input` / `change` を発火させる。React 管理下の入力欄で `value` への直接代入が
内部状態に反映されない問題を避けるため。

下書き保存ボタンは `[data-testid="save-draft"]`。**自動処理が押すのはこれだけ。**
参考までに同じフォームの「出品する」は `[data-testid="list-item-button"]`、
編集フォームの確定ボタンは `[data-testid="edit-button"]` だが、どちらも押さない。

**クリックすると遷移して content script ごと破棄される。** 成否のログとトーストは
押す**前**に出す。押したあとに出しても読めない。

## 設計原則

- **レイヤー分離**: インフラ層・ロジック層・UI 層を明確に分離し、上位層が下位層に依存する一方向の依存関係を保つ
- **シングルトンパターン**: 主要なマネージャークラスはファイル末尾でシングルトンインスタンスとしてエクスポートする
- **定数の一元管理**: DOM セレクタ・設定値は必ず `constants.ts` に追加する
- **イベント駆動**: MutationObserver による DOM 変更の監視とイベントベースの処理
- **型安全**: TypeScript strict モード、`any` 型の使用禁止
- **secret は background に閉じる**: Claude API キーを読むのは `src/background/` と options page だけ。content script のコードには渡さない
