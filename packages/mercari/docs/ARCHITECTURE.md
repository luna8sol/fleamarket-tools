# アーキテクチャ設計ドキュメント

## 概要

この拡張機能は Chrome の Manifest V3 アーキテクチャに基づいて構築されています。

- **Content Script**: メルカリサイト上で実行される主要なコード。エントリーポイントは 2 つある
  - `dist/content.js` … 一覧ページ（`jp.mercari.com/mypage/drafts`・`/mypage/listings`）。一括出品・一括再出品
  - `dist/edit.js` … 出品フォームのあるページ（`jp.mercari.com/sell*`）。AI 説明文生成
- **Background Script**: service worker（`dist/background.js`）。content script からの依頼を受けて Claude API を呼ぶ
- **Popup**: ツールバーアイコンから開くポップアップ画面（再出品後の自動下書き保存・デバッグモードの切り替えと、設定画面への導線）
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
├── extension-pages.css   # popup.html / options.html の共通スタイル（トークンは content 側の ui/theme.ts と同じ値）
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
| `dom.ts` | 例外安全な DOM 操作ラッパー。React 制御下の input へ値を入れる `setReactInputValue` もここ（隠し iframe 内の要素にも使える） |
| `utils.ts` | 非同期待機・乱数などの汎用関数。条件が満たされるまでポーリングする `waitFor`、本文の照合に使う `fnv1a32` もここ |

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
| `description-replace-store.ts` | 説明文の一括置換の処理記録（商品IDごとの最新結果）の読み書き。中断・再開時に適用済みを外す |
| `logger.ts` | デバッグ用ロガー（ログレベル制御あり） |
| `debounce.ts` | 連続操作の制御 |
| `error-handler.ts` | エラー処理 |

### ロジック層（src/content/logic/）

拡張機能のコアロジックを実装します。

| ファイル | 役割 |
|---------|------|
| `app-initializer.ts` | アプリ初期化・各層の統合・ページタイプに応じたセットアップ |
| `observer-manager.ts` | MutationObserver による DOM 変更の監視と処理。UI の初期描画もここが担う。リストが現れるまでは `document.body` を監視して待ち、`CONFIG.LIST_WAIT_TIMEOUT_MS` を過ぎたら `list-load-error.ts` で知らせる |
| `selection-manager.ts` | 選択商品の追加・削除・順序管理（**永続化はしない。メモリ上のみ**。挿入順の Map による保持は `@fleamarket/core/selection`、連番と debug ログはここ） |
| `publisher.ts` | 下書きの自動出品処理 |
| `relist-manager.ts` | 出品中商品の再出品処理（クリック前に元商品スナップショットを取得） |
| `common-processor.ts` | 出品・再出品に共通する逐次処理。件数・状態・待機の残り秒数を `BulkProgress` で通知する |
| `edit-form.ts` | 出品・編集フォームの読み書き（商品名・カテゴリ・状態・属性・画像の取得と、説明欄への書き戻し） |
| `description-generator.ts` | background へ説明文の生成を依頼する。例外は投げず、必ず成否を表す結果型で返す |
| `filter-manager.ts` | 出品中一覧のいいね・コメント数によるフィルター。カウントを読めないときは適用せず解除する |
| `item-snapshot.ts` | 元商品の編集フォームを隠し iframe で開き、比較の基準値を読み取る |
| `sell-form.ts` | 出品フォームのアダプタ（入力欄の解決・値の読み書き）。読み取りは Document を受け取るので iframe にも使える |
| `sell-form-navigator.ts` | カテゴリー・商品の状態・配送の方法を選択ページへ遷移して選び直す |
| `tab-closer.ts` | 下書き保存後の再出品タブを background に閉じてもらう |
| `hidden-frame.ts` | 同一オリジンの隠し iframe を開く共通処理。スナップショット取得・削除・説明文の一括置換が使う。iframe 内のページを「表示中」として扱わせる `forceDocumentVisible` もここ |
| `delete-manager.ts` | 出品中商品の一括削除の制御 |
| `item-deleter.ts` | 編集ページを隠し iframe で開いて1件削除する |
| `description-replace-data.ts` | 説明文の一括置換の入力 JSON（確定版・原本）の読み込みと、処理対象・適用済み・対象外への振り分け（骨格は `@fleamarket/core/replace-plan`。商品IDの正規化・ハッシュ表記・上限・対象の形を注入） |
| `description-replacer.ts` | 編集ページを隠し iframe で開き、説明欄だけを確定版へ書き換えて「変更する」を押す 1 件処理。保存前に 4 段の照合を通す |
| `description-replace-manager.ts` | 説明文の一括置換の全体制御（逐次処理・待機・中断・記録・結果の出力） |
| `relist-verifier.ts` | 元商品と出品フォームの比較・差分の自動修正 |
| `auto-save-controller.ts` | 再出品タブでの自動保存の制御 |
| `value-normalizer.ts` | 比較用の値の正規化（改行・全角数字・桁区切りの表記ゆれを吸収） |
| `dom-utils.ts` | DOM 操作のユーティリティ関数 |

