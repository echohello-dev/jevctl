// Input helpers: literal text, @path (file), or - (stdin)

import { readFile } from "node:fs/promises";

export async function readInput(value: string): Promise<string> {
  if (value === "-") {
    const chunks: Uint8Array[] = [];
    for await (const c of Bun.stdin.stream()) chunks.push(c);
    return new TextDecoder().decode(Buffer.concat(chunks));
  }
  if (value.startsWith("@")) {
    const path = value.slice(1);
    if (path.startsWith("@")) return path; // literal "@..."
    return (await readFile(path, "utf8")).trim();
  }
  return value;
}

export async function readState(value: string | undefined): Promise<unknown> {
  if (value === undefined) return "";
  const raw = await readInput(value);
  // Try JSON first; fall back to plain string
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}