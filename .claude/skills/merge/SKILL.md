---
name: merge
description: 作業ブランチを統合ブランチ develop に取り込む。取り込み後にもう一度テストと型チェックを回す。「マージして」「統合して」「取り込んで」「develop に入れて」と言われた時に使用
---

# 作業ブランチを develop に取り込む

規約の正本は [CLAUDE.md](../../../CLAUDE.md) の「ブランチ運用の補足」と [CONTRIBUTING.md](../../../CONTRIBUTING.md)。統合ブランチは **`develop`**、方式は **`--no-ff`**。

**マージは指示されたときだけ行う。** 既定の停止点はコミット（`start-task`）。自動でここまで進めない。

## 1. 取り込む前の前提（3 つとも満たすこと）

満たしていないものがあれば、**先に満たす。通っていないものを `develop` に入れない。**

1. **作業ツリーがクリーン** — `git status` で未コミット・未追跡が残っていないこと
2. **型チェック・ビルド・lint が通っている** — `quality-check` スキル（`npm run format:check` の既存 29 ファイルは対象外）
3. **セルフレビュー済み** — `self-review` スキルで Must が 0 件

## 2. マージする

```bash
git switch develop
git pull --ff-only                       # ここで失敗したら develop が分岐している（下記参照）
git merge --no-ff <作業ブランチ> -m 'merge: <何を取り込んだか>'
```

- **`--no-ff` を省かない。** 早送りされると作業単位が履歴に残らず、何をひとまとまりでやったか後から追えなくなる。
- `git pull --ff-only` が失敗したら `develop` が分岐している。**勝手にマージや rebase をせず、報告して指示を仰ぐ。**

### worktree を使っているときの注意

このリポジトリは worktree 運用。**`git switch develop` は、`develop` を別の worktree が既にチェックアウトしていると `already checked out` で失敗する。**

```bash
git worktree list | grep develop    # どの worktree が持っているか確認
```

- 持っている worktree があるなら、**そのディレクトリに移動して**マージする（`cd` はサブシェル `(cd dir && ...)` にして持ち越さない）。
- どこも持っていないなら、いまの worktree で `git switch develop` してよい。ただし**その worktree が `develop` を占有する**ので、作業が終わったら元のブランチに戻す。

## 3. マージ後にもう一度テストと型チェックを回す

**ここを飛ばさない。** それぞれのブランチで通っていても、合流した状態では通らないことがある（意味的な衝突）。

```bash
npx tsc --noEmit
npm run build
npm run lint
```

落ちたら直してから次に進む。**落ちたまま放置しない。**

## 4. コンフリクトしたとき

- **どちらの意図も読んでから解消する。片側を機械的に採用しない。** `--ours` / `--theirs` で流さない。
- 解消したら `git diff` で結果を読む。**読まずに `git add` しない。**
- テストと型チェックを回してから `git commit`。
- **手に負えないと判断したら戻して報告する:**

  ```bash
  git merge --abort
  ```

  中途半端な解消を `develop` に残すより、戻して相談するほうがよい。

## 5. 後始末

```bash
git branch -d <作業ブランチ>
```

- **`-D` は使わない。** `-d` が拒否するのは「まだマージされていない」というサイン。拒否されたらマージできているか確認する。
- **作業ブランチは origin に push しない運用**なので、リモート側の削除は不要。
- **worktree も片付ける。** ブランチ 1 本につき worktree が 1 つ占有されている:

  ```bash
  git worktree list                        # 対象の worktree を確認
  git worktree remove <パス>               # 未コミットの変更が残っていると拒否される
  ```

  拒否されたら中身を確認する。**`--force` で消す前に、失うものが無いか必ず見る。**

## やらないこと

- **`develop` で `git reset --hard` / `git push --force` をしない。** 取り消したいときは `git revert`（履歴を書き換えず、何を戻したかが残る）。
- どうしても force が必要なら `--force-with-lease` を使い、**実行前に理由を報告して指示を仰ぐ**。

## 報告に入れるもの

- マージ方式（`--no-ff`）とマージコミットのハッシュ
- **マージ後**のテストと型チェックの結果（マージ前の結果と混同しない）
- コンフリクトの有無と、あったなら解消方針
- 削除した作業ブランチと worktree
