import * as vscode from "vscode";
import { execGit } from "./exec";

export async function gitBranchNames(cwd: string, remote: boolean): Promise<string[] | undefined> {
  const args = remote ? (["branch", "-r", "--format=%(refname:short)"] as const) : (["branch", "--format=%(refname:short)"] as const);
  const r = await execGit(cwd, [...args]);
  if (r.code !== 0) {
    vscode.window.showErrorMessage(`git failed: ${r.stderr.trim() || r.stdout || "unknown error"}`);
    return undefined;
  }
  const names = r.stdout
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.endsWith("/HEAD"));
  return [...new Set(names)];
}

export async function pickGitBranch(cwd: string, title: string, remote: boolean): Promise<string | undefined> {
  const names = await gitBranchNames(cwd, remote);
  if (!names?.length) {
    vscode.window.showErrorMessage(remote ? "No remote-tracking branches found." : "No local branches found.");
    return undefined;
  }
  names.sort((a, b) => a.localeCompare(b));
  const picked = await vscode.window.showQuickPick(names, {
    title,
    placeHolder: remote ? "Remote-tracking branch (e.g. origin/main)" : "Local branch",
  });
  return picked;
}
