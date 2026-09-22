// CLI argument parsing — Bun.argv + minimal manual parser (no deps)
// Supports: jevctl <command> [args] [--flag value] [--bool]
// Long form: --state <s>, --choices a,b,c, --instructions "..."

export interface ParsedArgs {
  positional: string[];
  flags: Record<string, string | boolean>;
}

export function parse(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (!a) continue;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        flags[key] = true;
        i += 1;
      } else {
        flags[key] = next;
        i += 2;
      }
    } else {
      positional.push(a);
      i += 1;
    }
  }
  return { positional, flags };
}

export function getStr(flags: Record<string, string | boolean>, key: string, fallback?: string): string | undefined {
  const v = flags[key];
  if (typeof v === "string") return v;
  if (v === true) throw new Error(`--${key} requires a value`);
  return fallback;
}

export function getBool(flags: Record<string, string | boolean>, key: string): boolean {
  return flags[key] === true;
}

export function csv(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

export function parseKV(value: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!value) return out;
  for (const pair of value.split(",")) {
    const [k, v] = pair.split(":").map((s) => s.trim());
    if (k && v) out[k] = v;
  }
  return out;
}