### UI 層（src/content/ui/）

ユーザーインターフェースを構築します。

| ファイル | 役割 |
|---------|------|
| `ui-manager.ts` / `index.ts` | UI 全体の管理・ページタイプに応じた切り替え |
| `bulk-bar-core.ts` / `bulk-bar-ui.ts` / `bulk-bar-utils.ts` | 一括操作バー（画面下中央に浮かぶドック。件数表示と、処理中の進捗バー）。中核・描画・補助に分割されている |
| `bulk-relist.ts` | ドックの組み立てと、出品・再出品・削除・選択の解除のボタン。実行前の確認（件数・間隔・待機の目安・処理順の商品名）もここ |
| `theme.ts` | 注入 UI のデザインシステム（色・影・角丸のトークンと部品のスタイル）。ライト / ダークは `prefers-color-scheme` で切り替える。1 度だけ `<style>` として注入する |
| `components.ts` | 共通部品（ボタンの装飾・処理中表示・進捗バー） |
| `icons.ts` | 線画アイコン。`innerHTML` を使わず `createElementNS` で組み立てる |
| `confirm-dialog.ts` | 取り消せない操作の前に出す確認ダイアログ（`<dialog>`）。既定のフォーカスはキャンセル。出せない環境では `window.confirm` に切り替える |
| `checkbox-manager.ts` | 商品選択用チェックボックスの生成とイベント処理。Shift を押しながら押すと、前に押した行からその行までをまとめて選ぶ（起点から押した行へ向かう順に積む。絞り込みで隠した行は対象外） |
| `row-gutter.ts` | 一覧の各行の左端に置くチェックボックス列。行（li）の左に余白を取って重ねる。**商品リンクの外に置き**、列の余白で起きたクリックは止める（押し損じで商品ページへ遷移させない） |
| `list.ts` | 商品リスト要素の取得・走査 |
| `order-display.ts` / `order.ts` | 選択順序のビジュアル表示 |
| `select-up-to.ts` | 下書き一覧の各行に出す「ここまで選択」ボタンと、先頭からその行までの一括選択 |
| `notification.ts` | 処理結果・エラーの通知表示（トースト。失敗・警告は `role="alert"`） |
| `list-load-error.ts` | 商品リストを読み込めなかったことを知らせるパネル（再試行ボタン付き） |
| `filter-bar.ts` | 出品中一覧のフィルターバー（いいね・コメント数の絞り込みトグル） |
| `description-panel.ts` | 編集ページの説明欄直下に出す「AIで説明文を作る」ボタンと生成結果のプレビューパネル |
| `description-replace-panel.ts` | 出品中一覧に出す「説明文を一括置換」ボタンと、ファイル読み込み・件数確認・開始・中断・結果出力のパネル |
| `ai-description-link.ts` | 一覧ページの各商品に、編集ページを開く導線リンクを追加する。商品名・価格の縦の列の末尾（商品リンクの内側）に置くので、クリックの伝播を止めて商品ページへの遷移を防ぐ |

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

### 一括削除フロー

