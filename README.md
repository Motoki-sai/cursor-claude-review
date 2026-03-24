# Claude PR Review（VS Code 拡張）

[English](#english) · 日本語（このページ上部）

[Claude Code](https://docs.anthropic.com/en/docs/claude-code) の CLI を使い、**GitHub の PR** または **ローカル／リモートブランチ間の差分**を、同梱の **review-master 相当の `SKILL.md`** に沿ってレビューし、結果をサイドバーの **Report** に表示する拡張機能です。

## 必要な環境

- **Visual Studio Code** 1.85 以降（互換エディタ可）
- **Claude Code CLI**（`claude` が `PATH` で実行できること）
- **GitHub PR レビュー時**: **GitHub CLI**（`gh`）のインストールと認証（`gh pr diff` が対象リポで動くこと）
- **ブランチレビュー時**: 対象フォルダーが **git リポジトリ**であること

API キーなどは拡張内に保存しません。Claude／`gh` の認証は各ツールの通常の方法（環境変数・OAuth 等）に従います。

## 主な機能

| 機能 | 説明 |
|------|------|
| **Run headless review** | 対話 UI を使わず `claude -p` でレビューを実行。PR 番号を入力し、`gh pr diff` で差分を取得してスキルに従ったレポートを生成します。 |
| **Review branch diff** | リモート追跡ブランチとローカルブランチを選び、`git diff remote…local`（merge-base）の差分を一時ファイルに書き、Claude に読ませてレビューします。 |
| **Open Claude Code** | ワークスペースを cwd にしたターミナルで `claude` を起動。対話セッションで `/review-master` 等を利用する場合向けです。 |
| **PR Review サイドバー** | アクティビティバーに **PR Review** を追加。ツリーから上記アクションを実行できます。 |
| **Report** | レビュー結果を **Markdown レンダリング**で表示。実行中は **進捗 UI**（パイプライン・タイムライン）を表示します（`liveStreamOutput` が有効なとき）。 |
| **出力チャンネル** | `Claude PR Review` にログ・stderr・整形済み進捗行を出力します。 |

### 「Run headless review」の意味

**Headless** = チャット画面を開かず、**CLI の非対話モード**（`claude -p`）で一回のプロンプト実行として動かすことです。スラッシュコマンド `/review-master` は対話専用のため、拡張では **`SKILL.md` を `--append-system-prompt-file` で渡し**、プロンプト側で `gh pr diff` や差分ファイルの読み取りを指示します。

## 使い方

1. レビューしたいリポジトリを **フォルダーとして開く**（マルチルートの場合は実行時にフォルダーを選択）。
2. 左のアクティビティバーで **PR Review** を開く。
3. **Run headless review** で PR 番号を入力、または **Review branch diff** でブランチを選択。
4. **Report** タブで結果と進捗を確認。詳細ログは **表示 → 出力 → Claude PR Review**。

コマンドパレット（`Cmd+Shift+P` / `Ctrl+Shift+P`）からも同じコマンドを実行できます。

## コマンド一覧

| コマンド ID | タイトル（英語） |
|-------------|------------------|
| `claudePrReview.reviewPr` | Claude PR Review: Run review-master on PR |
| `claudePrReview.reviewBranches` | Claude PR Review: Review diff between remote and local branch |
| `claudePrReview.openInteractive` | Claude PR Review: Open Claude Code (use /review-master) |

## 開発・ビルド

```bash
npm install
npm run compile
```

- **拡張機能のデバッグ**: このリポジトリを VS Code で開き、F5 で **Extension Development Host** を起動。
- **継続コンパイル**: `npm run watch`（`SKILL.md` を変えた後は `npm run compile` で `out/SKILL.md` にコピーされます）。

### VSIX のパッケージ（任意）

```bash
npx @vscode/vsce package
```

生成された `.vsix` を **拡張機能ビュー → … → Install from VSIX…** からインストールできます。

## スキルファイル

レビュー手順・レポート形式は **`src/SKILL.md`** にあり、ビルド時に **`out/SKILL.md`** にコピーされ拡張と同梱されます。内容を変えたら `npm run compile` を実行してください。

## 注意事項

- レビューは **補助**であり、マージ判断は人間が行う前提です。
- Claude や `gh` の **利用料・レート制限**は各サービス／契約に従います。
- 大きな差分では実行時間とトークン消費が増えます。

---

## English

A VS Code extension that uses the [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI to review **GitHub pull requests** or **diffs between local and remote-tracking branches**, following the bundled **review-master–style `SKILL.md`**, and shows results in the sidebar **Report** view.

### Requirements

- **Visual Studio Code** 1.85 or newer (or a compatible editor)
- **Claude Code CLI** (`claude` available on `PATH`)
- **For PR reviews**: **GitHub CLI** (`gh`) installed and authenticated so `gh pr diff` works in the target repo
- **For branch reviews**: the chosen folder must be a **git repository**

The extension does not store API keys or secrets. Use each tool’s normal auth (env vars, OAuth, etc.) for Claude and `gh`.

### Features

| Feature | Description |
|---------|-------------|
| **Run headless review** | Runs `claude -p` without the chat UI. You enter a PR number; the extension fetches the diff with `gh pr diff` and produces a skill-guided report. |
| **Review branch diff** | Pick a remote-tracking branch and a local branch; writes `git diff remote…local` (merge-base) to a temp file and has Claude read it for review. |
| **Open Claude Code** | Opens a terminal with `claude` in the workspace folder for interactive use (e.g. `/review-master`). |
| **PR Review sidebar** | Adds **PR Review** to the activity bar; run the actions from the tree. |
| **Report** | Renders review output as **Markdown**. While running, shows a **progress UI** (pipeline / timeline) when `liveStreamOutput` is enabled. |
| **Output channel** | Logs, stderr, and formatted progress lines go to **Claude PR Review**. |

#### What “Run headless review” means

**Headless** means running the **non-interactive CLI mode** (`claude -p`) as a single prompt, without opening the chat UI. The `/review-master` slash command is interactive-only, so the extension passes **`SKILL.md` via `--append-system-prompt-file`** and the prompt instructs `gh pr diff` or reading the diff file.

### Usage

1. **Open the repository folder** in the editor (multi-root: pick a folder when prompted).
2. Open **PR Review** in the activity bar.
3. Use **Run headless review** (enter PR number) or **Review branch diff** (pick branches).
4. Check **Report** for results and progress; use **View → Output → Claude PR Review** for detailed logs.

The same commands are available from the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`).

### Commands

| Command ID | Title |
|------------|-------|
| `claudePrReview.reviewPr` | Claude PR Review: Run review-master on PR |
| `claudePrReview.reviewBranches` | Claude PR Review: Review diff between remote and local branch |
| `claudePrReview.openInteractive` | Claude PR Review: Open Claude Code (use /review-master) |

### Development & build

```bash
npm install
npm run compile
```

- **Debug the extension**: Open this repo in VS Code and press F5 (**Extension Development Host**).
- **Watch mode**: `npm run watch` (after editing `SKILL.md`, run `npm run compile` to copy `src/SKILL.md` → `out/SKILL.md`).

#### Packaging a VSIX (optional)

```bash
npx @vscode/vsce package
```

Install the generated `.vsix` via **Extensions view → … → Install from VSIX…**.

### Skill file

Review workflow and report shape live in **`src/SKILL.md`**, copied to **`out/SKILL.md`** at build time and shipped with the extension. Run `npm run compile` after edits.

### Notes

- Reviews are **assistive**; humans should decide whether to merge.
- **Billing and rate limits** for Claude and `gh` follow your accounts and plans.
- Large diffs increase runtime and token usage.
