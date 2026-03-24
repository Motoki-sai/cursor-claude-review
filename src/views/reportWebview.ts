import * as vscode from "vscode";
import MarkdownIt from "markdown-it";
import multimdTable from "markdown-it-multimd-table";
import { escapeHtml } from "../util/format";
import { revealReportView } from "../util/revealReport";
import { buildFancyProgressInnerHtml, FANCY_PROGRESS_STYLES } from "./progressHtml";
import type { ProgressSnapshot } from "./progressTypes";

const REPORT_WEBVIEW_STYLES = `
  body { margin: 0; padding: 12px 14px 28px; font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); line-height: 1.5; }
  .meta { opacity: 0.9; font-size: calc(var(--vscode-font-size) * 0.92); margin-bottom: 14px; }
  .hint { opacity: 0.85; }
  .report :first-child { margin-top: 0; }
  .report h1, .report h2, .report h3 { margin: 1em 0 0.5em; line-height: 1.25; }
  .report p { margin: 0.5em 0; }
  .report ul, .report ol { padding-left: 1.35em; margin: 0.5em 0; }
  .report table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: calc(var(--vscode-font-size) * 0.95); }
  .report th, .report td { border: 1px solid var(--vscode-panel-border); padding: 6px 8px; text-align: left; vertical-align: top; }
  .report th { background: var(--vscode-editorInlayHint-background); font-weight: 600; }
  .report code { font-family: var(--vscode-editor-font-family); font-size: 0.9em; padding: 0.1em 0.35em; border-radius: 3px; background: var(--vscode-textCodeBlock-background); }
  .report pre { margin: 10px 0; padding: 10px; overflow-x: auto; background: var(--vscode-textCodeBlock-background); border-radius: 4px; }
  .report pre code { padding: 0; background: none; }
  .report a { color: var(--vscode-textLink-foreground); }
  .report blockquote { margin: 8px 0; padding-left: 10px; border-left: 3px solid var(--vscode-panel-border); opacity: 0.95; }
  details.stderr-box { margin-top: 16px; }
  details.stderr-box summary { cursor: pointer; user-select: none; margin-bottom: 6px; color: var(--vscode-descriptionForeground); }
  pre.stderr { margin: 0; white-space: pre-wrap; word-break: break-word; font-family: var(--vscode-editor-font-family); font-size: var(--vscode-editor-font-size); color: var(--vscode-errorForeground); }
`;

const COMBINED_STYLES = `${REPORT_WEBVIEW_STYLES}\n${FANCY_PROGRESS_STYLES}`;

export type ReportPayload = {
  markdown: string;
  summary: string;
  exitCode: number | null;
  stderr: string;
};

export class ReviewReportWebviewProvider implements vscode.WebviewViewProvider {
  static readonly viewId = "claudePrReview.report";

  private _view?: vscode.WebviewView;
  private _pending?: ReportPayload;
  private _loadingMessage?: string;
  private _fancySnapshot?: ProgressSnapshot | null;
  private readonly _md: MarkdownIt;

  constructor(private readonly _extensionUri: vscode.Uri) {
    this._md = new MarkdownIt({ html: false, linkify: true, breaks: true }).use(multimdTable);
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: false,
      localResourceRoots: [this._extensionUri],
    };

    if (this._pending) {
      const p = this._pending;
      this._pending = undefined;
      this._applyReport(webviewView, p);
    } else if (this._fancySnapshot) {
      this._setInnerHtml(webviewView, buildFancyProgressInnerHtml(this._fancySnapshot));
    } else if (this._loadingMessage) {
      this._setInnerHtml(webviewView, `<p class="meta">${escapeHtml(this._loadingMessage)}</p>`);
    } else {
      this._setInnerHtml(
        webviewView,
        `<p class="hint">Use <strong>Run headless review</strong> (GitHub PR) or <strong>Review branch diff</strong> (git branches) under <strong>PR Review</strong>.</p>`
      );
    }
  }

  setLoading(message: string): void {
    this._fancySnapshot = null;
    this._loadingMessage = message;
    if (this._view) {
      this._setInnerHtml(this._view, `<p class="meta">${escapeHtml(message)}</p>`);
    }
  }

  setProgressSnapshot(snapshot: ProgressSnapshot): void {
    this._loadingMessage = undefined;
    this._fancySnapshot = snapshot;
    if (this._view) {
      this._setInnerHtml(this._view, buildFancyProgressInnerHtml(snapshot));
    }
  }

  showReport(payload: ReportPayload): void {
    this._loadingMessage = undefined;
    this._fancySnapshot = null;
    if (this._view) {
      this._applyReport(this._view, payload);
    } else {
      this._pending = payload;
      void revealReportView();
    }
  }

  private _buildDocument(webview: vscode.Webview, innerBody: string): string {
    const csp = [
      "default-src 'none'",
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `img-src ${webview.cspSource} https: data:`,
    ].join("; ");
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <style>${COMBINED_STYLES}</style>
</head>
<body>${innerBody}</body>
</html>`;
  }

  private _setInnerHtml(webviewView: vscode.WebviewView, innerBody: string): void {
    webviewView.webview.html = this._buildDocument(webviewView.webview, innerBody);
  }

  private _applyReport(webviewView: vscode.WebviewView, p: ReportPayload): void {
    const mdHtml = this._md.render(p.markdown.trim() || "_No stdout._");
    const meta = `<div class="meta">${escapeHtml(p.summary)} · exit <code>${p.exitCode ?? "?"}</code></div>`;
    const stderrBlock =
      p.stderr.trim().length > 0 ?
        `<details class="stderr-box"><summary>stderr</summary><pre class="stderr">${escapeHtml(p.stderr)}</pre></details>`
      : "";
    const inner = `${meta}<article class="report">${mdHtml}</article>${stderrBlock}`;
    this._setInnerHtml(webviewView, inner);
  }
}
