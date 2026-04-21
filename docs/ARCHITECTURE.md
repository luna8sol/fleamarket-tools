# アーキテクチャ設計ドキュメント

## 概要

この拡張機能は Chrome の Manifest V3 アーキテクチャに基づいて構築されています。

- **Content Script**: メルカリサイト上で実行される主要なコード（`jp.mercari.com/mypage/drafts`・`/mypage/listings` のみ動作）
- **Background Script**: バックグラウンド処理用（現在は最小限の実装）
- **Popup**: ユーザーインターフェース用のポップアップ画面

## ディレクトリ構造

```
mercari-draft-publisher/
├── docs/                  # ドキュメント
├── dist/                  # ビルド成果物（gitignore 済み。manifest.json が参照する）
├── src/
│   ├── common/            # 共通ユーティリティ（DOM操作・汎用関数）
│   ├── content/           # Content Script
│   │   ├── index.ts       # エントリーポイント
│   │   ├── infra/         # インフラ層
│   │   ├── logic/         # ロジック層
│   │   └── ui/            # UI層
│   └── popup/             # Popup
├── background.js
├── manifest.json
├── popup.html
├── webpack.config.js
└── tsconfig.json
```

## 3 層構造

### インフラ層（src/content/infra/）

基盤となる機能を提供します。

| ファイル | 役割 |
|---------|------|
| `constants.ts` | 定数の一元管理（セレクタ・クラス名・ID・待機時間・デフォルト設定） |
| `types.ts` | 型定義（`Item`・`UserSettings`・`AppState`） |
| `page-detector.ts` | URL からページタイプ（`DRAFTS` / `LISTINGS` / `UNKNOWN`）を検出 |
| `ext-storage.ts` | `chrome.storage.local` への読み書き（`ExtStorageKey` enum でキー管理）。ポップアップとコンテンツスクリプトで同じ領域を共有する |
| `user-settings.ts` | ユーザー設定の読み書き（未保存の項目は `DEFAULT_USER_SETTINGS` で補完） |
| `logger.ts` | デバッグ用ロガー（ログレベル制御あり） |
| `debounce.ts` | 連続操作の制御 |
| `error-handler.ts` | エラー処理 |

### ロジック層（src/content/logic/）

拡張機能のコアロジックを実装します。

| ファイル | 役割 |
|---------|------|
| `app-initializer.ts` | アプリ初期化・各層の統合・ページタイプに応じたセットアップ |
| `observer-manager.ts` | MutationObserver による DOM 変更の監視と処理。UI の初期描画もここが担う |
| `selection-manager.ts` | 選択商品の追加・削除・順序管理（**永続化はしない。メモリ上のみ**） |
| `publisher.ts` | 下書きの自動出品処理 |
| `relist-manager.ts` | 出品中商品の再出品処理 |
| `common-processor.ts` | 出品・再出品に共通する逐次処理 |
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

## 処理フロー

### 初期化フロー

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
4. `relist-manager.ts` の `executeRelist()` が再出品ボタンを順番にクリック
5. 完了後、成功通知を表示

## 設計原則

- **レイヤー分離**: インフラ層・ロジック層・UI 層を明確に分離し、上位層が下位層に依存する一方向の依存関係を保つ
- **シングルトンパターン**: 主要なマネージャークラスはファイル末尾でシングルトンインスタンスとしてエクスポートする
- **定数の一元管理**: DOM セレクタ・設定値は必ず `constants.ts` に追加する
- **イベント駆動**: MutationObserver による DOM 変更の監視とイベントベースの処理
- **型安全**: TypeScript strict モード、`any` 型の使用禁止
