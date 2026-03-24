import { escapeHtml } from "../util/format";
import type { ProgressSnapshot } from "./progressTypes";

/** Extra styles injected with the progress view (theme-aware, subtle motion). */
export const FANCY_PROGRESS_STYLES = `
  .fp-wrap { max-width: 100%; }
  .fp-hero {
    position: relative;
    padding: 14px 14px 16px;
    margin: -12px -14px 16px -14px;
    border-radius: 0 0 10px 10px;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--vscode-button-background) 22%, transparent) 0%,
      color-mix(in srgb, var(--vscode-progressBar-background) 18%, transparent) 50%,
      transparent 100%
    );
    border-bottom: 1px solid var(--vscode-widget-border);
    overflow: hidden;
  }
  .fp-hero::before {
    content: "";
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 80% 60% at 20% 0%, color-mix(in srgb, var(--vscode-textLink-foreground) 12%, transparent), transparent 55%);
    pointer-events: none;
  }
  .fp-title {
    position: relative;
    font-size: calc(var(--vscode-font-size) * 1.05);
    font-weight: 600;
    letter-spacing: 0.02em;
    margin: 0 0 6px 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .fp-pulse {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--vscode-progressBar-background);
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--vscode-progressBar-background) 55%, transparent);
    animation: fp-pulse 1.4s ease-out infinite;
  }
  @keyframes fp-pulse {
    0% { transform: scale(1); box-shadow: 0 0 0 0 color-mix(in srgb, var(--vscode-progressBar-background) 45%, transparent); opacity: 1; }
    70% { transform: scale(1.15); box-shadow: 0 0 0 10px transparent; opacity: 0.85; }
    100% { transform: scale(1); box-shadow: 0 0 0 0 transparent; opacity: 1; }
  }
  .fp-ribbon {
    position: relative;
    font-size: calc(var(--vscode-font-size) * 0.92);
    opacity: 0.92;
    line-height: 1.4;
    padding-left: 16px;
    border-left: 2px solid var(--vscode-progressBar-background);
  }
  .fp-pipeline {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 18px 0 8px 0;
  }
  .fp-step {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 6px;
    border: 1px solid transparent;
    transition: background 0.2s ease, border-color 0.2s ease;
  }
  .fp-step.done {
    opacity: 0.72;
  }
  .fp-step.active {
    background: color-mix(in srgb, var(--vscode-editor-inactiveSelectionBackground) 85%, transparent);
    border-color: color-mix(in srgb, var(--vscode-progressBar-background) 35%, transparent);
    box-shadow: 0 1px 8px color-mix(in srgb, var(--vscode-widget-shadow) 40%, transparent);
  }
  .fp-step.pending {
    opacity: 0.45;
  }
  .fp-step-ico {
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    line-height: 1;
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
  }
  .fp-step.done .fp-step-ico {
    background: color-mix(in srgb, var(--vscode-testing-iconPassed) 35%, var(--vscode-badge-background));
  }
  .fp-step.active .fp-step-ico {
    background: var(--vscode-progressBar-background);
    color: var(--vscode-editor-background);
    animation: fp-spin-hint 2.2s linear infinite;
  }
  @keyframes fp-spin-hint {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.65; }
  }
  .fp-step-txt { flex: 1; font-size: calc(var(--vscode-font-size) * 0.95); line-height: 1.35; }
  .fp-timeline-h {
    margin: 16px 0 8px 0;
    font-size: calc(var(--vscode-font-size) * 0.8);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    opacity: 0.55;
    font-weight: 600;
  }
  .fp-timeline {
    border-radius: 6px;
    border: 1px solid var(--vscode-widget-border);
    background: color-mix(in srgb, var(--vscode-editor-background) 60%, var(--vscode-sideBar-background));
    overflow: hidden;
  }
  .fp-tl-row {
    display: grid;
    grid-template-columns: 52px 22px 1fr;
    gap: 8px;
    align-items: baseline;
    padding: 7px 10px;
    font-size: calc(var(--vscode-font-size) * 0.88);
    border-bottom: 1px solid color-mix(in srgb, var(--vscode-widget-border) 70%, transparent);
  }
  .fp-tl-row:last-child { border-bottom: none; }
  .fp-tl-time { font-variant-numeric: tabular-nums; opacity: 0.55; font-size: 0.92em; }
  .fp-tl-icon { text-align: center; opacity: 0.85; }
  .fp-tl-msg { opacity: 0.95; word-break: break-word; }
`;

export function buildFancyProgressInnerHtml(snapshot: ProgressSnapshot): string {
  const stepsHtml = snapshot.steps
    .map((s, i) => {
      const cls = s.state === "done" ? "done" : s.state === "active" ? "active" : "pending";
      const ico = s.state === "done" ? "✓" : s.state === "active" ? "●" : `${i + 1}`;
      return `<div class="fp-step ${cls}"><span class="fp-step-ico">${escapeHtml(ico)}</span><span class="fp-step-txt">${escapeHtml(s.label)}</span></div>`;
    })
    .join("");

  const timelineRows =
    snapshot.timeline.length === 0 ?
      `<div class="fp-tl-row"><span class="fp-tl-time">—</span><span class="fp-tl-icon">·</span><span class="fp-tl-msg">Waiting for events…</span></div>`
    : snapshot.timeline
        .map(
          (row) =>
            `<div class="fp-tl-row"><span class="fp-tl-time">${escapeHtml(row.time)}</span><span class="fp-tl-icon">${escapeHtml(row.icon)}</span><span class="fp-tl-msg">${escapeHtml(row.text)}</span></div>`
        )
        .join("");

  return `<div class="fp-wrap">
  <div class="fp-hero">
    <div class="fp-title"><span class="fp-pulse" aria-hidden="true"></span>Review in progress</div>
    <div class="fp-ribbon">${escapeHtml(snapshot.ribbon)}</div>
  </div>
  <div class="fp-pipeline">${stepsHtml}</div>
  <div class="fp-timeline-h">Activity</div>
  <div class="fp-timeline">${timelineRows}</div>
</div>`;
}
