import { PIPELINE_LABELS, type FancyProgress, type ProgressSnapshot } from "../views/progressTypes";

const TIMELINE_MAX = 14;
const TIMELINE_DEDUP_MS = 3200;

function nowTime(): string {
  const d = new Date();
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

export class ReviewProgressAggregator {
  private maxPipeline = 0;
  private ribbon = "Preparing…";
  private timeline: { time: string; icon: string; text: string }[] = [];
  private lastTimelineKey = "";
  private lastTimelineAt = 0;

  constructor(private readonly channelLine?: (s: string) => void) {}

  reset(): void {
    this.maxPipeline = 0;
    this.ribbon = "Preparing…";
    this.timeline = [];
    this.lastTimelineKey = "";
    this.lastTimelineAt = 0;
  }

  /** Initial state before `claude` spawns. */
  resetWithStart(): void {
    this.reset();
    this.ribbon = "Starting Claude…";
    this.pushMilestone("Review run started", "▸");
  }

  apply(f: FancyProgress | undefined): void {
    if (!f) {
      return;
    }
    this.maxPipeline = Math.max(this.maxPipeline, f.pipelineStep);
    if (f.notifyLine.trim()) {
      this.ribbon = f.notifyLine.trim();
    }
    if (f.timelineLine?.trim()) {
      this.maybePushTimeline(f.timelineLine.trim(), f.timelineIcon ?? "›");
    }
  }

  private maybePushTimeline(text: string, icon: string): void {
    const now = Date.now();
    if (text === this.lastTimelineKey && now - this.lastTimelineAt < TIMELINE_DEDUP_MS) {
      return;
    }
    this.lastTimelineKey = text;
    this.lastTimelineAt = now;
    const time = nowTime();
    this.timeline.push({ time, icon, text });
    if (this.timeline.length > TIMELINE_MAX) {
      this.timeline.shift();
    }
    this.channelLine?.(`[${time}] ${icon} ${text}`);
  }

  /** Force a milestone without dedupe (e.g. start / done). */
  pushMilestone(text: string, icon: string): void {
    const time = nowTime();
    this.timeline.push({ time, icon, text });
    if (this.timeline.length > TIMELINE_MAX) {
      this.timeline.shift();
    }
    this.lastTimelineKey = text;
    this.lastTimelineAt = Date.now();
    this.channelLine?.(`[${time}] ${icon} ${text}`);
  }

  getSnapshot(): ProgressSnapshot {
    const steps = PIPELINE_LABELS.map((label, i) => {
      if (i < this.maxPipeline) {
        return { label, state: "done" as const };
      }
      if (i === this.maxPipeline) {
        return { label, state: "active" as const };
      }
      return { label, state: "pending" as const };
    });
    return {
      steps,
      ribbon: this.ribbon,
      timeline: [...this.timeline],
    };
  }
}
