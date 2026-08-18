# CLAUDE.md（packages/rakuma）

ラクマ（fril.jp）の出品作業を一括化する Chrome 拡張機能（Manifest V3 / TypeScript）。拡張名は **Fleamarket Tools for Rakuma**。`/sell` の一括下書き保存、`/draft` の下書き一括出品、`/sell`・`/draft` の一括削除、出品中商品の説明文の一括置換を行う。

**共通規約（ブランチ運用・コミットメッセージ・scope・コミット日時・検証コマンド・共通のコーディングルール）はルートの [CLAUDE.md](../../CLAUDE.md) にある。** このファイルには**このパッケージに固有のこと**だけを書く。このファイル内の相対パスは `packages/rakuma/` 起点。

## このパッケージの最重要方針

ルートの「最重要方針」2 つを、このサイト向けに具体化したもの。実装・レビュー・設計判断が競合したときは他のすべてより優先する。

### 1. 取り消せない操作を誤って実行しない

一括出品・一括削除は取り消せない実操作で、対象を間違えると実際の商品が世に出る／消える。次の 7 つは安全装置なので、**弱める変更をしない**。

- **自動クリックは、Background への `CHECK_AUTO_TAB` 問い合わせで `isAutoTab: true` が返ったタブでのみ実行する**（[src/content/form/index.ts](src/content/form/index.ts)）。ユーザーが手動で開いた出品ページでは何もしない。この確認を外すと、ユーザーが自分で開いた下書きが勝手に出品される。
- **`/sell` の一括処理は出品せず「下書きに保存する」で止める。** 再出品は「`/sell` で下書きに溜める → 内容を確認 → `/draft` で公開する」の 2 段構え。この分離が誤出品に対する最大の防御なので、`/sell` 側から直接出品する経路を作らない。
- **保存前の差分チェックを弱めない**（[src/content/form/diff.ts](src/content/form/diff.ts)）。再出品元の商品ページと突き合わせ、**内容が欠けていれば保存しない**。フリマアシストの画像アップロードは遅れるため、待たずに保存すると画像の欠けた下書きができる。
- **一括削除の確認を外さない。** 開始前に拡張側で件数と処理順を出して確認ダイアログ（[ui/confirm-dialog.ts](src/content/list/ui/confirm-dialog.ts)。初期フォーカスはキャンセル、`<dialog>` が使えなければ `window.confirm`）を取る（[src/content/list/bulk-bar-handlers.ts](src/content/list/bulk-bar-handlers.ts)）。削除リンクは `data-method="delete"` と**ラベルが「削除」であること**の両方を確認してからクリックし、`data-confirm` は**クリック直前だけ外して直後に必ず戻す**（[src/content/list/logic/delete-clicker.ts](src/content/list/logic/delete-clicker.ts)）。
- **一括再出品・一括出品も開始前に件数と処理順を出して確認を取る**（2026-08-17 `7d935b8`）。承諾前に処理が始まる経路を作らない。
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

### セルフレビューで見る固有の観点

ルートの `self-review` スキルの観点 1〜3 で、このパッケージの変更に対して照らすもの。

