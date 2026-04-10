# メルカリ下書き出品支援 Chrome拡張機能 設計ドキュメント

## 概要

この拡張機能は、メルカリの下書き商品を効率的に出品するためのツールです。主な機能は以下の通りです：

1. 下書き商品の一括出品機能
2. 出品済み商品の一括再出品機能
3. 選択順の管理と視覚的表示
4. ユーザーインターフェース要素の動的生成と配置

## アーキテクチャ

### 1. 全体構成

この拡張機能は Chrome の拡張機能アーキテクチャに基づいて構築されています：

- **Manifest V3**: 最新の Chrome 拡張 API 形式を採用
- **Content Script**: メルカリサイト上で実行される主要なコード
- **Background Script**: バックグラウンドでの処理用（現在は最小限の実装）
- **Popup**: ユーザーインターフェース用のポップアップ画面

### 2. ディレクトリ構造

```
mercari-draft-publisher/
├── assets/              # 静的アセット
├── scripts/             # ビルド後のスクリプト
│   ├── content.js       # ビルド済みのcontent script
│   └── popup.js         # ビルド済みのpopupスクリプト
├── src/                 # ソースコード
│   ├── common/          # 共通ユーティリティ
│   │   ├── dom.ts       # DOM操作ヘルパー
│   │   └── utils.ts     # 一般的なユーティリティ関数
│   ├── content/         # コンテンツスクリプトのソース
│   │   ├── index.ts     # エントリーポイント
│   │   ├── common/      # 共通モジュール
│   │   ├── infra/       # インフラ層
│   │   │   ├── constants.ts     # 定数定義
│   │   │   ├── debounce.ts      # 連打防止
│   │   │   ├── error-handler.ts # エラー処理
│   │   │   ├── logger.ts        # ログ出力
│   │   │   ├── page-detector.ts # ページ種類検出
│   │   │   ├── storage.ts       # データ保存
│   │   │   └── types.ts         # 型定義
│   │   ├── logic/       # ビジネスロジック層
│   │   │   ├── app-initializer.ts  # アプリケーション初期化
│   │   │   ├── dom-utils.ts        # DOM操作ユーティリティ
│   │   │   ├── observer-manager.ts # DOM変更監視
│   │   │   ├── observer.ts         # 監視処理
│   │   │   ├── publisher.ts        # 出品処理
│   │   │   ├── relist-manager.ts   # 再出品管理
│   │   │   ├── selection-manager.ts # 選択管理
│   │   │   └── selection.ts         # 選択状態
│   │   └── ui/          # UI層
│   │       ├── bulk-bar-core.ts    # 一括操作バーの基本機能
│   │       ├── bulk-bar-ui.ts      # 一括操作バーのUI要素
│   │       ├── bulk-relist.ts      # 再出品関連の機能
│   │       ├── bulk-bar-utils.ts   # 一括操作バーのユーティリティ
│   │       ├── checkbox-manager.ts # チェックボックス管理
│   │       ├── index.ts            # UIエントリーポイント
│   │       ├── list.ts             # リスト表示
│   │       ├── notification.ts     # 通知表示
│   │       ├── order-display.ts    # 順番表示
│   │       ├── order.ts            # 順序管理
│   │       └── ui-manager.ts       # UI全体管理
│   └── popup/           # ポップアップのソース
│       └── index.ts     # ポップアップのエントリーポイント
├── background.js        # バックグラウンドスクリプト
├── manifest.json        # 拡張機能マニフェスト
├── popup.html           # ポップアップHTML
├── webpack.config.js    # Webpackの設定
└── tsconfig.json        # TypeScriptの設定
```

## 主要コンポーネントと責務

### 1. インフラ層 (src/content/infra)

基盤となる機能を提供します：

- **constants.ts**: アプリ全体で使用する定数（セレクタ、ID、タイマー設定など）
- **page-detector.ts**: 現在のページタイプ（下書き/出品中）を検出
- **logger.ts**: デバッグ用のログ機能
- **debounce.ts**: 連続した操作の制御
- **error-handler.ts**: エラー処理
- **storage.ts**: データ永続化

### 2. ロジック層 (src/content/logic)

拡張機能のコアロジックを実装します：

- **app-initializer.ts**: アプリケーションの初期化と統合
  - DOM監視の開始
  - UIコンポーネントの初期化
  - イベントハンドラのセットアップ
  
