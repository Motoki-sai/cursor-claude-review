import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

export const DEFAULT_SKILL_REL = path.join(".claude", "skills", "review-master", "SKILL.md");

export function getConfig(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration("claudePrReview");
}

export function bundledSkillPath(extensionPath: string): string {
  return path.join(extensionPath, "out", "SKILL.md");
}

/** User override → bundled src/SKILL.md (copied to out/) → ~/.claude/skills/review-master/SKILL.md */
export function resolveSkillPath(configured: string, extensionPath: string): string | undefined {
  const trimmed = configured.trim();
  if (trimmed) {
    const expanded = trimmed.replace(/^~(?=\/|\\)/, os.homedir());
    return fs.existsSync(expanded) ? expanded : undefined;
  }
  const bundled = bundledSkillPath(extensionPath);
  if (fs.existsSync(bundled)) {
    return bundled;
  }
  const home = path.join(os.homedir(), DEFAULT_SKILL_REL);
  return fs.existsSync(home) ? home : undefined;
}
