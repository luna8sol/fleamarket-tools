# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build          # webpack でビルド（開発用）
npm run build:prod     # 本番用ビルド（最適化・圧縮あり）
npm run build:dev      # 開発用ビルド（ソースマップ付き）
npm run lint           # ESLint で静的解析
npm run lint:fix       # ESLint で自動修正
npm run format         # Prettier でフォーマット
npm run format:check   # Prettier でフォーマット差分チェック
npm run clean          # dist ディレクトリを削除
```

ビルド成果物は `dist/` に出力される。テストフレームワークは現時点で未導入。

## アーキテクチャ

### Chrome 拡張の構成

- **Manifest V3** ベース。`jp.mercari.com/mypage/drafts` と `/mypage/listings` のみで Content Script が動作する
- エントリーポイントは `src/content/index.ts`（Content Script）と `src/popup/index.ts`（Popup）の2本立て。webpack がそれぞれ `dist/content.js`・`dist/popup.js` にバンドルする

### 3 層構造（src/content 配下）

| 層 | ディレクトリ | 役割 |
|----|------------|------|
| インフラ層 | `src/content/infra/` | 定数・型・ストレージ・ロガー・ページ検出・デバウンス・エラーハンドラ |
| ロジック層 | `src/content/logic/` | 選択管理・出品処理・再出品処理・DOM 監視 |
| UI 層 | `src/content/ui/` | 一括操作バー・チェックボックス・通知・順序表示 |

各層のクラスはファイル末尾でシングルトンとしてエクスポートされている（例: `export const appInitializer = new AppInitializer()`）。

### 定数管理

すべての定数は `src/content/infra/constants.ts` に集約されている。DOM セレクタ（`SELECTOR`）・クラス名（`CLASS_NAME`）・ID 名（`ID_NAME`）・待機時間（`CONFIG`）・ユーザー設定のデフォルト値（`DEFAULT_USER_SETTINGS`）を追加・変更する場合は必ずこのファイルを編集する。

### ストレージ

`chrome.storage` ではなく `localStorage` を使用している。`src/content/infra/storage.ts` の `saveToStorage` / `loadFromStorage` 経由で操作する。キーは `StorageKey` enum で管理。

### ページ判定

`src/content/infra/page-detector.ts` の `detectCurrentPage()` が URL を見て `PageType.DRAFTS` / `PageType.LISTINGS` / `PageType.UNKNOWN` を返す。ページタイプに応じて初期化処理や表示する UI が切り替わる。

## コーディングルール

- `any` 型は禁止（ESLint で error）
- 関数には戻り値の型を明示する（ESLint で warn）
- 文字列はシングルクォート、文末セミコロン必須
- 未使用 import は自動検出・エラー扱い

## ブランチ運用

```
main      ← リリース済み安定版
develop   ← 開発の統合ブランチ
feature/* ← 機能追加
fix/*     ← バグ修正
docs/*    ← ドキュメント
```

### コミットメッセージ

以下のプレフィックスを付ける。

| プレフィックス | 用途 |
|--------------|------|
| `feat:` | 新しい機能の追加 |
| `fix:` | バグの修正 |
| `docs:` | ドキュメントのみの変更 |
| `style:` | 空白・フォーマット・セミコロン追加など、動作に影響しない変更 |
| `refactor:` | 仕様に影響がないコード改善（リファクタリング） |
| `perf:` | パフォーマンス向上に関する変更 |
| `test:` | テストの追加・修正 |
| `chore:` | ビルド・補助ツール・ライブラリなど開発環境に関する変更 |

```
# 例
feat: add bulk publish button to draft page
fix: correct selector for relist button
docs: update CLAUDE.md with branch strategy
```