- 上記 7 つの安全装置が外れていないか。とくに `CHECK_AUTO_TAB` を通らない自動クリック経路、`/sell` から直接出品する経路、`diff.ts` を素通りする経路、承諾前に処理が始まる経路、`data-confirm` の戻し忘れ（早期 return や例外経路）。
- ユーザーが選んでいない商品が `QueueItem[]` に入りうるか。ページ送りで表示外になった商品の選択が残らないか（`SelectionManager.retain`）。
- **Service Worker の破棄に耐えるか。** 新しく増やしたキューの状態が `chrome.storage.session` に保存されるか、イベントハンドラの先頭で復元しているか。**`setTimeout` を使っていないか**（SW の破棄で消える。`chrome.alarms` を使う。ただし 30 秒未満の遅延はクランプされる）。
- ループが途中で失敗したとき、何件目まで処理したかが `currentIndex` / `failed` で分かるか。`phase` が例外経路も含めて必ず戻るか。ウォッチドッグ（`ALARM_WATCHDOG`）が張りっぱなし・消しっぱなしになっていないか。
- `notifyProgress` の `.catch(() => {})` のように**意図的に握り潰す箇所は、その理由がコメントで読めるか**。
- フォーム側の状態が `<html data-rbl-form="...">` に出るようになっているか（`checking` / `auto` / `manual` の区別が保たれているか）。
- **ページ遷移をまたぐ前提が崩れていないか。** 削除と下書き保存はページ遷移が起きるので、Content Script は途中で破棄される。遷移後に動くことを前提にした処理を Content Script 側に置いていないか。
- `CheckAutoTabResponse` を `undefined` になりうる前提で扱っているか。`item.fril.jp` の HTML を未検証で信じていないか。
- **README との食い違いを作っていないか。** 設計判断の一次資料は README なので、挙動を変えたら該当する節も直す。

## 着手前に読むもの

**実装判断の前に、該当する一次資料とコードを直接読む。** このファイルには要約を置かない。

**[README.md](README.md) が設計判断の一次資料。** なぜその作りになっているか（完了判定を Background に置く理由、入力完了の待ち方、差分チェックの向き、削除がページ遷移をまたぐ理由、実機で確認済みの DOM 前提）はすべてそこにある。**コードを変える前に該当する節を読む。**

| 領域 | 一次資料 |
| --- | --- |
| 機能概要・設計判断・実機で確認済みの DOM 前提 | [README.md](README.md)（※下記の既知の状態を読むこと） |
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
| 説明文の置換の処理記録（`chrome.storage.local`） | [src/common/replace-store.ts](src/common/replace-store.ts)（骨格は `@fleamarket/core/replace-store`。キー `rakuma-bulk-lister:replace-records`・失敗時の warn・確定版の文字数とハッシュの検証・処理済み判定で記録の辻褄まで確かめる条件はここ） |
| 文字数 + FNV-1a（8 桁 16 進表記）による本文の照合 | [src/common/text-fingerprint.ts](src/common/text-fingerprint.ts)（ハッシュの計算と改行正規化は `@fleamarket/core/text-hash`。16 進表記はここで付ける） |
| フォーム内容の読み取り・入力完了の待機 | [src/content/form/form-state.ts](src/content/form/form-state.ts) |
| 再出品元との差分チェック | [src/content/form/diff.ts](src/content/form/diff.ts) |
| フォームのボタン特定 | [src/content/form/button-finder.ts](src/content/form/button-finder.ts) |
| 出品フォームのボタンラベル・設定値 | [src/content/form/constants.ts](src/content/form/constants.ts) |
| ポーリング待機ユーティリティ | [src/content/form/wait.ts](src/content/form/wait.ts) |
| 一定時間の待機・ポーリング（一覧・フォーム共通） | [src/content/wait.ts](src/content/wait.ts)（`@fleamarket/core/wait` の再エクスポート） |
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
| 一括操作バーのボタン処理・一括削除／再出品／出品の確認 | [src/content/list/bulk-bar-handlers.ts](src/content/list/bulk-bar-handlers.ts) |
| 一覧の描画に追従したチェックボックスの付与 | [src/content/list/item-sync.ts](src/content/list/item-sync.ts) |
| Background から届くメッセージの処理（クリック指示・進捗の反映） | [src/content/list/message-handlers.ts](src/content/list/message-handlers.ts) |
| 一覧ページ側のキュー実行中状態（`queueRunning`。チェックボックスの有効/無効も同時に切り替える） | [src/content/list/run-state.ts](src/content/list/run-state.ts) |
| 一括操作ドック・チェックボックス・トースト | [ui/bulk-bar.ts](src/content/list/ui/bulk-bar.ts), [ui/checkbox-manager.ts](src/content/list/ui/checkbox-manager.ts), [ui/notification.ts](src/content/list/ui/notification.ts)（トーストの組み立てと表示時間の制御は `@fleamarket/core/toast`。種別ごとの表示時間・`--rbl-toast-duration`・ホバー後は残り時間から再開する方式はここ） |
| 確認ダイアログ（削除・置換・再出品・出品の前） | [ui/confirm-dialog.ts](src/content/list/ui/confirm-dialog.ts)（組み立てと答えの待ち方は `@fleamarket/core/confirm-dialog`。id・接頭辞 `rbl`・上限 `CONFIRM_MAX_ITEMS`・番号付き行頭・見出し「処理する順番」・クリックで即時確定する方式はここ） |
| 注入 UI のスタイル・共通部品 | [ui/theme.ts](src/content/list/ui/theme.ts)（CSS 本文はここ。`<style>` の注入は `@fleamarket/core/style`）, [ui/components.ts](src/content/list/ui/components.ts)（組み立ては `@fleamarket/core/components`。接頭辞 `rbl`、補足行、`renderProgress` の名前はここ） |
| デザイントークン・ライト/ダークの設定・アイコン（注入 UI と popup で共有） | [src/common/theme.ts](src/common/theme.ts), [src/common/icons.ts](src/common/icons.ts)（SVG の組み立てと共通アイコンは `@fleamarket/core/icons`。固有アイコンと `rbl-icon` クラスはここ） |
| ポップアップ（キュー状態の表示・テーマ切替） | [popup.html](popup.html), [src/popup/index.ts](src/popup/index.ts) |
| ログ出力 | [src/common/logger.ts](src/common/logger.ts)（レベル制御は `@fleamarket/core/logger`。接頭辞と出力形式はここ） |
| ビルド構成（エントリ 4 つ） | [webpack.config.js](webpack.config.js), [tsconfig.json](tsconfig.json)（ルートの `tsconfig.base.json` を extends。`types: ["chrome"]` はここで指定） |
| lint / format / 改行コード | ルートの [eslint.config.js](../../eslint.config.js), [.prettierrc](../../.prettierrc), [.gitattributes](../../.gitattributes) |

