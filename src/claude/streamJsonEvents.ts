/** Accumulates Claude Code `stream-json` lines (-p --verbose --include-partial-messages). */

import type { FancyProgress } from "../views/progressTypes";

export type StreamJsonAccum = {
  /** Concatenated assistant text_delta chunks */
  textDeltas: string;
  /** When CLI emits a final `result` string */
  finalResult?: string;
  /** Last tool / task_progress / init hint for progress UI */
  lastToolHint?: string;
};

export type StreamLineEffect = {
  channelAppend?: string;
  progress?: string;
  fancy?: FancyProgress;
};

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v !== null && typeof v === "object" ? (v as Record<string, unknown>) : undefined;
}

function clamp(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

const STRING_HINT_KEYS = [
  "message",
  "text",
  "summary",
  "description",
  "status",
  "title",
  "label",
  "detail",
  "current_step",
  "step",
  "task",
  "name",
  "command",
  "tool",
  "tool_name",
  "query",
  "input",
  "output",
  "content",
  "body",
  "reason",
  "error",
  "user_message",
  "progress_message",
  "task_description",
  "display",
  "hint",
];

/** Pull first useful string from a record (and one level of data / payload / progress). */
function extractDetailFromRecord(ev: Record<string, unknown>): string | undefined {
  for (const k of STRING_HINT_KEYS) {
    const v = ev[k];
    if (typeof v === "string" && v.trim()) {
      return clamp(v, 220);
    }
  }
  for (const nestKey of ["data", "payload", "progress", "task", "meta", "info", "context"]) {
    const inner = asRecord(ev[nestKey]);
    if (!inner) {
      continue;
    }
    for (const k of STRING_HINT_KEYS) {
      const v = inner[k];
      if (typeof v === "string" && v.trim()) {
        return clamp(v, 220);
      }
    }
  }
  return undefined;
}

/** Anthropic-style content blocks: [{ type: "text", text: "..." }, ...] */
function textFromContentArray(content: unknown): string | undefined {
  if (!Array.isArray(content)) {
    return undefined;
  }
  const parts: string[] = [];
  for (const block of content) {
    const b = asRecord(block);
    if (!b) {
      continue;
    }
    if (b.type === "text" && typeof b.text === "string") {
      parts.push(b.text);
    }
    if (b.type === "tool_use" && typeof b.name === "string") {
      parts.push(`[${b.name}]`);
    }
  }
  const s = parts.join(" ").trim();
  return s.length > 0 ? clamp(s, 220) : undefined;
}

/** When no single message field, show a few short key: value pairs (not bare "task_progress"). */
function fallbackDescribe(ev: Record<string, unknown>): string {
  const preferShort = ["model", "cwd", "working_directory", "version", "claude_code_version", "branch"];
  for (const k of preferShort) {
    const v = ev[k];
    if (typeof v === "string" && v.trim()) {
      return `${k}: ${clamp(v, 100)}`;
    }
  }
  const skip = new Set(["type", "uuid", "id", "session_id", "timestamp", "parent_tool_use_id"]);
  const pairs: string[] = [];
  for (const [k, v] of Object.entries(ev)) {
    if (skip.has(k)) {
      continue;
    }
    if (typeof v === "string" && v.trim() && v.length < 200) {
      pairs.push(`${k}: ${clamp(v, 80)}`);
    } else if (typeof v === "number" || typeof v === "boolean") {
      pairs.push(`${k}: ${String(v)}`);
    }
    if (pairs.length >= 5) {
      break;
    }
  }
  if (pairs.length > 0) {
    return pairs.join(" · ");
  }
  const t = typeof ev.type === "string" ? ev.type : "event";
  return t;
}

function describeInitOrTask(ev: Record<string, unknown>, kind: "init" | "task_progress"): StreamLineEffect {
  const fromContent = textFromContentArray(ev.content);
  const detail = extractDetailFromRecord(ev) ?? fromContent ?? fallbackDescribe(ev);
  const notify = kind === "init" ? "Connected to Claude session" : clamp(detail, 100);
  const timeline =
    kind === "init" ? (detail && detail !== "init" ? `Init: ${detail}` : "Session initialized") : `Progress ▸ ${detail}`;
  return {
    progress: notify,
    fancy: {
      pipelineStep: kind === "init" ? 1 : 2,
      notifyLine: notify,
      timelineLine: timeline,
      timelineIcon: kind === "init" ? "◆" : "⏱",
    },
  };
}

/**
 * Parse one NDJSON line. Updates `acc`. Returns text to append to the output channel and/or a progress line.
 */
export function applyStreamJsonLine(line: string, acc: StreamJsonAccum): StreamLineEffect {
  const trimmed = line.trim();
  if (!trimmed) {
    return {};
  }

  let o: Record<string, unknown>;
  try {
    o = JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return {
      fancy: {
        pipelineStep: 0,
        notifyLine: "Reading stream…",
      },
    };
  }

  if (typeof o.result === "string") {
    acc.finalResult = o.result;
    const p = "Report received";
    acc.lastToolHint = p;
    return {
      progress: p,
      fancy: {
        pipelineStep: 3,
        notifyLine: p,
        timelineLine: "Received final result",
        timelineIcon: "✓",
      },
    };
  }

  const topType = typeof o.type === "string" ? o.type : "";
  if (topType === "init") {
    const e = describeInitOrTask(o, "init");
    acc.lastToolHint = e.progress;
    return e;
  }
  if (topType === "task_progress") {
    const e = describeInitOrTask(o, "task_progress");
    acc.lastToolHint = e.progress;
    return e;
  }

  if (o.type === "stream_event") {
    const ev = asRecord(o.event);
    if (!ev) {
      return {};
    }

    const evType = typeof ev.type === "string" ? ev.type : "";

    if (evType === "init") {
      const e = describeInitOrTask(ev, "init");
      acc.lastToolHint = e.progress;
      return e;
    }
    if (evType === "task_progress") {
      const e = describeInitOrTask(ev, "task_progress");
      acc.lastToolHint = e.progress;
      return e;
    }

    const delta = asRecord(ev.delta);
    if (delta?.type === "text_delta" && typeof delta.text === "string") {
      acc.textDeltas += delta.text;
      const p = "Writing review report…";
      acc.lastToolHint = p;
      return {
        progress: p,
        fancy: {
          pipelineStep: 3,
          notifyLine: p,
        },
      };
    }

    const name =
      typeof ev.name === "string" ? ev.name
      : delta && typeof delta.name === "string" ? delta.name
      : typeof ev.tool_name === "string" ? ev.tool_name
      : undefined;
    if (name) {
      const input = ev.input ?? ev.arguments ?? delta?.input;
      const inputStr = typeof input === "string" ? input.slice(0, 80) : "";
      const hint = inputStr ? `${name}: ${inputStr}${inputStr.length >= 80 ? "…" : ""}` : name;
      acc.lastToolHint = hint;
      const n = `Running ${name}…`;
      return {
        progress: n,
        fancy: {
          pipelineStep: 2,
          notifyLine: n,
          timelineLine: hint,
          timelineIcon: "⚙",
        },
      };
    }
    if (typeof ev.type === "string" && /tool|bash|command/i.test(ev.type)) {
      const hint = extractDetailFromRecord(ev) ?? ev.type;
      acc.lastToolHint = hint;
      return {
        progress: hint,
        fancy: {
          pipelineStep: 2,
          notifyLine: "Running tool…",
          timelineLine: hint,
          timelineIcon: "⚙",
        },
      };
    }

    const innerHint = extractDetailFromRecord(ev) ?? textFromContentArray(ev.content) ?? fallbackDescribe(ev);
    const progress = evType ? `${evType}: ${innerHint}` : innerHint;
    acc.lastToolHint = progress;
    return {
      progress: clamp(progress, 200),
      fancy: {
        pipelineStep: 2,
        notifyLine: clamp(progress, 90),
        timelineLine: innerHint,
        timelineIcon: "›",
      },
    };
  }

  if (o.type === "system" || o.subtype === "api_retry") {
    const sub = typeof o.subtype === "string" ? o.subtype : "system";
    const extra = extractDetailFromRecord(o);
    const progress = extra ? `${sub}: ${extra}` : sub;
    return {
      progress,
      fancy: {
        pipelineStep: 0,
        notifyLine: clamp(progress, 90),
        timelineLine: progress,
        timelineIcon: "⋯",
      },
    };
  }

  if (typeof o.type === "string" && o.type.length > 0 && o.type !== "stream_event") {
    const detail = extractDetailFromRecord(o) ?? textFromContentArray(o.content) ?? fallbackDescribe(o);
    const progress = detail === o.type ? detail : `${o.type}: ${detail}`;
    acc.lastToolHint = progress;
    return {
      progress: clamp(progress, 200),
      fancy: {
        pipelineStep: 2,
        notifyLine: clamp(progress, 90),
        timelineLine: progress,
        timelineIcon: "›",
      },
    };
  }

  return {};
}

/** Prefer final JSON result, else concatenated deltas (markdown body). */
export function resolvedStreamBody(acc: StreamJsonAccum): string | undefined {
  const fr = acc.finalResult?.trim();
  if (fr) {
    return fr;
  }
  const td = acc.textDeltas.trim();
  return td.length > 0 ? td : undefined;
}
