---
name: local-setup
description: 2 つの拡張機能を手元でビルドして Chrome に別々に読み込み、動作確認できる状態にする。worktree を新しく作った直後のセットアップも含む。「環境を立ち上げて」「セットアップして」「ビルドして動かしたい」「worktree を作った」「Chrome で確認したい」と言われた時に使用
---

# ローカル環境の立ち上げ

このリポジトリには拡張が 2 つある（`packages/mercari` / `packages/rakuma`）。**Chrome には別々に読み込む。** 依存のインストールとビルドはルートで 1 回。

## 1. 依存をインストールする（worktree では必須）

```bash
npm ci
```

- **リポジトリルートで実行する。** npm workspaces なので `node_modules` はルートにだけでき、両パッケージから使われる。パッケージディレクトリで実行しない。
- **worktree は `node_modules` を共有しない。** 本体チェックアウトに `node_modules` があっても worktree には無い。**作成後にまず依存をインストールする**（しないと型チェック・lint がコードと無関係に落ちる）。
- `npm ci` を使う（`package-lock.json` どおりに入り、lockfile を書き換えない）。
- **gitignore されたファイルは worktree にコピーされない。** 現状このリポジトリは `.env` を使っていないが、将来追加したら本体から手で持ってくること。**テンプレートから secret をコピーするときは `cp -n`**（既存を空テンプレートで上書きしない）。

## 2. ビルドする

```bash
npm run build       # 開発用（両パッケージ）
npm run build:prod  # 本番用（最適化・圧縮あり）
npm run build -w packages/rakuma   # 片方だけ
```

出力先は**各パッケージの `dist/`**（gitignore 済み）。**どれか 1 つでも欠けるとその機能だけが黙って動かない**:

| パッケージ | 出力 | 使われる場所 |
| --- | --- | --- |
| mercari | `dist/content.js` | 一覧ページ（下書き / 出品中）の content script |
| mercari | `dist/edit.js` | 編集・出品フォームページの content script |
| mercari | `dist/background.js` | service worker（Claude API 呼び出し） |
| mercari | `dist/popup.js` / `dist/options.js` | ツールバーのポップアップ / オプション画面 |
| rakuma | `dist/content-list.js` | 一覧ページ（`/sell` / `/draft`）の content script |
| rakuma | `dist/content-form.js` | 出品フォームページの content script |
| rakuma | `dist/background.js` | service worker（キュー管理） |
| rakuma | `dist/popup.js` | ツールバーのポップアップ |

## 3. Chrome に読み込む（2 回）

1. `chrome://extensions` を開く
2. 「デベロッパーモード」をオン
3. 「パッケージ化されていない拡張機能を読み込む」で **`packages/mercari`**（`manifest.json` があるディレクトリ）を選ぶ
4. もう一度「パッケージ化されていない拡張機能を読み込む」で **`packages/rakuma`** を選ぶ

- **リポジトリルートを選ばない。** ルートに `manifest.json` は無い。
- **`dist/` を選ばない。** `manifest.json` はパッケージ直下にあり、そこから `dist/*.js` を参照している。
- 統合前の `mercari-draft-publisher` / `rakuma-bulk-lister` の拡張が読み込まれたままなら、**動作確認中はそちらを無効にする**（同じページに 2 つ注入されて二重に動く）。

## 4. API キーを設定する（メルカリの AI 説明文生成を触るときだけ）

メルカリ用拡張の一括出品・一括再出品はキー無しで動く。AI 説明文生成を確認するときだけ必要:

