export function extractTextResult(jsonStdout: string): string | undefined {
  const trimmed = jsonStdout.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    const o = JSON.parse(trimmed) as { result?: string };
    return typeof o.result === "string" ? o.result : undefined;
  } catch {
    const lastLine = trimmed.split(/\r?\n/).pop();
    if (!lastLine) {
      return undefined;
    }
    try {
      const o = JSON.parse(lastLine) as { result?: string };
      return typeof o.result === "string" ? o.result : undefined;
    } catch {
      return undefined;
    }
  }
}
