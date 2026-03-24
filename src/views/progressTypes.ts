/** Fancy progress UI (Report webview + notification line). */

/** Emitted per parsed stream-json line (drives pipeline + timeline). */
export type FancyProgress = {
  pipelineStep: 0 | 1 | 2 | 3;
  notifyLine: string;
  timelineLine?: string;
  timelineIcon?: string;
};

export type ProgressSnapshot = {
  /** 4 steps: boot → fetch → review → write */
  steps: { label: string; state: "pending" | "active" | "done" }[];
  /** Short line under the title (current activity) */
  ribbon: string;
  /** Recent formatted events (newest last) */
  timeline: { time: string; icon: string; text: string }[];
};

export const PIPELINE_LABELS = ["Connect & boot", "Fetch diff & context", "Run review", "Write report"] as const;
