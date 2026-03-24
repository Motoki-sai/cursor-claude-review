import { spawn } from "child_process";

export function execGit(cwd: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    const child = spawn("git", args, {
      cwd,
      env: { ...process.env },
      shell: false,
    });
    child.stdout?.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    child.on("error", (err: NodeJS.ErrnoException) => {
      stderr += err.message;
      resolve({ stdout, stderr, code: null });
    });
    child.on("close", (code) => {
      resolve({ stdout, stderr, code });
    });
  });
}
