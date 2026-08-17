# コントリビューションガイド

## 開発フロー

```
main       ← リリース済み安定版（直接コミット禁止）
develop    ← 開発の統合ブランチ
feature/*  ← 機能追加
fix/*      ← バグ修正
docs/*     ← ドキュメント
refactor/* ← リファクタリング
```

1. `develop` から作業ブランチを切る
2. 作業ブランチで開発・コミット
3. `develop` へ **rebase してから `--ff-only`** で取り込む（マージコミットを作らない）
4. 適切なタイミングで `develop` → `main` へ取り込む

```bash
git switch develop && git pull --ff-only
git switch -c feature/your-feature-name

# 作業後（詳細な手順は .claude/skills/merge/SKILL.md）
git rebase develop
git switch develop
git merge --ff-only feature/your-feature-name
git branch -d feature/your-feature-name
```

作業ブランチは origin に push しない（ローカル限りの運用）。

## ブランチ命名規則

ハイフン区切りの英小文字。日付・イニシャル・連番は入れない。**`feature/` を既定にせず、中身で選ぶ。**

| 種別 | 命名例 |
|------|--------|
| 機能追加 | `feature/add-bulk-delete` |
| バグ修正 | `fix/relist-button-selector` |
| ドキュメント | `docs/update-architecture` |
| リファクタリング | `refactor/queue-manager` |

## コミットメッセージ

**コミットメッセージは基本的に英語で記述する。**

以下のプレフィックスを付ける。

| プレフィックス | 用途 |
|--------------|------|
| `feat:` | 新しい機能の追加 |
| `fix:` | バグの修正 |
| `docs:` | ドキュメントのみの変更 |
| `style:` | 空白・フォーマット・セミコロン追加など、動作に影響しない変更 |
| `refactor:` | 仕様に影響がないコード改善（リファクタリング） |
| `perf:` | パフォーマンス向上に関する変更 |
| `test:` | テストの追加・修正 |
| `chore:` | ビルド・補助ツール・ライブラリなど開発環境に関する変更 |

```
# 例
feat: add bulk publish button to draft page
fix: correct selector for relist button
docs: update CLAUDE.md with branch strategy
```

scope の付け方・件名の字数・コミット日時の扱いは [CLAUDE.md](CLAUDE.md) の「件名の書き方の補足」と「コミット日時」を参照。

## コードスタイル

コミット前に以下を実行してください。

```bash
npm run lint           # ESLint（通るのが正常）
npx tsc --noEmit       # 型チェック（通るのが正常）
npm run build          # ビルド（通るのが正常）
npm run format:check   # Prettier（通るのが正常）
```

`format:check` が落ちたら、**自分が触ったファイルだけ**直す。

```bash
npx prettier --write <触ったファイル>
```

`npm run format` でリポジトリ全体を一括整形しないこと（差分が膨れて本来の変更が埋もれる）。改行コードは [.gitattributes](.gitattributes) で LF に固定してあり、これが崩れると全ファイルが差分として報告される（[CLAUDE.md](CLAUDE.md) の「落とし穴」）。

主なルール（ESLint / tsconfig で強制）:
- `any` 型の使用禁止
- 関数の戻り値の型を明示
- 文字列はシングルクォート、文末セミコロン必須
- 未使用 import の禁止
