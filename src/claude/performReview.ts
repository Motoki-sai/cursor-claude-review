import * as path from "path";
import * as vscode from "vscode";
import { getConfig, resolveSkillPath } from "../config/settings";
import { formatByteSize } from "../util/format";
import { revealReportView } from "../util/revealReport";
import type { ReviewReportWebviewProvider } from "../views/reportWebview";
import { extractTextResult } from "./jsonOutput";
import { runClaudeHeadless } from "./runHeadless";
import { ReviewProgressAggregator } from "./reviewProgressModel";

export async function performHeadlessReview(params: {
  context: vscode.ExtensionContext;
  reportProvider: ReviewReportWebviewProvider;
  repoDir: string;
  prompt: string;
  progressTitle: string;
  reportSummary: string;
  channelPreamble: (channel: vscode.OutputChannel) => void;
}): Promise<void> {
  const { context, reportProvider, repoDir, prompt, progressTitle, reportSummary, channelPreamble } = params;

  const cfg = getConfig();
  const executable = cfg.get<string>("claudeExecutable", "claude");
  const skillConfigured = cfg.get<string>("skillPath", "");
  const skillPath = resolveSkillPath(skillConfigured, context.extensionPath);
  const allowedTools = cfg.get<string>("allowedTools", "Bash(gh *),Bash(git *),Read");
  const maxTurns = cfg.get<number>("maxTurns", 40);
  const liveStreamJson = cfg.get<boolean>("liveStreamOutput", true);

  if (!skillPath) {
    const pick = await vscode.window.showWarningMessage(
      "SKILL.md not found (run npm run compile to copy src/SKILL.md to out/), or set claudePrReview.skillPath, or install ~/.claude/skills/review-master/SKILL.md.",
      "Continue anyway",
      "Cancel"
    );
    if (pick !== "Continue anyway") {
      return;
    }
  }

  const channel = vscode.window.createOutputChannel("Claude PR Review");
  channel.show(true);
  channelPreamble(channel);

  await revealReportView();

  const aggregator = liveStreamJson ? new ReviewProgressAggregator((line) => channel.appendLine(line)) : undefined;
  if (aggregator) {
    aggregator.resetWithStart();
    reportProvider.setProgressSnapshot(aggregator.getSnapshot());
  } else {
    reportProvider.setLoading("Starting Claude Code…");
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: progressTitle,
      cancellable: false,
    },
    async (progress) => {
      channel.appendLine(`cwd: ${repoDir}`);
      channel.appendLine(`skill: ${skillPath ?? "(none)"}`);
      channel.appendLine(`claude: ${executable} -p ...`);
      channel.appendLine("");
      channel.appendLine(
        liveStreamJson ? "── Formatted progress log (stderr still prefixed with [stderr]) ──" : "── Live output (stdout / stderr) ──"
      );
      progress.report({ message: "Starting Claude Code…" });

      const result = await runClaudeHeadless({
        cwd: path.resolve(repoDir),
        executable,
        prompt,
        skillPath,
        allowedTools,
        maxTurns,
        outputFormat: cfg.get<"text" | "json">("outputFormat", "text"),
        liveStreamJson,
        outputChannel: channel,
        progressAggregator: aggregator,
        stream: {
          onProgress: (msg) => {
            progress.report({ message: msg.slice(0, 72) });
          },
          onProgressView: (snap) => {
            reportProvider.setProgressSnapshot(snap);
          },
        },
      });

      channel.appendLine("");
      channel.appendLine(
        `── End of stream · exit code ${result.code ?? "?"} · stdout ${formatByteSize(result.stdout.length)} · stderr ${formatByteSize(result.stderr.length)} ──`
      );

      let body = result.streamedBody?.trim();
      if (!body) {
        const extracted = extractTextResult(result.stdout.trim());
        body = extracted !== undefined ? extracted : result.stdout;
      }

      reportProvider.showReport({
        markdown: body || "(no stdout)",
        summary: reportSummary,
        exitCode: result.code,
        stderr: result.stderr,
      });
      await revealReportView();

      if (result.code !== 0) {
        vscode.window.showErrorMessage(
          `claude exited with code ${result.code}. See Report in the PR Review sidebar and the "Claude PR Review" output channel.`
        );
      } else {
        vscode.window.showInformationMessage("Review finished. Report is in PR Review → Report.");
      }
    }
  );
}
