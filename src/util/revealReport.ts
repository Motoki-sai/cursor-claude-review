import * as vscode from "vscode";

export async function revealReportView(): Promise<void> {
  try {
    await vscode.commands.executeCommand("claudePrReview.report.focus");
  } catch {
    await vscode.commands.executeCommand("workbench.view.extension.claude-pr-review");
  }
}