出品中一覧で選んだ商品を、1件ずつ削除する。

```
一覧ページ（LISTINGS）
  createBulkDeleteButton()
    ├── confirmDeletion()      件数と商品名を確認ダイアログに出す。ここが唯一の人の止め時
    └── deleteManager.executeDelete()
          └── processItems()   1件ずつ・進捗表示つき
                └── item-deleter.deleteItem()
                      ├── 隠し iframe で /sell/edit/{itemId} を開く
                      ├── 商品名を一覧の値と照合（違えば削除しない）
                      ├── [data-testid="delete-button"] をクリック
                      ├── [data-testid="dialog-action-button"]（「削除する」）をクリック
                      └── 編集ページから離れたことを確認して成功とみなす
```

**フリマアシストの削除ボタンは使わない。** あちらの確認はブラウザ標準の `confirm()` で、
別の実行ワールドから呼ばれるため**こちらからは応答できない**（2026-09-21 実地確認）。
メルカリ自身の削除は React のモーダルなので操作できる。

**確定ボタンは data-testid だけで決めない。** 表示テキストが「削除する」であることも確認してから押す。
ダイアログには「キャンセル」も並ぶため、取り違えると意図と逆の操作になる。

**照合できない相手は削除しない。** 一覧から商品名を読めない、編集ページの商品名と一致しない、
編集ページが開かない——いずれも失敗として記録し、次へ進む。1件の失敗で全体を止めると
「どこまで消えたか」が分からなくなる。

**削除後は一覧を読み直す。** 削除しても一覧の行は残り選択も解除されないため、
消えたはずの商品を選び直せてしまう。

### 説明文の一括置換フロー

出品中の商品の説明文を、あらかじめ用意した確定版の本文へ 1 件ずつ置き換えて保存する。
表記の統一など、多数の商品の説明欄だけを機械的に直したいときに使う。

```
一覧ページ（LISTINGS）
  createDescriptionReplaceButton()  →  パネルを開くだけ（保存には向かわない）
    ├── parseDescriptionEntries()    確定版 JSON と原本 JSON（どちらも [{ id, name, desc }]）を検証して読む
    ├── buildReplacePlan()           処理対象 / 記録上の適用済み / 対象外（原本なし・1000字超）に振り分ける
    ├── confirmStart()               件数と待機秒数を出して確認。ここが唯一の人の止め時
    └── descriptionReplaceManager.run()
          └── 1件ずつ・進捗表示つき・1秒ごとに中断要求を確認
                └── description-replacer.replaceItemDescription()
                      ├── 隠し iframe で /sell/edit/{itemId} を開く（表示状態を visible に固定）
                      ├── 商品名をデータと照合（違えばスキップ）
                      ├── 説明欄の現在値を読み、確定版なら「適用済み」、原本と違えばスキップ
                      ├── setReactInputValue() で確定版を書き込み、読み直して文字数とハッシュで照合
                      ├── 商品名が変わっていないことを確認
                      ├── 文言が「変更する」の [data-testid="edit-button"] をクリック
                      └── /item/{itemId} の [data-testid="description"] を innerText で読んで再照合
```

**確定版の JSON だけでは動かない。** 開いた時点の説明欄が**原本**と一致することを確認してから
書き換える。取得後に人が直した商品を、古い原本から作った確定版で上書きしないため。
一致しない商品はスキップとして記録し、あとから確認できるようにする。

**保存に向かう前に 4 段の照合を通す。** 商品名の一致（取り違え防止）、現在値と原本の一致、
書き込み後の値と確定版の一致（React の状態に反映されたか）、書き込み後も商品名が
変わっていないこと（説明欄以外に触っていないか）。どれか 1 つでも通らなければ保存しない。

**照合は文字数と FNV-1a（32bit）ハッシュの両方で行う**（`common/utils.ts` の `fnv1a32`）。
文字数だけでは置換の取りこぼしを見分けられない。

**押すのは「変更する」だけ。** `[data-testid="delete-button"]`（この商品を削除する）には一切触れない。
確定ボタンも data-testid だけで決めず、文言が「変更する」であることを確認してから押す。