1. `chrome://extensions` でメルカリ用拡張の「詳細」→「拡張機能のオプション」
2. [Claude Console](https://console.anthropic.com/settings/keys) で発行したキーを貼って保存

**キーは worktree ではなくブラウザのプロファイルに紐づく**（`chrome.storage.local`）。worktree を作り直しても設定し直しは不要だが、Chrome のプロファイルを分けると設定し直しになる。

## 5. 動作確認する

content script が動くのは、各パッケージの `manifest.json` の `matches` にある URL だけ。他のページでは何も起きないのが正常。

### メルカリ（`packages/mercari`）

| URL パターン | 入るスクリプト | 見えるもの |
| --- | --- | --- |
| `https://jp.mercari.com/mypage/drafts*` | `dist/content.js` | 一括出品バー・チェックボックス |
| `https://jp.mercari.com/mypage/listings*` | `dist/content.js` | 一括再出品バー・チェックボックス |
| `https://jp.mercari.com/sell*` | `dist/edit.js` | 説明欄の下の「AIで説明文を作る」パネル |

`/sell*` のうち**出品フォームがあるページ（`/sell/draft/{id}`・`/sell/edit/{id}`・`/sell/create`）でしかパネルは出ない。** `/sell` トップや `/sell/drafts` 一覧ではスクリプトは入るが UI は出ない（正常）。

### ラクマ（`packages/rakuma`）

| URL | 入る content script | 役割 |
| --- | --- | --- |
| `https://fril.jp/sell*` | `dist/content-list.js` | 出品中一覧 → 一括下書き保存・一括削除 |
| `https://fril.jp/draft*` | `dist/content-list.js` | 下書き一覧 → 一括出品・一括削除 |
| `https://fril.jp/drafts/*` | `dist/content-form.js` | 下書き編集ページ → 「確認する」→「出品する」 |
| `https://fril.jp/item/new*` | `dist/content-form.js` | 新規出品ページ → 「下書きに保存する」 |
| `https://fril.jp/item/*/edit*` | `dist/content-form.js` | 出品中商品の編集ページ → 説明欄を書き換え →「確認する」→「更新する」 |

- **一括下書き保存には Chrome 拡張機能「フリマアシスト」が必要。** `/sell` の再出品ボタン（`a#clone-item`）は同拡張が注入するもの。下書きの一括出品・一括削除には不要。
- **`/sell` の一括処理では出品されない。** 複製内容を下書きとして保存するところまで。公開は `/draft` 側で行う 2 段構え。
- **1 件の処理に 1 分以上かかるのが正常。** 商品間に 60〜75 秒のランダム待機が入る（削除のみ 2〜4 秒）。止まって見えても待つ。
- 出品フォーム側の状態は `<html data-rbl-form="...">` に出る。DevTools の Elements で `<html>` を見る:

  | 値 | 意味 |
  | --- | --- |
  | 無し | Content Script が注入されていない（manifest の `matches`、または拡張の再読み込み漏れ） |
  | `checking` | Background へ問い合わせ中（この値で止まっているなら応答が返っていない） |
  | `manual` | 注入されたが、自動処理対象ではないと判定した（手動で開いたページ。仕様） |
  | `auto` | 自動処理対象として自動処理を実行した |

## 症状 → 原因

設定漏れが画面上の不具合と区別できない箇所があるので、まずこの表を見る。

| 症状 | 原因 |
| --- | --- |
| 型チェック・lint が「モジュールが見つからない」で大量に落ちる。コードは触っていない | worktree に `node_modules` が無い。ルートで `npm ci` を実行する |
| Chrome に読み込もうとして「マニフェストが見つかりません」 | リポジトリルートか `dist/` を選んでいる。選ぶのは **`packages/mercari` または `packages/rakuma`** |
| 拡張機能は読み込めたが、一覧ページに一括操作バーが出ない | `npm run build` をしていない。`dist/content.js`（メルカリ）/ `dist/content-list.js`（ラクマ）が無いと content script はロードされない（エラーも出ないので「機能が壊れた」ように見える） |
| 同じ操作が 2 回走る・UI が二重に出る | 統合前の旧拡張が有効のまま。`chrome://extensions` で旧側を無効にする |
| ソースを直したのに挙動が変わらない | ①再ビルドしていない（`npm run build`）②ビルド後に `chrome://extensions` で拡張機能の再読み込みをしていない ③ページをリロードしていない。**この 3 つは全部必要** |
| `manifest.json` を直したのに反映されない | ページのリロードでは反映されない。`chrome://extensions` で**拡張自体の再読み込み**が必要 |
| バーは出るが対象の商品が 1 件も拾えない | サイト側の DOM が変わった可能性。定数ファイル（メルカリ `src/content/infra/constants.ts` / ラクマ `src/content/list/infra/constants.ts`）の `SELECTOR` と実際の DOM を突き合わせる。ラクマは商品リストがクライアント描画で `MutationObserver` 頼みなので、`list-observer.ts` が動いているかも見る |
| （メルカリ）設定が前回の値のまま／消えない | 保存先は `chrome.storage.local`。拡張機能を再読み込みしても消えない。消すには `chrome://extensions` で Service Worker を開き、コンソールで `chrome.storage.local.clear()`（**API キーも消える**） |
| （メルカリ）選択した商品・選択順がページをまたぐと消える | **選択状態は永続化していない**（メモリ上のみ）。現在の仕様 |
| （メルカリ）編集ページで「AIで説明文を作る」が出ない | ①`dist/edit.js` が無い ②出品フォームのないページを見ている ③サイト側の DOM が変わって説明欄を見つけられない（ページのコンソールに「説明欄が … 回の試行後も見つかりませんでした」が出る）。③なら `EDIT_SELECTOR` を実際の DOM と突き合わせる |
| （メルカリ）生成を押すと「APIキーが設定されていません」 | オプション画面で未設定（上記 4）。background 側のログは**ページのコンソールではなく `chrome://extensions` の Service Worker のコンソール**に出る |
| （ラクマ）`/sell` で「フリマアシストの再出品ボタンが見つかりません」 | フリマアシスト拡張が入っていない・無効・まだ注入前。`a#clone-item` は**ページ読み込み後に非同期で注入される** |
| （ラクマ）出品フォームを開いても自動でクリックされない | `data-rbl-form` を見る。`manual` なら**手動で開いたページと判定**（仕様）。無しなら content script が入っていない |
| （ラクマ）下書きが保存されず「内容が足りない」系の理由で失敗する | 差分チェック（`src/content/form/diff.ts`）が欠落を検知した。フリマアシストの画像アップロードが終わる前に判定された可能性。**仕様として正しい失敗** |
| （ラクマ）失敗したタブが開いたまま残る | **仕様。** バリデーションエラー等をユーザーが確認できるように残している |
| （ラクマ）処理が 5 分で打ち切られる | ウォッチドッグ（`ITEM_WATCHDOG_MS` = 300000ms）。1 商品の処理が終わらないときの保険 |
| （ラクマ）拡張機能を再読み込みしたらキューが消えた | キューは `chrome.storage.session` に保存されるが、**拡張の再読み込みでセッションごと消える**。Service Worker の破棄だけなら復元される |
| `npm run format:check` が落ちる | メルカリ側は**元から落ちている**（既存コードの未通過分）。ラクマ側で落ちたら自分の変更。全ファイルで落ちるなら改行コードを疑う（CLAUDE.md の「落とし穴」） |

## worktree を新しく作ったとき

1. ルートで `npm ci`（上記 1）
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
  git -C <worktree の絶対パス> status --short     # 空でなければ中身を確認してから
  git worktree remove <worktree の絶対パス>
  ```
  `git worktree remove` は未コミットの変更があると拒否される。**`--force` で消す前に、失うものが無いか必ず見る。** gitignore されたファイル（`.claude/settings.local.json`、`node_modules/`、`packages/*/dist/`）も一緒に消える。
- マージ後の作業ブランチと worktree の片付けは [merge スキル](../merge/SKILL.md) の「後始末」、まとめて掃除するときは [cleanup スキル](../cleanup/SKILL.md)。
