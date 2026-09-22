// Output formatting: table (default, tty), json (--json), quiet (--quiet)
// Pipe detection: if stdout is not a tty, default to jsonl unless --table is set.

export type OutputMode = "table" | "json" | "quiet";

export interface RenderOpts {
  mode: OutputMode;
  pipeDetected: boolean;
}

export function pickMode(flags: { json?: boolean; quiet?: boolean; table?: boolean }, isTTY: boolean): OutputMode {
  if (flags.json) return "json";
  if (flags.quiet) return "quiet";
  if (flags.table) return "table";
  return isTTY ? "table" : "json";
}

export function render(mode: OutputMode, data: unknown): string {
  if (mode === "quiet") return "";
  if (mode === "json") return JSON.stringify(data, null, 2) + "\n";
  return renderTable(data) + "\n";
}

function renderTable(data: unknown): string {
  // Minimal table: if it's { choice, probabilities, confidence } render the top-N probabilities
  if (!data || typeof data !== "object") return String(data);
  const obj = data as Record<string, unknown>;
  if (typeof obj.choice === "string" && obj.probabilities && typeof obj.probabilities === "object") {
    const probs = obj.probabilities as Record<string, number>;
    const lines = [`choice: ${obj.choice}`, `confidence: ${fmt(obj.confidence)}`, ""];
    const sorted = Object.entries(probs).sort(([, a], [, b]) => b - a);
    const max = Math.max(...sorted.map(([k]) => k.length));
    for (const [k, v] of sorted) {
      lines.push(`  ${k.padEnd(max)}  ${(v * 100).toFixed(1).padStart(5)}%`);
    }
    return lines.join("\n");
  }
  if (typeof obj.noul === "number") {
    return `noul: ${(obj.noul as number).toFixed(3)}\nconfidence: ${fmt(obj.confidence)}`;
  }
  if (typeof obj.score === "number") {
    return `score: ${(obj.score as number).toFixed(3)}\nconfidence: ${fmt(obj.confidence)}`;
  }
  return JSON.stringify(data, null, 2);
}

function fmt(n: unknown): string {
  if (typeof n !== "number") return "-";
  return n.toFixed(3);
}