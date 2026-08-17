# Rakuma Bulk Lister

ラクマ（fril.jp）の出品作業を一括化する Chrome 拡張機能。

- **一括下書き保存**: 「出品した商品」（`/sell`）で商品を選択し、フリマアシストの再出品ボタンを順にクリックして、複製された内容を**下書きとして保存**する
- **下書き一括出品**: 「下書きの商品」（`/draft`）で下書きを選択し、順に出品する

再出品はこの2段構えで行う。`/sell` で下書きに溜めてから、内容を確認して `/draft` で公開する。
`/sell` 側の操作では出品は発生しない。

## 前提

- 一括再出品には Chrome 拡張機能「フリマアシスト」のインストールが必要（`/sell` に注入される `#clone-item` ボタンを利用するため）
- 下書き一括出品はフリマアシスト不要

## 仕組み

```
① 一覧ページ (content-list.js)
   /sell:  チェックボックスで選択 → フリマアシストの再出品ボタンをクリック
   /draft: チェックボックスで選択 → Background が編集ページをタブで開く

② Background (background.js)
   処理キューの管理・タブの追跡・完了の検知・商品間の待機時間制御

③ 出品フォーム (content-form.js)
   Background に自動処理対象タブか確認したうえで、モード別にボタンを押す
   relist  /item/new           （フリマアシストが開く）→「下書きに保存する」
   publish /drafts/{hash}/edit （Background が開く）  →「確認する」→「出品する」
```

### 出品完了の判定は Background 側で行う

出品フォームのタブを `chrome.tabs.onUpdated` で監視し、**ボタンを押したあとに
出品フォームの URL から離れたこと**をもって完了とみなす。

Content Script 側で遷移を監視しない理由は、遷移先が別オリジン（`item.fril.jp`）に
なりうるため。その場合 Content Script は遷移前に破棄され、完了を見届けられない。

### Service Worker の破棄に耐える

MV3 の Service Worker はアイドル状態が続くと破棄される。本拡張は商品間に 60〜75 秒の待機を
挟むため、待機中の破棄は**必ず起きる**。そのためキューの状態は変更のたびに
`chrome.storage.session` へ書き戻し、すべてのイベントハンドラの先頭で復元してから処理する。

タイマー類も `setTimeout` ではなく `chrome.alarms` を使う（`setTimeout` は Service Worker の
破棄とともに消えるため）。

- `next-item` アラーム: 次の商品の処理開始
- `watchdog` アラーム: 1 商品の処理が 3 分以内に完了しない場合に打ち切る

### 一覧の描画をMutationObserverで待つ

商品リストはサーバーHTMLに含まれず、クライアント側で描画される。さらにページ送りは
URLを変えずにAJAXで一覧を差し替えるため、Content Script は再実行されない。
そのため `MutationObserver` で `body` 配下の変化を監視し、商品が現れるたびに
チェックボックスを付け直す（付与済みの商品はスキップするので何度呼んでも安全）。

一覧から消えた商品の選択は破棄する。ページ送りで表示外になった商品を選択したまま
開始してしまうのを防ぐため。

### その他の設計上の判断

- 出品フォームのボタンは Chakra UI のハッシュクラスのため**テキストで特定**する
- 手動で開いた出品ページでは何もしない（Background への確認で判別）
- ボタンを押す前にフォームへ値が入るのを待つ（フリマアシストの入力完了前に
  空のフォームを保存・送信しないため）
- 押すボタンはページのボタン名ではなくモードで決める。`/item/new` と
  `/drafts/{hash}/edit` はどちらも「下書きに保存する」と「確認する」を持つため
- 失敗時（バリデーションエラー・タイムアウト等）はタブを残してユーザーが確認できるようにする
- 一覧ページを再読込しても、実行中のキューの進捗は Background から取得して復元される

## 実機で確認済みのDOM前提（2026-09-14 時点）

Chrome の実ページに対して読み取り専用で検証した結果。

