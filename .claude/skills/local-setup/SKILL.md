---
name: local-setup
description: 拡張機能を手元でビルドして Chrome に読み込み、動作確認できる状態にする。worktree を新しく作った直後のセットアップも含む。「環境を立ち上げて」「セットアップして」「ビルドして動かしたい」「worktree を作った」「Chrome で確認したい」と言われた時に使用
---

# ローカル環境の立ち上げ

## 1. 依存をインストールする（worktree では必須）

```bash
npm ci
```

- **worktree は `node_modules` を共有しない。** 本体チェックアウトに `node_modules` があっても worktree には無い。**作成後にまず依存をインストールする**（しないと型チェック・lint がコードと無関係に落ちる）。
- `npm ci` を使う（`package-lock.json` どおりに入り、lockfile を書き換えない）。README は `npm install` と書いているが、既存環境では `npm ci` のほうが安全。
- **gitignore されたファイルは worktree にコピーされない。** 現状このリポジトリは `.env` を使っていない（`src/` にも `webpack.config.js` にも参照が無い）が、将来追加したら本体から手で持ってくること。**テンプレートから secret をコピーするときは `cp -n`**（既存を空テンプレートで上書きしない）。

## 2. ビルドする

```bash
npm run build       # 開発用
npm run build:prod  # 本番用（最適化・圧縮あり）
```

出力先は **`dist/`**（`dist/content.js`, `dist/popup.js`）。`dist/` は gitignore 済み。

## 3. Chrome に読み込む

1. `chrome://extensions` を開く
2. 「デベロッパーモード」をオン
3. 「パッケージ化されていない拡張機能を読み込む」
4. **リポジトリルート**（`manifest.json` があるディレクトリ）を選ぶ

**README.md は「`dist` ディレクトリを選択」と書いているが誤り。** `manifest.json` はリポジトリルートにあり、そこから `dist/content.js` を参照している。

## 4. 動作確認する

content script が動くのは、`manifest.json` の `matches` にある**この 2 つの URL パターンだけ**:

- `https://jp.mercari.com/mypage/drafts*`（下書き一覧 → 一括出品）
- `https://jp.mercari.com/mypage/listings*`（出品中一覧 → 一括再出品）

他のページでは何も起きないのが正常。

## 症状 → 原因

設定漏れが画面上の不具合と区別できない箇所があるので、まずこの表を見る。

| 症状 | 原因 |
| --- | --- |
| 型チェック・lint が「モジュールが見つからない」で大量に落ちる。コードは触っていない | worktree に `node_modules` が無い。`npm ci` を実行する |
| Chrome に読み込もうとして「マニフェストが見つかりません」 | `dist/` を選んでいる。選ぶのは**リポジトリルート**（README の記述が誤り） |
| 拡張機能は読み込めたが、メルカリの画面に一括操作バーが出ない | `npm run build` をしていない。`dist/content.js` が無いと content script はロードされない（エラーも出ないので「機能が壊れた」ように見える） |
| ソースを直したのに挙動が変わらない | ①再ビルドしていない（`npm run build`）②ビルド後に `chrome://extensions` で拡張機能の再読み込みをしていない ③ページをリロードしていない。**この 3 つは全部必要** |
| `scripts/content.js` を直したのに何も変わらない | `scripts/*.js` は**古いビルド成果物**で、現在のビルドでは更新されず、`manifest.json` からも参照されていない。ソースは `src/` 配下 |
| バーは出るが対象の商品が 1 件も拾えない | メルカリ側の DOM が変わった可能性。`src/content/infra/constants.ts` の `SELECTOR` と、実際のページの DOM を突き合わせる |
| 選択状態や設定が前回の値のまま／消えない | 保存先は `chrome.storage` ではなく `localStorage`。拡張機能を再読み込みしても消えない。`src/content/infra/storage.ts` の `StorageKey` を見て、DevTools の Application タブから消す |
| `chrome.tabs` / `chrome.scripting` を使う処理が権限エラーになる | `manifest.json` の `host_permissions` は `https://www.mercari.com/*` だが、実際の対象は `jp.mercari.com`。**この不一致が実害を出すかは未検証**。該当したらまずここを疑う |
| `npm run format:check` が落ちる | **元から落ちている**（既存コード 29 ファイル）。セットアップの失敗ではない。`npm run lint` のほうは通るのが正常。詳細は [CLAUDE.md の「検証」](../../../CLAUDE.md) |
| `npm run build:tsc` を実行したら `dist/` の中身が変わった | `build:tsc` は `tsc`（`--noEmit` なし）で成果物を吐く。型チェックには使わない。`npm run build` で作り直す |

## worktree を新しく作ったとき

1. `npm ci`（上記 1）
2. **`.claude/settings.local.json` を種まきする。** `settings.local.json` は gitignore されており worktree ごとに別コピーになるため、無いと「don't ask again」の許可がバラバラに肥大化する。既存の worktree からコピーする:
   ```bash
   cp -n ../<既存worktree>/.claude/settings.local.json .claude/settings.local.json
   ```
   `.claude/skills/` と `.claude/settings.json` は git 管理下なので、worktree を作った時点で入っている。