### 既知の状態（2026-10-05 時点）

**文書とコードが食い違ったらコードが正。** 古い記述を見つけたらその場で直す。

- **README.md の「コマンド」「インストール（開発版）」は単独リポジトリ時代の記述**（2026-10-05 のモノレポ化で古くなった）。`npm install` / `npm run build` はリポジトリルートで実行し、Chrome に読み込むディレクトリは「リポジトリルート」ではなく **`packages/rakuma`**。正しい手順はルートの [README.md](../../README.md) と `local-setup` スキル。README の設計判断・DOM 前提の節は現状どおり。
- **一括削除はコードが入っているだけで、実行しての動作確認がされていない**（README の「未検証」）。DOM の構造と `data-confirm` の挙動までは実機確認済み。**取り消せない操作なので、変更するなら実機確認までを 1 単位にする。**
- **説明文の一括置換（replace モード）は 123 件の実運用で確認済み**（2026-09-28。README の「未検証」の節にある）。最初の 3 件で完了処理の再入（次の商品を飛ばす）を見つけて直し、修正後に 120/120 成功。
- **ライト/ダークテーマへの UI 再設計、一括再出品・出品の事前確認、popup のキュー状態表示とテーマ切替**は 2026-08-17 の 3 コミット（`ef36d0a` / `7d935b8` / `ef61ca1`）で `develop` に入った。モノレポ化の直前に取り込まれたので、README の該当節が追いついているかは触るときに確かめる。
- **`manifest.json` の content-form の `matches` に `https://fril.jp/item/*/edit*` がある**（2026-09-28）。`/item/{hash}/edit` は [form-page.ts](src/common/form-page.ts) で `replace` に判定される。`/item/new` は従来どおり `relist`。
- **`manifest.json` の `https://fril.jp/draft*` は `/drafts/{hash}/edit`（出品フォーム）にもマッチする。** 一覧用 content script がフォームで動かないのは、[page-detector.ts](src/content/list/infra/page-detector.ts) が `/drafts` を `UNKNOWN` に落としているからで、manifest 側では除外していない。**片方だけ変えない。**
- **キューの状態は `chrome.storage.session` に保存され、Service Worker の破棄に耐える。** 変更のたびに書き戻し、各イベントハンドラの先頭で復元する。タイマーは `setTimeout` ではなく `chrome.alarms`（SW の破棄で消えるため）。**`chrome.alarms` は 30 秒未満の遅延がクランプされる**ので、短い待機には使えない。

