---
name: commit
description: 変更を git commit する。品質チェックを通したうえで規約どおりの英語コミットメッセージを作成する。「コミットして」「commit して」「変更を記録して」と言われた時に使用
---

# コミットする

規約の正本は [CONTRIBUTING.md](../../../CONTRIBUTING.md)（プレフィックス 8 種・コードスタイル）と [CLAUDE.md](../../../CLAUDE.md)（scope・件名の書き方）。**このリポジトリのコミットメッセージは英語で書く。**

**このスキルはコミットまで。** マージと push は範囲外（頼まれない限りやらない）。マージは `merge` スキル。

## 1. ブランチを確認する

```bash
git branch --show-current
```

**`develop` と `main` に直接コミットしない。** いる場合は、いったんブランチを切ってからコミットする（作業ツリーの変更は保持される）:

```bash
git switch -c <feature|fix|docs|refactor>/<英小文字の短い説明>
```

自動命名のブランチ（`claude/...`、`worktree-...`）にいるなら、コミットする前に規約名へ直す:

```bash
git branch -m <規約名>
```

命名規約は [CLAUDE.md](../../../CLAUDE.md) の「ブランチ運用の補足」（`feature/` を既定にせず、中身で選ぶ）。

## 2. 品質チェックを通す

`quality-check` スキルを実行する。**通らないならコミットしない。**

- `npx tsc --noEmit` / `npm run build` / `npm run lint` / `npm run format:check` は**4 つとも通るのが正常**。落ちているならコミットしない。
- `format:check` が落ちたら、触ったファイルだけ `npx prettier --write <パス>` で直す（全体を `npm run format` しない）。

## 3. 変更を確認する（3 つとも見る）

```bash
git status
git diff
git diff --staged
```

- **未追跡の新規ファイルは `git diff` にも `git diff --staged` にも出ない。** `git status` に出たものは中身を開く。差分で見たいなら `git add -N <パス> && git diff`（`-N` は内容をステージしないので、後続の add 対象は変わらない）。
- **index に今回と関係ない変更が残っていないか確認する。** `git commit` は index にあるものを全部記録するため、前の作業で add したものが黙って混ざる。混ざっていたら `git restore --staged -- <パス>`（作業ツリーの変更は残る）。

## 4. add する

- **裸の `git add -A` / `git add .` を使わない。** 一時ファイルや他の作業を巻き込む。パス指定で add する（`git add -A -- <パス>` は可）。
- **動作確認用の一時設定を作業ツリーに置いている間はとくに `-A` を使わない。** 個人環境の絶対パスを含む起動設定などを混ぜてコミットしてしまう。足した時点で「後で `git checkout <file>` で戻す」と決めておく。
- **リネーム・削除は旧パス（消える側）も add する。** ディレクトリをまたぐリネームでは新パス側のディレクトリ指定だけでは旧パスの削除が入らない:
  ```bash
  git add -A -- <旧パス> <新パス>
  ```
- 混ぜないもの:
  - `.env` / API キー・トークン・個人情報を含むファイル
  - `dist/`（gitignore 済みだが、ビルド後は存在する）
  - `.claude/settings.local.json`（gitignore 済み。worktree ごとの個人設定）
  - `node_modules/`
- このリポジトリで**コミット対象になる `.claude/` 配下**は `.claude/skills/` と `.claude/settings.json` のみ（`.gitignore` がホワイトリスト方式）。`.claude/worktrees/` は除外される。

## 5. メッセージを書く

```
<prefix>(<scope>): <subject>
```

- prefix は CONTRIBUTING.md の **8 種**（`feat:` / `fix:` / `docs:` / `style:` / `refactor:` / `perf:` / `test:` / `chore:`）から選ぶ。独自に増やさない。
- scope は CLAUDE.md の閉じた選択肢から選ぶ（`background` / `list` / `edit` / `content` / `common` / `popup` / `manifest` / `build` / `docs`）。複数に跨るときは付けない。
- 件名は**動詞の原形**で始め、先頭は小文字、末尾にピリオドを打たない。**50 字以内**（`<prefix>(<scope>): ` は含めない）。
- **「何を」「どうした」を両方入れる。**
- 本文は任意。書くなら**なぜそうしたか**を書く（差分を読めば分かるファイル列挙は書かない）。
- **`Co-Authored-By` と生成表示（「🤖 Generated with Claude Code」等）を付けない。**

バッククォートや複数行を含む本文は、**スクラッチパッドに一時ファイルを書いて `git commit -F <file>`**（シェルで壊れるため）。

## 6. コミット日時を揃える

**このリポジトリのコミット日時は実時間を使わない。既定でこれを行う**（規約は [CLAUDE.md](../../../CLAUDE.md) の「コミット日時」）。コミットした直後に、直前のコミットの 10 分後へ揃える。

```bash
git --no-pager log -1 --format=%cI HEAD~1              # 親の日時を確認
NEW_DATE="2026-08-17T23:41:14+09:00"                   # 親が 23:31:14 ならこれ
GIT_COMMITTER_DATE="$NEW_DATE" git commit --amend --no-edit --date="$NEW_DATE"
```

- **`--date` だけでは author date しか変わらない。** committer date が実時間のまま残るので `GIT_COMMITTER_DATE` と併用する。
- 連続して複数コミットするときは 1 本ごとに 10 分進める。
- **push 済みのコミットには実行しない。** amend でハッシュが変わる。`main` は origin と同期しているので、そこに入ったコミットは対象外。必要なら実行前に理由を報告して指示を仰ぐ。
- 揃えた結果を `git log --format='%h %cI %s'` で確認し、報告に書く。

## 7. 単位を守る

大きな変更は論理的な単位に分ける。無関係な変更を 1 コミットに混ぜない。とくに、**既存コードの format 修正を機能変更と同じコミットに入れない**（`style:` で分ける）。