- **observer-manager.ts** & **observer.ts**: DOM変更の監視と処理
  - MutationObserverによる下書き/出品リストの監視
  - ページ構造変更の検出と対応

- **selection-manager.ts** & **selection.ts**: 選択商品の管理
  - 選択状態の追加/削除
  - 選択順序の管理
  
- **publisher.ts**: 下書きの出品処理
  - 選択した下書きの自動出品
  - 出品完了通知

- **relist-manager.ts**: 再出品処理
  - 出品中商品の再出品ボタンのクリック処理
  - 処理状況の管理

- **dom-utils.ts**: DOM操作のユーティリティ関数
  - 商品リスト要素の検索
  - 再出品ボタンの特定

### 3. UI層 (src/content/ui)

ユーザーインターフェースを構築します：

- **ui-manager.ts**: UI全体の管理と描画
  - 各UIコンポーネントの統合
  - ページタイプに応じたUI切り替え

- **bulk-bar.ts**: 一括操作用のバー
  - 一括出品/再出品ボタン
  - 選択件数表示
  - 処理状況表示

- **checkbox-manager.ts**: 商品選択用チェックボックス
  - チェックボックスの生成と配置
  - 選択イベントの処理

- **order-display.ts** & **order.ts**: 選択順序表示
  - 選択順序のビジュアル表示
  - 順序管理

- **notification.ts**: 通知表示
  - 処理結果の通知
  - エラーメッセージ表示

### 4. 共通モジュール (src/common)

- **dom.ts**: 安全なDOM操作用のラッパー関数
- **utils.ts**: 汎用ユーティリティ関数

### 5. その他のコンポーネント

- **popup/index.ts**: ポップアップUIのロジック
- **background.js**: バックグラウンドでの処理（現在は最小限）

## 処理フロー

### 1. 初期化フロー

1. content/index.ts がエントリーポイントとして実行される
2. appInitializer.initialize() が呼び出される
   - 現在のページタイプが検出される
   - observerManager が DOM の監視を開始
   - ページタイプに応じたセットアップが行われる
3. DOMContentLoaded イベントで UI コンポーネントが初期化される
   - 下書きページでは出品バーが表示される
   - 出品中ページでは再出品バーが表示される

### 2. 下書き出品フロー

1. ユーザーが下書きページで商品にチェックを入れる
2. selection-manager が選択状態と順序を管理
3. ユーザーが「選択した下書きを順番に出品」ボタンをクリック
4. publisher.ts の publishAllDrafts() が実行される
5. 選択された下書きが順番に出品される
6. 完了すると成功通知が表示される

### 3. 再出品フロー

1. ユーザーが出品中ページで商品にチェックを入れる
2. selection-manager が選択状態と順序を管理
3. ユーザーが「選択した商品を再出品」ボタンをクリック
4. relist-manager.ts の executeRelist() が実行される
5. 選択された商品の再出品ボタンが順番にクリックされる
6. 完了すると成功通知が表示される

## 設計原則

1. **レイヤー分離**: インフラ層、ロジック層、UI層の明確な分離
2. **シングルトンパターン**: 主要なマネージャークラスはシングルトンとして実装
3. **イベント駆動**: DOM変更の監視とイベントベースの処理
4. **型安全**: TypeScriptによる厳格な型チェック
5. **エラーハンドリング**: 堅牢なエラー処理と通知

## セットアップ手順

1. 依存パッケージのインストール:
```
npm install
```

2. ビルド:
```
npm run build
```

3. Chrome拡張機能として読み込む:
   - Chrome の拡張機能管理ページを開く
   - 「デベロッパーモード」をオン
   - 「パッケージ化されていない拡張機能を読み込む」をクリック
   - `dist` ディレクトリを選択

## 開発コマンド

| コマンド | 説明 |
|---------|------|
| npm run build | webpackでビルド |
| npm run build:tsc | TypeScriptのみをビルド |
| npm run build:prod | 本番用ビルド (最適化・圧縮あり) |
| npm run build:dev | 開発用ビルド (ソースマップ付き) |
| npm run lint | ESLintでコードの静的解析 |
| npm run lint:fix | ESLintで自動修正 |
| npm run format | Prettierでコードフォーマット |
| npm run format:check | Prettierでフォーマット差分チェック |
| npm run clean | distディレクトリを削除 |