## コーディングルール（このパッケージ固有）

共通ルール（`any` 禁止・戻り値型・クォート・未使用 import・シングルトン）はルートの CLAUDE.md。加えて:

- 一覧ページの DOM セレクタ・クラス名・ID・設定値は必ず [src/content/list/infra/constants.ts](src/content/list/infra/constants.ts) に追加する
- 出品フォームページのボタンラベル・タイムアウト等の設定値は必ず [src/content/form/constants.ts](src/content/form/constants.ts) に追加する。**ラベルはボタン特定に使うテキスト完全一致の値なので、実機を確認せずに変えない**
- Background ⇔ Content のやり取りは必ず [src/common/messages.ts](src/common/messages.ts) の型を経由する。新しいメッセージはまずここに型を足す
- 送信は [src/common/send-message.ts](src/common/send-message.ts) の `sendToTab` / `sendToRuntime` を使う。`chrome.tabs.sendMessage` / `chrome.runtime.sendMessage` を呼び出し側から直接呼ばない（戻り値が `any` のため、呼び出し側ごとに型アサーションを書くと応答型の食い違いを検査できない）。応答型は `messages.ts` の `MessageResponses` に書く
- 出品フォームページの URL 判定は [src/common/form-page.ts](src/common/form-page.ts) に集約する（Background と Content の双方から使うため、片側に直書きしない）
- モードによって変わる振る舞いを増やすときは、`mode === 'delete'` のような個別の比較を書かずに [src/common/queue-mode-traits.ts](src/common/queue-mode-traits.ts) の `QUEUE_MODE_TRAITS` へ性質を足す（`Record<QueueMode, QueueModeTraits>` なので、モードを足したときに記入漏れがコンパイルエラーになる）
- キューの状態を増やしたら `chrome.storage.session` に保存される形にする（Service Worker が破棄されても続きから処理できること）
- ログは [src/common/logger.ts](src/common/logger.ts) の `log` / `warn` / `debug` を使う。接頭辞 `[Fleamarket Tools for Rakuma]` を別引数で渡す出力形式と、`debug` を `console.log` で出す点はこのファイルで決めている（レベル制御の骨格だけ `@fleamarket/core/logger`）。**この出力形式を変えない**
- 拡張の外から挙動を切り分けられるようにする。出品フォーム側の状態は `<html data-rbl-form="checking|auto|manual">` に出す（console ログは拡張の外からは読めない）

## 落とし穴（このパッケージ固有）

共通の落とし穴（改行コード・`--workspaces` の挙動・`manifest.json` の反映）はルートの CLAUDE.md。加えて:

- **`npm run format:check` はこのパッケージでは通るのが正常。** 落ちたら自分の変更のせい。触ったファイルだけ `npx prettier --write <パス>` で直す。
- **README.md は prettier の管理外。** `format` の対象は `src/**` だけ。README に `npx prettier --write` をかけると表が全行書き換わり、コードスパン内に `|` を含むセル（セレクタの記述）が列として分割されて壊れる（2026-09-21 に実際に発生）。README を編集しても prettier をかけない。
- **実機確認はメルカリ側より重い。** 商品間に 60〜75 秒の待機が入るため、数件の確認でも数分かかる。「止まって見えても待つ」が正常。
