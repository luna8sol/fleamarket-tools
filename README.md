# Mercari Draft Publisher

メルカリの下書き商品を効率的に出品するための Chrome 拡張機能です。

## 機能

- 下書き商品の一括出品
- 出品済み商品の一括再出品
- 選択順の管理と視覚的表示
- 商品画像と入力済みの商品情報をもとにした AI 商品説明文の生成（Claude API）

## セットアップ

```bash
npm install
npm run build
```

Chrome の拡張機能管理ページ（`chrome://extensions`）を開き、「デベロッパーモード」をオンにして「パッケージ化されていない拡張機能を読み込む」から**リポジトリルート**（`manifest.json` があるディレクトリ）を選択してください。`manifest.json` がそこから `dist/content.js` を参照するため、`dist` ディレクトリ自体を選ぶと読み込めません。

### Claude API キーの設定（AI 説明文生成を使う場合のみ）

拡張機能の「詳細」→「拡張機能のオプション」から設定画面を開き、[Claude Console](https://console.anthropic.com/settings/keys) で発行した API キーを保存してください。キーはこのブラウザの拡張機能ストレージにのみ保存され、Claude API 以外には送信されません。一括出品・一括再出品はキーなしで動きます。

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
