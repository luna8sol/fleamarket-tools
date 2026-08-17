# Rakuma Bulk Lister

ラクマ（fril.jp）の出品作業を一括化する Chrome 拡張機能。

- **一括再出品**: 「出品した商品」（`/sell`）で商品を選択し、フリマアシストの再出品ボタンを順にクリックして再出品する
- **下書き一括出品**: 「下書きの商品」（`/draft`）で下書きを選択し、順に出品する

## 前提

- 一括再出品には Chrome 拡張機能「フリマアシスト」のインストールが必要（`/sell` に注入される `#clone-item` ボタンを利用するため）
- 下書き一括出品はフリマアシスト不要

## 仕組み

```
① 一覧ページ (content-list.js)
   /sell:  チェックボックスで選択 → フリマアシストの再出品ボタンをクリック
   /draft: チェックボックスで選択 → Background が編集ページをタブで開く

② Background (background.js)
   処理キューの管理・タブの追跡・出品完了の検知・商品間の待機時間制御

③ 出品フォーム (content-form.js)
   relist:  /item/new              （フリマアシストが商品ページ経由で開く）
   publish: /drafts/{hash}/edit    （Background が開く）
   Background に自動処理対象タブか確認したうえで
   「確認する」→「出品する」を自動クリックする
```

### 出品完了の判定は Background 側で行う

出品フォームのタブを `chrome.tabs.onUpdated` で監視し、**「出品する」をクリックしたあとに
出品フォームの URL から離れたこと**をもって完了とみなす。

Content Script 側で遷移を監視しない理由は、`/item/new` からの出品成功後の遷移先が
`item.fril.jp`（別オリジン）になりうるため。その場合 Content Script は遷移前に破棄され、
完了を見届けられない。

### Service Worker の破棄に耐える

MV3 の Service Worker はアイドル状態が続くと破棄される。本拡張は商品間に 60〜75 秒の待機を
挟むため、待機中の破棄は**必ず起きる**。そのためキューの状態は変更のたびに
`chrome.storage.session` へ書き戻し、すべてのイベントハンドラの先頭で復元してから処理する。

タイマー類も `setTimeout` ではなく `chrome.alarms` を使う（`setTimeout` は Service Worker の
破棄とともに消えるため）。

- `next-item` アラーム: 次の商品の処理開始
- `watchdog` アラーム: 1 商品の処理が 3 分以内に完了しない場合に打ち切る

### その他の設計上の判断

- 出品フォームのボタンは Chakra UI のハッシュクラスのため**テキストで特定**する
- 手動で開いた出品ページでは何もしない（Background への確認で判別）
- 「確認する」を押す前にフォームへ値が入るのを待つ（フリマアシストの入力完了前に
  空のフォームを送らないため）
- 失敗時（バリデーションエラー・タイムアウト等）はタブを残してユーザーが確認できるようにする
- 一覧ページを再読込しても、実行中のキューの進捗は Background から取得して復元される

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
