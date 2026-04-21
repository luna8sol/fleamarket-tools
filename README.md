# Mercari Draft Publisher

メルカリの下書き商品を効率的に出品するための Chrome 拡張機能です。

## 機能

- 下書き商品の一括出品
- 出品済み商品の一括再出品
- 選択順の管理と視覚的表示

## セットアップ

```bash
npm install
npm run build
```

Chrome の拡張機能管理ページ（`chrome://extensions`）を開き、「デベロッパーモード」をオンにして「パッケージ化されていない拡張機能を読み込む」から**リポジトリルート**（`manifest.json` があるディレクトリ）を選択してください。`manifest.json` がそこから `dist/content.js` を参照するため、`dist` ディレクトリ自体を選ぶと読み込めません。

## 開発コマンド

| コマンド | 説明 |
|---------|------|
| `npm run build` | 開発用ビルド |
| `npm run build:prod` | 本番用ビルド（最適化・圧縮あり） |
| `npm run build:dev` | 開発用ビルド（ソースマップ付き） |
| `npm run lint` | ESLint で静的解析 |
| `npm run lint:fix` | ESLint で自動修正 |
| `npm run format` | Prettier でフォーマット |
| `npm run format:check` | Prettier でフォーマット差分チェック |
| `npm run clean` | dist ディレクトリを削除 |

## ドキュメント

- [アーキテクチャ詳細](docs/ARCHITECTURE.md)
- [コントリビューションガイド](CONTRIBUTING.md)
