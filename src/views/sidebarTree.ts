import * as vscode from "vscode";

export class PrReviewSidebarProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): vscode.ProviderResult<vscode.TreeItem[]> {
    const folders = vscode.workspace.workspaceFolders;

    const info = new vscode.TreeItem("Review directory", vscode.TreeItemCollapsibleState.None);
    info.iconPath = new vscode.ThemeIcon("folder");
    if (!folders?.length) {
      info.description = "No folder open";
      info.tooltip = new vscode.MarkdownString("Open a folder with **File → Open Folder** so `gh pr diff` runs in that repo.");
    } else if (folders.length === 1) {
      info.description = folders[0].name;
      info.tooltip = folders[0].uri.fsPath;
    } else {
      info.description = `${folders.length} folders — pick when running`;
      info.tooltip = folders.map((f) => `${f.name}: ${f.uri.fsPath}`).join("\n\n");
    }

    const run = new vscode.TreeItem("Run headless review", vscode.TreeItemCollapsibleState.None);
    run.iconPath = new vscode.ThemeIcon("play");
    run.command = { command: "claudePrReview.reviewPr", title: "Run headless review" };
    run.tooltip = "GitHub PR via gh pr diff + Claude headless";

    const branchReview = new vscode.TreeItem("Review branch diff", vscode.TreeItemCollapsibleState.None);
    branchReview.iconPath = new vscode.ThemeIcon("git-branch");
    branchReview.command = { command: "claudePrReview.reviewBranches", title: "Review branch diff" };
    branchReview.tooltip = "git diff remote…local (merge-base) + Claude headless";

    const openClaude = new vscode.TreeItem("Open Claude Code", vscode.TreeItemCollapsibleState.None);
    openClaude.iconPath = new vscode.ThemeIcon("terminal");
    openClaude.command = { command: "claudePrReview.openInteractive", title: "Open Claude Code" };
    openClaude.tooltip = "Interactive terminal in the workspace folder; use /review-master";

    return [info, run, branchReview, openClaude];
  }
}
