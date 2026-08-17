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
   処理キューの管理・タブの追跡・商品間の待機時間制御（chrome.alarms）

③ 下書き編集ページ (content-edit.js)
   Background に自動処理対象タブか確認したうえで
   「確認する」→「出品する」を自動クリック → 下書き一覧への遷移を検知して完了通知
```

- 編集ページのボタンは Chakra UI のハッシュクラスのため**テキストで特定**する
- 手動で開いた編集ページでは何もしない（Background への確認で判別）
- 失敗時（バリデーションエラー等）はタブを残してユーザーが確認できるようにする
- 商品間には 60〜75 秒のランダム待機を挟む

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
├── background/    # 処理キュー・タブ追跡（Service Worker）
├── common/        # Background ⇔ Content 共有（メッセージ型定義・logger）
├── content/
│   ├── list/      # 一覧ページ用（infra / logic / ui の3層）
│   └── edit/      # 下書き編集ページ用（自動出品）
└── popup/
```

## インストール（開発版）

1. `npm install && npm run build`
2. Chrome の `chrome://extensions` で「パッケージ化されていない拡張機能を読み込む」からこのディレクトリを選択

## 注意事項

- 本拡張は個人利用を想定しています。ラクマの利用規約における自動化ツールの扱いを理解のうえ、自己責任で使用してください
- 短時間の大量実行は避けてください（待機時間の設定は `src/background/queue-manager.ts`）
