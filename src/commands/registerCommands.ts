import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { getConfig } from "../config/settings";
import { buildBranchReviewPrompt, buildReviewPrompt } from "../claude/prompts";
import { performHeadlessReview } from "../claude/performReview";
import { execGit } from "../git/exec";
import { pickGitBranch } from "../git/branches";
import { pickWorkspaceRepoDir } from "../workspace/pickFolder";
import type { ReviewReportWebviewProvider } from "../views/reportWebview";

export function registerCommands(
  context: vscode.ExtensionContext,
  reportProvider: ReviewReportWebviewProvider
): vscode.Disposable[] {
  const reviewCmd = vscode.commands.registerCommand("claudePrReview.reviewPr", async () => {
    const repoDir = await pickWorkspaceRepoDir();
    if (!repoDir) {
      return;
    }

    const pr = await vscode.window.showInputBox({
      title: "Pull request number",
      prompt: "GitHub PR number (e.g. 42).",
      validateInput: (v) => {
        const t = v.trim();
        if (!/^\d+$/.test(t)) {
          return "Enter a numeric PR number.";
        }
        return undefined;
      },
    });
    if (!pr?.trim()) {
      return;
    }

    await performHeadlessReview({
      context,
      reportProvider,
      repoDir,
      prompt: buildReviewPrompt(pr.trim()),
      progressTitle: `Claude PR review (PR #${pr.trim()})`,
      reportSummary: `PR #${pr.trim()}`,
      channelPreamble: (ch) => {
        ch.appendLine("mode: GitHub PR (gh pr diff)");
      },
    });
  });

  const reviewBranchesCmd = vscode.commands.registerCommand("claudePrReview.reviewBranches", async () => {
    const repoDir = await pickWorkspaceRepoDir();
    if (!repoDir) {
      return;
    }

    const remoteRef = await pickGitBranch(path.resolve(repoDir), "Remote branch (base)", true);
    if (!remoteRef) {
      return;
    }

    const localRef = await pickGitBranch(path.resolve(repoDir), "Local branch (compare)", false);
    if (!localRef) {
      return;
    }

    const resolvedCwd = path.resolve(repoDir);
    const diffResult = await execGit(resolvedCwd, ["diff", `${remoteRef}...${localRef}`]);
    if (diffResult.code !== 0) {
      vscode.window.showErrorMessage(`git diff failed: ${diffResult.stderr.trim() || diffResult.stdout || "unknown error"}`);
      return;
    }
    if (!diffResult.stdout.trim()) {
      vscode.window.showInformationMessage(`No changes between ${remoteRef} and ${localRef} (merge-base diff).`);
      return;
    }

    const tmp = path.join(os.tmpdir(), `claude-pr-review-${Date.now()}.diff`);
    try {
      fs.writeFileSync(tmp, diffResult.stdout, "utf8");
      await performHeadlessReview({
        context,
        reportProvider,
        repoDir: resolvedCwd,
        prompt: buildBranchReviewPrompt(remoteRef, localRef, tmp),
        progressTitle: `Branch review: ${localRef} vs ${remoteRef}`,
        reportSummary: `Branches: ${remoteRef} … ${localRef}`,
        channelPreamble: (ch) => {
          ch.appendLine("mode: git branch diff (merge-base)");
          ch.appendLine(`git diff ${remoteRef}...${localRef}`);
          ch.appendLine(`diff size (chars): ${diffResult.stdout.length}`);
          ch.appendLine(`diff file: ${tmp}`);
        },
      });
    } finally {
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* ignore */
      }
    }
  });

  const interactiveCmd = vscode.commands.registerCommand("claudePrReview.openInteractive", async () => {
    const repoDir = await pickWorkspaceRepoDir();
    if (!repoDir) {
      return;
    }

    const pr = await vscode.window.showInputBox({
      title: "Pull request number (hint)",
      prompt: "Optional: we print a reminder to use /review-master for this PR.",
      value: "",
    });

    const cfg = getConfig();
    const executable = cfg.get<string>("claudeExecutable", "claude");
    const term = vscode.window.createTerminal({
      name: "Claude PR Review",
      cwd: path.resolve(repoDir),
    });
    term.show();
    term.sendText(executable, true);
    const hint =
      pr?.trim() ?
        `In Claude Code, run /review-master for PR #${pr.trim()} (per ~/.claude/skills/review-master/SKILL.md).`
      : "In Claude Code, run /review-master and specify the PR (per your review-master skill).";
    vscode.window.showInformationMessage(hint);
  });

  return [reviewCmd, reviewBranchesCmd, interactiveCmd];
}
