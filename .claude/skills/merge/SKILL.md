---
name: merge
description: 作業ブランチを統合ブランチ develop に取り込む。取り込み後にもう一度型チェック・ビルド・lint を回す。「マージして」「統合して」「取り込んで」「develop に入れて」と言われた時に使用
---

# 作業ブランチを develop に取り込む

規約の正本は [CLAUDE.md](../../../CLAUDE.md) の「ブランチ運用の補足」と [CONTRIBUTING.md](../../../CONTRIBUTING.md)。統合ブランチは **`develop`**、方式は **rebase してから `--ff-only`**（マージコミットを作らず履歴を直線に保つ）。

**マージは指示されたときだけ行う。** 既定の停止点はコミット（`start-task`）。自動でここまで進めない。

## 1. 取り込む前の前提（3 つとも満たすこと）

満たしていないものがあれば、**先に満たす。通っていないものを `develop` に入れない。**

1. **作業ツリーがクリーン** — `git status` で未コミット・未追跡が残っていないこと
2. **型チェック・ビルド・lint が通っている** — `quality-check` スキル（`npm run check`。`format:check` はメルカリの既存分の失敗だけ対象外）
3. **セルフレビュー済み** — `self-review` スキルで Must が 0 件

## 2. rebase してから早送りで取り込む

**マージコミットを作らない。** 履歴は直線に保つ。

```bash
git fetch origin develop                  # origin が設定されている場合
git switch develop && git pull --ff-only  # origin と同期しているなら先に追いつかせる
git switch <作業ブランチ>
git rebase develop                        # develop が進んでいれば載せ替える
git switch develop
git merge --ff-only <作業ブランチ>        # 早送りのみ。マージコミットは作られない
```

- **origin が無い間（GitHub 作成前）は `fetch` / `pull` を飛ばす。** `git remote -v` で確認する。
- `git pull --ff-only` が失敗したら `develop` が分岐している。**勝手にマージせず、報告して指示を仰ぐ。**
- **取り込んだ `develop` を origin へ push するかは人が判断する。** 頼まれていないなら push しない。
- **`--ff-only` を使い、`--no-ff` を付けない。** `--no-ff` は早送りできる場合でもマージコミットを作るオプション。
- **`git merge --ff-only` が失敗したら、rebase が済んでいないサイン。** その場でマージに切り替えず、`git rebase develop` に戻る。
- **rebase 中にコンフリクトしたら、解消して `git rebase --continue`。** 手に負えなければ `git rebase --abort` で戻して報告する（下記「4. コンフリクトしたとき」と同じ判断）。
- **rebase はコミットのハッシュを変える。** 作業ブランチを push 済みの場合は実行前に確認を取る（このリポジトリは作業ブランチを push しない運用なので通常は問題にならない）。
- rebase 後は**コミット日時が実時間に戻る**。[CLAUDE.md](../../../CLAUDE.md) の「コミット日時」に従って 10 分刻みに直してから早送りする。

### worktree を使っているときの注意

**`git switch develop` は、`develop` を別の worktree が既にチェックアウトしていると `already checked out` で失敗する。**

```bash
git worktree list    # どの worktree がどのブランチを持っているか確認
```

- 持っている worktree があるなら、**そのディレクトリに移動して**マージする（`cd` はサブシェル `(cd dir && ...)` にして持ち越さない）。
- どこも持っていないなら、いまの worktree で `git switch develop` してよい。ただし**その worktree が `develop` を占有する**ので、作業が終わったら元のブランチに戻す。

## 3. マージ後にもう一度型チェック・ビルド・lint を回す

**ここを飛ばさない。** それぞれのブランチで通っていても、合流した状態では通らないことがある（意味的な衝突）。

```bash
npm run check
```

落ちたら直してから次に進む。**落ちたまま放置しない。**

## 4. コンフリクトしたとき

- **どちらの意図も読んでから解消する。片側を機械的に採用しない。** `--ours` / `--theirs` で流さない。
- 解消したら `git diff` で結果を読む。**読まずに `git add` しない。**
- 型チェックとビルドを回してから `git commit`。
- **手に負えないと判断したら戻して報告する:**

  ```bash
  git rebase --abort     # または git merge --abort
  ```

  中途半端な解消を `develop` に残すより、戻して相談するほうがよい。

## 5. 後始末

```bash
git branch -d <作業ブランチ>
```

- **`-D` は使わない。** `-d` が拒否するのは「まだマージされていない」というサイン。拒否されたらマージできているか確認する。
- **作業ブランチは origin に push しない運用**なので、リモート側の削除は不要。
- **worktree を使っていたなら worktree も片付ける。** ブランチ 1 本につき worktree が 1 つ占有されている:

  ```bash
  git worktree list                        # 対象の worktree を確認
  git worktree remove <パス>               # 未コミットの変更が残っていると拒否される
  ```

  拒否されたら中身を確認する。**`--force` で消す前に、失うものが無いか必ず見る。**

## やらないこと

- **マージコミットを作らない。** `--no-ff` を使わない。`git merge` が早送りできないなら、それは rebase が済んでいないサイン。
- **`develop` → `main` の取り込みを勝手にやらない。** `main` はリリース済みブランチ。人が判断する。
- **push 済みのブランチで `git reset --hard` / `git push --force` をしない。** 取り消したいときは `git revert`（履歴を書き換えず、何を戻したかが残る）。
  - **例外: まだ push していないローカルコミットだけを巻き戻す場合は `reset --hard` を使ってよい。** **戻す先のコミットを `git log` で見てから**実行する。push 済みの範囲に入る巻き戻しは対象外。
- どうしても force が必要なら `--force-with-lease` を使い、**実行前に理由を報告して指示を仰ぐ**。

## 報告に入れるもの

- 取り込み方式（rebase + `--ff-only`）と、取り込み後の `develop` の先端ハッシュ
- **マージ後**の型チェック・ビルド・lint の結果（マージ前の結果と混同しない）
- コンフリクトの有無と、あったなら解消方針
- 削除した作業ブランチと worktree
