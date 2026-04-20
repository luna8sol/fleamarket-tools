# コントリビューションガイド

## 開発フロー

```
main      ← リリース済み安定版（直接コミット禁止）
develop   ← 開発の統合ブランチ
feature/* ← 機能追加
fix/*     ← バグ修正
docs/*    ← ドキュメント
```

1. `develop` から作業ブランチを切る
2. 作業ブランチで開発・コミット
3. `develop` へマージ
4. 適切なタイミングで `develop` → `main` へマージ

```bash
git checkout develop
git checkout -b feature/your-feature-name

# 作業後
git checkout develop
git merge feature/your-feature-name
```

## ブランチ命名規則

| 種別 | 命名例 |
|------|--------|
| 機能追加 | `feature/add-bulk-publish` |
| バグ修正 | `fix/relist-button-selector` |
| ドキュメント | `docs/update-architecture` |
| リファクタリング | `refactor/selection-manager` |

## コミットメッセージ

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

## コードスタイル

コミット前に以下を実行してください。

```bash
npm run lint:fix   # ESLint 自動修正
npm run format     # Prettier フォーマット
```

主なルール（ESLint / tsconfig で強制）:
- `any` 型の使用禁止
- 関数の戻り値の型を明示
- 文字列はシングルクォート、文末セミコロン必須
- 未使用 import の禁止