**保存後は商品ページで再照合する。** 保存に成功すると iframe 内で `/item/{itemId}` へ遷移する。
そこに表示された本文を `innerText` で読み（行頭の全角スペースが保持される。`textContent` や
テキスト抽出系の API は半角化するので使わない）、確定版と一致して初めて成功とする。
一致しない・確認できないときは「未確認」として記録する（保存自体は済んでいる可能性がある）。

**商品ページの本文は改行が CRLF で返る**（2026-09-22 実地確認。手作業で保存した商品も
未変更の商品も同じ）。`textarea.value` は LF に正規化されるが `innerText` はそのまま `
` を
返すため、そのまま比べると行数ぶん文字数が増えて「未確認」になる。照合の前に改行コードだけ
LF へ揃える。改行以外の文字は一切変えない。

**結果は 5 種類。** 成功（applied）/ 適用済み（already）/ スキップ（skipped）/ 失敗（failed）/
未確認（unverified）。商品IDごとの最新結果を `chrome.storage.local` に持ち、次の実行では
成功と適用済みを対象から外す。**ただし記録の確定版と今回の確定版が同じ本文のときだけ**
（文字数とハッシュで比べる）。確定版を改訂して 2 回目を流すときに、商品IDだけで除外すると
改訂分が 1 件も適用されないため。**記録が無くても二重に保存されることはない**——開いた時点の
本文が確定版なら「適用済み」、原本でも確定版でもなければスキップになる。

**説明欄や確定ボタンが見つからないときは残りを開かずに止める（halted）。** その商品固有の
事情ではなくメルカリ側の変更を疑うべき状況なので、1 件ずつ失敗を積み上げない。
編集ページが開けない・照合が通らないといった商品固有の失敗は記録して次へ進む。

**iframe 内のページには表示状態の固定が要る。** メルカリは `document.hidden` が true だと
データ取得を保留する。親タブが裏に回ると iframe 内のページも非表示扱いになりスケルトンの
まま止まるため、`forceDocumentVisible` で iframe の Document の `hidden` / `visibilityState` を
上書きし `visibilitychange` を発火させる。ページ遷移で Document が差し替わるたびに適用し直す。

1 件ごとの待機は基準秒数（既定 `CONFIG.DESCRIPTION_REPLACE_WAIT_BASE_MS`、パネルから変更可）に
ランダム分（`CONFIG.DESCRIPTION_REPLACE_WAIT_RANDOM_MS`）を足す。中断はこの待機中でも 1 秒以内に
効く。処理中の 1 件は、確定ボタンを押す前なら保存せずに打ち切り、押したあとなら照合まで終える。

### 一括処理の進捗表示

一括出品・一括再出品は1件あたり75〜90秒の待機を挟むため、全体では数十分かかる。
表示が止まったままだと「固まった」のか「待っている」のか区別できず、
途中でページを離れるなどの誤操作につながる。

`processItems()` は進捗を `BulkProgress` で通知し、一括操作バー（ドック）の2段目に
文言と進捗バーで表示する。処理中の1件はまだ終わっていないので、バーの割合には含めない。

| 状態 | 表示例 |
|---|---|
| 処理中 | `再出品中 3/10件 ポケモンカード …` |
| 待機中 | `再出品 3/10件 完了 — 次まで 47秒` |
| 完了 | `再出品完了: 9/10件（失敗 1件）` |

待機中の残り秒数は**1秒ごとに更新する**。数十秒のあいだ表示が動かないと、
止まっているのと見分けがつかないため。

**失敗が1件でもあれば完了時に通知も出す。** 進捗表示は処理終了後に消えるので、
それだけだと一部が失敗したことに気づけない。

**処理の途中はドックの操作ボタンをすべて押せなくする。** 再出品の最中に削除を始めるなど、
一括処理を重ねて走らせないため。

### 下書き出品フロー

