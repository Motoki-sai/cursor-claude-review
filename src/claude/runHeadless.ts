import * as vscode from "vscode";
import { spawn } from "child_process";
import type { ProgressSnapshot } from "../views/progressTypes";
import { applyStreamJsonLine, resolvedStreamBody, type StreamJsonAccum } from "./streamJsonEvents";
import type { ReviewProgressAggregator } from "./reviewProgressModel";

type ClaudeStreamCallbacks = {
  onProgress?: (message: string) => void;
  onProgressView?: (snapshot: ProgressSnapshot) => void;
};

/** Strip common ANSI SGR sequences (Claude CLI often colors stderr). */
function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

const PROGRESS_MAX = 160;

function lastNonEmptyLine(buf: string): string | undefined {
  const lines = stripAnsi(buf).split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i]?.trim() ?? "";
    if (t.length > 0) {
      return t.length > PROGRESS_MAX ? `${t.slice(0, PROGRESS_MAX - 1)}…` : t;
    }
  }
  return undefined;
}

function tailOneLine(buf: string): string {
  const oneLine = stripAnsi(buf).replace(/\s+/g, " ").trim();
  if (!oneLine) {
    return "";
  }
  return oneLine.length > PROGRESS_MAX ? `…${oneLine.slice(-(PROGRESS_MAX - 1))}` : oneLine;
}

function progressFromBuffers(stderrBuf: string, stdoutBuf: string): string {
  const primary = lastNonEmptyLine(stderrBuf) ?? lastNonEmptyLine(stdoutBuf) ?? tailOneLine(stderrBuf);
  return primary || tailOneLine(stdoutBuf) || "Running…";
}

function progressFromLive(stderrBuf: string, acc: StreamJsonAccum): string {
  const tool = acc.lastToolHint?.trim();
  if (tool) {
    return tool.length > PROGRESS_MAX ? `${tool.slice(0, PROGRESS_MAX - 1)}…` : tool;
  }
  const td = acc.textDeltas.replace(/\s+/g, " ").trimEnd();
  if (td.length > 0) {
    return td.length > PROGRESS_MAX ? `…${td.slice(-(PROGRESS_MAX - 1))}` : td;
  }
  return lastNonEmptyLine(stderrBuf) ?? "Running…";
}

export type ClaudeRunResult = {
  stdout: string;
  stderr: string;
  code: number | null;
  streamedBody?: string;
};

export function runClaudeHeadless(args: {
  cwd: string;
  executable: string;
  prompt: string;
  skillPath?: string;
  allowedTools: string;
  maxTurns: number;
  outputFormat: "text" | "json";
  liveStreamJson: boolean;
  outputChannel?: vscode.OutputChannel;
  /** When set with liveStreamJson, drives fancy Report UI + formatted channel lines */
  progressAggregator?: ReviewProgressAggregator;
  stream?: ClaudeStreamCallbacks;
}): Promise<ClaudeRunResult> {
  const useStream = args.liveStreamJson;
  const formatArg = useStream ? "stream-json" : args.outputFormat;
  const cliArgs = ["-p", args.prompt, "--allowedTools", args.allowedTools, "--max-turns", String(args.maxTurns), "--output-format", formatArg];
  if (useStream) {
    cliArgs.push("--verbose", "--include-partial-messages");
  }
  if (args.skillPath) {
    cliArgs.push("--append-system-prompt-file", args.skillPath);
  }

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let lastProgressAt = 0;
    const acc: StreamJsonAccum = { textDeltas: "" };
    let lineBuf = "";

    const bump = () => {
      const cb = args.stream?.onProgress;
      const viewCb = args.stream?.onProgressView;
      const now = Date.now();
      if (now - lastProgressAt < 220) {
        return;
      }
      lastProgressAt = now;

      if (useStream && args.progressAggregator) {
        const snap = args.progressAggregator.getSnapshot();
        viewCb?.(snap);
        cb?.(snap.ribbon);
        return;
      }

      cb?.(useStream ? progressFromLive(stderr, acc) : progressFromBuffers(stderr, stdout));
    };

    const processCompleteLine = (line: string) => {
      const r = applyStreamJsonLine(line, acc);
      if (r.channelAppend && args.outputChannel) {
        args.outputChannel.append(r.channelAppend);
      }
      if (r.fancy && args.progressAggregator) {
        args.progressAggregator.apply(r.fancy);
      }
      if (r.progress) {
        acc.lastToolHint = r.progress;
      }
      bump();
    };

    const appendStdoutChunk = (s: string) => {
      stdout += s;
      if (!useStream) {
        args.outputChannel?.append(s);
        bump();
        return;
      }
      lineBuf += s;
      const parts = lineBuf.split("\n");
      lineBuf = parts.pop() ?? "";
      for (const line of parts) {
        processCompleteLine(line);
      }
    };

    const flushLineBuffer = () => {
      if (!useStream || !lineBuf.trim()) {
        return;
      }
      processCompleteLine(lineBuf);
      lineBuf = "";
    };

    const child = spawn(args.executable, cliArgs, {
      cwd: args.cwd,
      env: { ...process.env },
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout?.on("data", (d: Buffer) => {
      appendStdoutChunk(d.toString());
    });
    child.stderr?.on("data", (d: Buffer) => {
      const s = d.toString();
      stderr += s;
      if (args.outputChannel) {
        args.outputChannel.append(`[stderr] ${s}`);
      }
      bump();
    });
    child.on("error", (err: NodeJS.ErrnoException) => {
      stderr += err.message;
      args.stream?.onProgress?.(`Failed to start claude: ${err.message}`);
      resolve({ stdout, stderr, code: null, streamedBody: useStream ? resolvedStreamBody(acc) : undefined });
    });
    child.on("close", (code) => {
      flushLineBuffer();
      const streamedBody = useStream ? resolvedStreamBody(acc) : undefined;
      if (useStream && args.progressAggregator) {
        const snap = args.progressAggregator.getSnapshot();
        args.stream?.onProgressView?.(snap);
        args.stream?.onProgress?.(snap.ribbon);
      } else {
        args.stream?.onProgress?.(
          useStream ? progressFromLive(stderr, acc) || `Finished (exit ${code ?? "?"})` : progressFromBuffers(stderr, stdout) || `Finished (exit ${code ?? "?"})`
        );
      }
      resolve({ stdout, stderr, code, streamedBody });
    });
  });
}
