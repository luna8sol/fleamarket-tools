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

出力先は **`dist/`**。`dist/` は gitignore 済み。エントリーポイントは 5 つあり、**どれか 1 つでも欠けるとその機能だけが黙って動かない**:

| 出力 | 使われる場所 |
| --- | --- |
| `dist/content.js` | 一覧ページ（下書き / 出品中）の content script |
| `dist/edit.js` | 編集・出品フォームページの content script |
| `dist/background.js` | service worker（Claude API 呼び出し） |
| `dist/popup.js` | ツールバーのポップアップ |
| `dist/options.js` | 拡張機能のオプション画面 |

## 3. Chrome に読み込む

1. `chrome://extensions` を開く
2. 「デベロッパーモード」をオン
3. 「パッケージ化されていない拡張機能を読み込む」
4. **リポジトリルート**（`manifest.json` があるディレクトリ）を選ぶ

**README.md は「`dist` ディレクトリを選択」と書いているが誤り。** `manifest.json` はリポジトリルートにあり、そこから `dist/content.js` を参照している。

## 4. APIキーを設定する（AI 説明文生成を触るときだけ）

一括出品・一括再出品はキー無しで動く。AI 説明文生成を確認するときだけ必要:

1. `chrome://extensions` でこの拡張機能の「詳細」→「拡張機能のオプション」
2. [Claude Console](https://console.anthropic.com/settings/keys) で発行したキーを貼って保存

**キーはこの worktree ではなくブラウザのプロファイルに紐づく**（`chrome.storage.local`）。worktree を作り直しても設定し直しは不要だが、Chrome のプロファイルを分けると設定し直しになる。

## 5. 動作確認する

content script が動くのは、`manifest.json` の `matches` にある**この URL パターンだけ**:

| URL パターン | 入るスクリプト | 見えるもの |
| --- | --- | --- |
| `https://jp.mercari.com/mypage/drafts*` | `dist/content.js` | 一括出品バー・チェックボックス |
| `https://jp.mercari.com/mypage/listings*` | `dist/content.js` | 一括再出品バー・チェックボックス |
| `https://jp.mercari.com/sell*` | `dist/edit.js` | 説明欄の下の「AIで説明文を作る」パネル |

他のページでは何も起きないのが正常。`/sell*` のうち**出品フォームがあるページ（`/sell/draft/{id}`・`/sell/edit/{id}`・`/sell/create`）でしかパネルは出ない。** `/sell` トップや `/sell/drafts` 一覧ではスクリプトは入るが UI は出ない（正常）。

## 症状 → 原因

設定漏れが画面上の不具合と区別できない箇所があるので、まずこの表を見る。

| 症状 | 原因 |
| --- | --- |
| 型チェック・lint が「モジュールが見つからない」で大量に落ちる。コードは触っていない | worktree に `node_modules` が無い。`npm ci` を実行する |
| Chrome に読み込もうとして「マニフェストが見つかりません」 | `dist/` を選んでいる。選ぶのは**リポジトリルート**（README の記述が誤り） |
| 拡張機能は読み込めたが、メルカリの画面に一括操作バーが出ない | `npm run build` をしていない。`dist/content.js` が無いと content script はロードされない（エラーも出ないので「機能が壊れた」ように見える） |
| ソースを直したのに挙動が変わらない | ①再ビルドしていない（`npm run build`）②ビルド後に `chrome://extensions` で拡張機能の再読み込みをしていない ③ページをリロードしていない。**この 3 つは全部必要** |
| バーは出るが対象の商品が 1 件も拾えない | メルカリ側の DOM が変わった可能性。`src/content/infra/constants.ts` の `SELECTOR` と、実際のページの DOM を突き合わせる |
| 設定が前回の値のまま／消えない | 保存先は `chrome.storage.local`（[ext-storage.ts](../../../src/common/ext-storage.ts) の `ExtStorageKey`）。拡張機能を再読み込みしても消えない。**ページの DevTools の Application タブには出ない**（拡張機能の領域で、ポップアップ・content script・background・options page が共有する）。消すには `chrome://extensions` でこの拡張機能の Service Worker を開き、コンソールで `chrome.storage.local.clear()`（**APIキーも消える**） |
| 選択した商品・選択順がページをまたぐと消える | **選択状態は永続化していない**（メモリ上のみ）。リロードやページ遷移で消えるのが現在の仕様 |
| 編集ページで「AIで説明文を作る」が出ない | ①`dist/edit.js` が無い（`npm run build` をしていない）②出品フォームのないページを見ている（`/sell` トップ・`/sell/drafts` 一覧では出ないのが正常）③メルカリ側の DOM が変わって説明欄を見つけられない。③なら**ページのコンソールに「説明欄が … 回の試行後も見つかりませんでした」の警告が出る**。出ていれば `src/content/infra/constants.ts` の `EDIT_SELECTOR` を実際の DOM と突き合わせる |
| 生成を押すと「APIキーが設定されていません」 | オプション画面で未設定（上記 4）。**ページのコンソールではなく `chrome://extensions` の Service Worker のコンソール**に background 側のログが出る。content script 側のログと混同しない |
| `npm run format:check` が落ちる | **元から落ちている**。セットアップの失敗ではない。`npm run lint` のほうは通るのが正常。**件数は git が触った直後に跳ね上がる**（CRLF）。判定方法と現在の件数は [CLAUDE.md の「検証」](../../../CLAUDE.md) |
| `npm run build:tsc` を実行したら `dist/` の中身が変わった | `build:tsc` は `tsc`（`--noEmit` なし）で成果物を吐く。型チェックには使わない。`npm run build` で作り直す |

## worktree を新しく作ったとき

1. `npm ci`（上記 1）
2. **`.claude/settings.local.json` を種まきする。** `settings.local.json` は gitignore されており worktree ごとに別コピーになるため、無いと「don't ask again」の許可がバラバラに肥大化する。既存の worktree からコピーする:
   ```bash
   cp -n ../<既存worktree>/.claude/settings.local.json .claude/settings.local.json
   ```
   `.claude/skills/` と `.claude/settings.json` は git 管理下なので、worktree を作った時点で入っている。
3. **ブランチ名が規約どおりか確認する。** 自動命名（`claude/...`、`worktree-...`）のままなら直す（規約は [CLAUDE.md](../../../CLAUDE.md) の「ブランチ運用の補足」）:
   ```bash
   git branch --show-current
   git branch -m <feature|fix|docs|refactor>/<英小文字の短い説明>
   ```

## worktree とブランチの関係

- **worktree 1 つにつきブランチが 1 本占有される。** 同じブランチを 2 つの worktree で同時にチェックアウトできない。
- そのため **`git switch develop` が `already checked out` で失敗することがある。** どの worktree が持っているかを見る:
  ```bash
  git worktree list
  ```
  持っている worktree があるなら、そのディレクトリで作業する。
- **worktree を削除する前に、未コミットの変更が残っていないか必ず確認する:**
  ```bash
  git -C <worktree のパス> status --short     # 空でなければ中身を確認してから
  git worktree remove <worktree のパス>
  ```
  `git worktree remove` は未コミットの変更があると拒否される。**`--force` で消す前に、失うものが無いか必ず見る。** gitignore されたファイル（`.claude/settings.local.json`、`node_modules/`、`dist/`）も一緒に消える。
- マージ後の作業ブランチと worktree の片付けは [merge スキル](../merge/SKILL.md) の「後始末」にまとめてある。