1. ユーザーが下書きページで商品にチェックを入れる
2. `selection-manager` が選択状態と順序を管理
3. 「選択した商品をまとめて出品」ボタンをクリック
4. 確認ダイアログで件数・間隔・処理順の商品名を確かめて承諾する（キャンセル・Esc なら何もしない）
5. `publisher.ts` の `publishAllDrafts()` が選択商品を順番に出品
6. 完了後、成功通知を表示

### 再出品フロー

1. ユーザーが出品中ページで商品にチェックを入れる
2. `selection-manager` が選択状態と順序を管理
3. 「選択した商品を再出品」ボタンをクリック
4. 確認ダイアログで件数・間隔・処理順の商品名を確かめて承諾する
5. `relist-manager.ts` の `executeRelist()` が、各商品について
   元商品のスナップショットを取得・キューへ登録してから再出品ボタンをクリック
6. 完了後、成功通知を表示

**再出品の対象は `selection-manager` の選択順だけで決まり、li の表示状態は見ない。** そのため `filter-manager.ts` は商品を非表示にする時点でその選択を解除する（`deselectItem()`）。画面から消えた商品が選択に残ると、ユーザーに見えていない商品がそのまま再出品されるため。

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

下書き保存ボタンは `[data-testid="save-draft"]`。**再出品の自動保存が押すのはこれだけ。**
参考までに同じフォームの「出品する」は `[data-testid="list-item-button"]` で、これは押さない。
編集フォームの確定ボタン `[data-testid="edit-button"]`（変更する）も自動保存では押さない。
これを押すのは説明文の一括置換だけで、押す前の照合はそちらのフローに書いてある。

**クリックすると遷移して content script ごと破棄される。** 成否のログとトーストは
押す**前**に出す。押したあとに出しても読めない。

#### 保存後のタブを閉じる

下書き保存に成功すると、再出品タブは下書き一覧（`/mypage/drafts`）へ遷移して開いたまま残る。
一括再出品では件数ぶんタブが積み上がるため、拡張機能が保存したタブだけを閉じる。

**content script は自分のタブIDを知らず、`window.close()` もスクリプトが開いた
ウィンドウでしか確実に動かない。** そのためタブIDを知っている background に依頼する。

```
/sell/create                          background                    /mypage/drafts
  save() が保存ボタンを押す直前
    └── markThisTabForClose()  ──►  sender.tab.id を保存
        （押すと破棄されるので前に送る）
                                                                     初期化時
                                      印と一致したら ◄── closeThisTabIfMarked()
                                      chrome.tabs.remove()
```

**印のタブIDと送信元が一致したときだけ閉じる。** ユーザーが自分で開いた下書き一覧の
タブを巻き添えにしないため。保存に失敗して遷移しなかった場合に備え、印には有効期限
（`PENDING_TAB_CLOSE_TTL_MS`）を設けている。

## 設計原則

- **レイヤー分離**: インフラ層・ロジック層・UI 層を明確に分離し、上位層が下位層に依存する一方向の依存関係を保つ
- **シングルトンパターン**: 主要なマネージャークラスはファイル末尾でシングルトンインスタンスとしてエクスポートする
- **定数の一元管理**: DOM セレクタ・設定値は必ず `constants.ts` に追加する
- **見た目はトークンで決める**: 注入 UI の色・影・角丸は `ui/theme.ts` の CSS 変数だけを使い、部品ごとに色を直書きしない。ライト / ダークの両方を同じ変数で切り替えるため。文字を載せる塗りはコントラスト比 4.5:1 以上にする（メルカリの赤 `#FF333F` は白文字で 3.62 なので、塗りには一段濃い `--mdp-accent` を使う）
- **浮かせる UI は行の部品より上に置く**: 一覧の行に差し込む部品は商品リンクより前に出すため `z-index: 99999` を使う。ドック・トースト・パネルは `CONFIG.ZINDEX`（100000 以上）で、それより上に置く
- **イベント駆動**: MutationObserver による DOM 変更の監視とイベントベースの処理
- **型安全**: TypeScript strict モード、`any` 型の使用禁止
- **secret は background に閉じる**: Claude API キーを読むのは `src/background/` と options page だけ。content script のコードには渡さない
