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

出力先は **`dist/`**（`dist/content-list.js` / `dist/content-edit.js` / `dist/background.js` / `dist/popup.js`）。`dist/` は gitignore 済み。

## 3. Chrome に読み込む

1. `chrome://extensions` を開く
2. 「デベロッパーモード」をオン
3. 「パッケージ化されていない拡張機能を読み込む」
4. **リポジトリルート**（`manifest.json` があるディレクトリ）を選ぶ

`manifest.json` はリポジトリルートにあり、そこから `dist/*.js` を参照している。`dist/` を選ぶとマニフェストが見つからない。

## 4. 動作確認する

content script が動くのは、`manifest.json` の `matches` にある URL だけ:

| URL | 入る content script | 役割 |
| --- | --- | --- |
| `https://fril.jp/sell*` | `dist/content-list.js` | 出品中一覧 → 一括再出品 |
| `https://fril.jp/draft*` | `dist/content-list.js` | 下書き一覧 → 一括出品 |
| `https://fril.jp/drafts/*` | `dist/content-edit.js` | 下書き編集ページ → 自動出品 |

他のページでは何も起きないのが正常。

**一括再出品には Chrome 拡張機能「フリマアシスト」が必要。** `/sell` の再出品ボタン（`a#clone-item`）は同拡張が注入するもので、入っていないとこの拡張だけでは再出品できない。下書きの一括出品にはフリマアシストは不要。

**1 件の処理に 1 分以上かかるのが正常。** 商品間に 60〜75 秒のランダム待機が入る（`src/background/queue-manager.ts`）。止まって見えても待つ。

## 症状 → 原因

設定漏れが画面上の不具合と区別できない箇所があるので、まずこの表を見る。

| 症状 | 原因 |
| --- | --- |
| 型チェック・lint が「モジュールが見つからない」で大量に落ちる。コードは触っていない | worktree に `node_modules` が無い。`npm ci` を実行する |
| Chrome に読み込もうとして「マニフェストが見つかりません」 | `dist/` を選んでいる。選ぶのは**リポジトリルート** |
| 拡張機能は読み込めたが、`/sell` や `/draft` に一括操作バーが出ない | `npm run build` をしていない。`dist/content-list.js` が無いと content script はロードされない（エラーも出ないので「機能が壊れた」ように見える） |
| ソースを直したのに挙動が変わらない | ①再ビルドしていない（`npm run build`）②ビルド後に `chrome://extensions` で拡張機能の再読み込みをしていない ③ページをリロードしていない。**この 3 つは全部必要** |
| バーは出るが対象の商品が 1 件も拾えない | ラクマ側の DOM が変わった可能性。`src/content/list/infra/constants.ts` の `SELECTOR` と、実際のページの DOM を突き合わせる。DevTools のコンソールに `[RakumaBulkLister] 商品IDを取得できない要素をスキップしました` が出ていないか見る |
| `/sell` で「フリマアシストの再出品ボタンが見つかりません」と出る | フリマアシスト拡張が入っていない・無効・まだ注入前。`a#clone-item` の有無を DevTools で確認する |
| 編集ページを開いても自動でクリックされない | **手動で開いた編集ページでは意図的に何もしない**（Background へ `CHECK_AUTO_TAB` で確認している）。一括処理から開かれたタブでのみ動く。仕様であって不具合ではない |
| 出品に失敗したタブが開いたまま残る | **仕様。** バリデーションエラー等をユーザーが確認できるように残している（`handleEditFailed`） |
| 拡張機能を再読み込みしたら実行中のキューが消えた | キューの状態は Service Worker のメモリ上にのみある（`queue-manager.ts` の NOTE）。再読み込みで失われる |
| 進捗表示が更新されない | 一覧タブが閉じられている・遷移した。Background は `notifyProgress` の失敗を握り潰して処理を続ける |
| `npm run format:check` が落ちる | **元から落ちている**（`src` の全 16 ファイル）。セットアップの失敗ではない。`npm run lint` のほうは通るのが正常。詳細は [CLAUDE.md の「検証」](../../../CLAUDE.md) |
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