| 対象 | 結果 |
| --- | --- |
| `/sell`・`/draft` の商品リスト | **サーバーHTMLには `.deal-item` が0件**。完全にクライアント描画のため、`document_idle` の1回走査では拾えない。ページ送りも AJAX（`/ajax/item/selling?page=N`）で **URLが変わらない**ため Content Script は再実行されない |
| `/sell` の `div.deal-item` | 商品のみに一致。`.deal-item` は全60件だがうち30件はサイドバー（`information-pane`）の `a.deal-item` で、`div` 限定により正しく除外される |
| `/sell` の商品ID | 1商品に `a[href^="https://item.fril.jp/"]` が2つあるが同一IDを指す。IDは16進 |
| `/sell` の `a#clone-item` | 全商品に注入される。ただし**ページ読み込み後に非同期で注入される**（読み込み直後は一部のみ） |
| `/draft` の下書きリンク | 全件が `a.deal-item__button[href^="/drafts/"][href$="/edit"]` に一致し、`^/drafts/([0-9a-f]+)/edit$` にもマッチ |
| 商品名 `h4.deal-item__heading` | 各商品に1つ、いずれも空でない |
| 「確認する」ボタン | `/drafts/{hash}/edit` と `/item/new` の双方に1つだけ存在。**`type="button"`**（submit ではない） |
| 「確認する」押下後 | モーダルではなく**確認画面への差し替え**。`role="dialog"` は無く、**URLは `/item/new` のまま変わらない** |
| 「出品する」ボタン | 確認画面に1つだけ現れる。テキストは `出品する`、**`type="submit"`**、表示済み |
| 「下書きに保存する」ボタン | `/item/new` と `/drafts/{hash}/edit` の**両方**に存在する。そのためボタン名だけでページを判別してはいけない |
| フリマアシストの再出品ボタン | `href` も `target` も持たない `<a id="clone-item">`。クリックすると拡張がタブを開き、そのまま `https://fril.jp/item/new` に入力済みで到達する |
| `isFormFilled()` | 空の `/item/new` で false、入力済みの下書き編集ページで true |
| チェックボックスの注入 | `div.deal-item` は既に `display:flex`。注入した要素は再レンダリングで消えない |

### 未検証

「下書きに保存する」「出品する」を押したあとの遷移先。実際に保存・出品しないと
確認できないため未検証。

**「確認する」の遷移でURLが変わらない**ことが分かっているため、保存・出品の完了でも
URLが変わらない可能性がある。その場合、URL離脱を完了とみなす現在の判定では
完了を検知できず、実際には成功しているのにウォッチドッグで失敗扱いになる。
その兆候は失敗理由「出品後の画面遷移を確認できませんでした」として現れるので、
これが出た場合は Content Script 側からの完了通知を足す必要がある。

### 調査用のDOMマーカー

Content Script と Service Worker の console ログは拡張の外からは読めないため、
出品フォーム用 Content Script は自分の状態を `<html data-rbl-form="...">` に残す。

| 値 | 意味 |
| --- | --- |
| 無し | Content Script が注入されていない（manifest の matches、または拡張の再読み込み漏れ） |
| `manual` | 注入されたが、自動処理対象ではないと判定した（Background がタブを捕捉できていない） |
| `auto` | 自動処理対象として自動出品を実行した |

`manifest.json` を変更したときは、ページのリロードだけでは反映されない。
`chrome://extensions` で拡張自体を再読み込みする必要がある
（`dist/*.js` の変更はページのリロードだけで反映される）。

## コマンド

```bash
npm run build          # webpack でビルド（開発用）
npm run build:prod     # 本番用ビルド
npm run lint           # ESLint
npm run format         # Prettier
npm run clean          # dist を削除
```

## ディレクトリ構造

```
src/
├── background/    # 処理キュー・タブ追跡・完了検知（Service Worker）
├── common/        # Background ⇔ Content 共有（メッセージ型定義・URL判定・logger）
├── content/
│   ├── list/      # 一覧ページ用（infra / logic / ui の3層）
│   └── form/      # 出品フォーム用（/drafts/{hash}/edit と /item/new の自動出品）
└── popup/
```

## インストール（開発版）

1. `npm install && npm run build`
2. Chrome の `chrome://extensions` で「パッケージ化されていない拡張機能を読み込む」からこのディレクトリを選択

## 注意事項

- 本拡張は個人利用を想定しています。ラクマの利用規約における自動化ツールの扱いを理解のうえ、自己責任で使用してください
- 短時間の大量実行は避けてください（待機時間の設定は `src/background/queue-manager.ts`）
