---
name: commit
description: 変更を git commit する。品質チェックを通したうえで規約どおりの英語コミットメッセージを作成する。「コミットして」「commit して」「変更を記録して」と言われた時に使用
---

# コミットする

規約の正本は [CONTRIBUTING.md](../../../CONTRIBUTING.md)（プレフィックス 8 種・コードスタイル）と [CLAUDE.md](../../../CLAUDE.md)（scope・件名の書き方）。**このリポジトリのコミットメッセージは英語で書く。**

**このスキルはコミットまで。** ブランチを切る・マージする・push するのは範囲外（頼まれない限りやらない）。

## 1. 品質チェックを通す

`quality-check` スキルを実行する。**通らないならコミットしない。**

- `npx tsc --noEmit` / `npm run build` / `npm run lint` は**通るのが正常**。落ちているならコミットしない。
- 例外は `npm run format:check` の**既存分の失敗**のみ（元から 29 ファイル落ちている）。自分が触ったファイルが指摘に増えていたら、そのファイルだけ直す。

## 2. 変更を確認する（3 つとも見る）

```bash
git status
git diff
git diff --staged
```

- **未追跡の新規ファイルは `git diff` にも `git diff --staged` にも出ない。** `git status` に出たものは中身を開く。差分で見たいなら `git add -N <パス> && git diff`（`-N` は内容をステージしないので、後続の add 対象は変わらない）。
- **index に今回と関係ない変更が残っていないか確認する。** `git commit` は index にあるものを全部記録するため、前の作業で add したものが黙って混ざる。混ざっていたら `git restore --staged -- <パス>`（作業ツリーの変更は残る）。

## 3. add する

- **裸の `git add -A` / `git add .` を使わない。** 一時ファイルや他の作業を巻き込む。パス指定で add する（`git add -A -- <パス>` は可）。
- **動作確認用の一時設定を作業ツリーに置いている間はとくに `-A` を使わない。** 個人環境の絶対パスを含む起動設定などを混ぜてコミットしてしまう。足した時点で「後で `git checkout <file>` で戻す」と決めておく。
- **リネーム・削除は旧パス（消える側）も add する。** ディレクトリをまたぐリネームでは新パス側のディレクトリ指定だけでは旧パスの削除が入らない:
  ```bash
  git add -A -- <旧パス> <新パス>
  ```
- 混ぜないもの:
  - `.env` / API キー・トークン・顧客データを含むファイル
  - `dist/`（gitignore 済みだが、ビルド後は存在する）
  - `.claude/settings.local.json`（gitignore 済み。worktree ごとの個人設定）
  - `node_modules/`
- このリポジトリで**コミット対象になる `.claude/` 配下**は `.claude/skills/` と `.claude/settings.json` のみ（`.gitignore` がホワイトリスト方式）。

## 4. メッセージを書く

```
<prefix>(<scope>): <subject>
```

- prefix は CONTRIBUTING.md の **8 種**（`feat:` / `fix:` / `docs:` / `style:` / `refactor:` / `perf:` / `test:` / `chore:`）から選ぶ。独自に増やさない。
- scope は CLAUDE.md の閉じた選択肢から選ぶ（`content` / `infra` / `logic` / `ui` / `popup` / `common` / `manifest` / `build` / `docs`）。複数に跨るときは付けない。
- 件名は**動詞の原形**で始め、先頭は小文字、末尾にピリオドを打たない。**50 字以内**（`<prefix>(<scope>): ` は含めない）。
- **「何を」「どうした」を両方入れる。**
- 本文は任意。書くなら**なぜそうしたか**を書く（差分を読めば分かるファイル列挙は書かない）。
- **`Co-Authored-By` と生成表示（「🤖 Generated with Claude Code」等）を付けない。**

バッククォートや複数行を含む本文は、**一時ファイルに書いて `git commit -F <file>`**（シェルで壊れるため）:

```bash
git commit -F "$SCRATCHPAD/commit-msg.txt"
```

## 5. 単位を守る

大きな変更は論理的な単位に分ける。無関係な変更を 1 コミットに混ぜない。とくに、**既存コードの format 修正を機能変更と同じコミットに入れない**（`style:` で分ける）。
