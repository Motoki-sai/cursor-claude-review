import * as vscode from "vscode";
import { registerCommands } from "./commands/registerCommands";
import { PrReviewSidebarProvider } from "./views/sidebarTree";
import { ReviewReportWebviewProvider } from "./views/reportWebview";

export function activate(context: vscode.ExtensionContext): void {
  const reportProvider = new ReviewReportWebviewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ReviewReportWebviewProvider.viewId, reportProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  const sidebarProvider = new PrReviewSidebarProvider();
  const treeView = vscode.window.createTreeView("claudePrReview.sidebar", {
    treeDataProvider: sidebarProvider,
  });
  context.subscriptions.push(
    treeView,
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      sidebarProvider.refresh();
    })
  );

  context.subscriptions.push(...registerCommands(context, reportProvider));
}

export function deactivate(): void {}
