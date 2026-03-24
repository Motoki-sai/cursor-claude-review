import * as vscode from "vscode";

type WorkspaceFolderPick = vscode.QuickPickItem & { repoPath: string };

/** Single-root: that folder. Multi-root: quick pick. No folder: error. */
export async function pickWorkspaceRepoDir(): Promise<string | undefined> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) {
    vscode.window.showErrorMessage(
      "Open a folder workspace first (File > Open Folder). The PR is reviewed in that project directory."
    );
    return undefined;
  }
  if (folders.length === 1) {
    return folders[0].uri.fsPath;
  }
  const items: WorkspaceFolderPick[] = folders.map((f) => ({
    label: f.name,
    description: f.uri.fsPath,
    repoPath: f.uri.fsPath,
  }));
  const picked = await vscode.window.showQuickPick(items, {
    title: "Review target — workspace folder",
    placeHolder: "Choose the folder where gh pr diff should run",
  });
  return picked?.repoPath;
}
