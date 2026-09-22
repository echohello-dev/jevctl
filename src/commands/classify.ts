// Command: jevctl classify <state> --choices "a,b,c" [--instructions "..."]
// One choice question: which label fits.

import { readInput, readState } from "../input.js";
import { callDecisions, resolveProvider } from "../provider.js";
import { normalise, shouldFail, type Answer } from "../answer.js";
import { parse, getStr, getBool, csv, parseKV } from "../parse.js";
import { pickMode, render, type OutputMode } from "../output.js";
import { exit } from "node:process";

export async function run(argv: string[]): Promise<number> {
  const { positional, flags } = parse(argv);
  const stateArg = positional[0];
  if (!stateArg) return die("usage: jevctl classify <state> --choices a,b,c [--criteria key:label,...]", 1);

  const choices = csv(getStr(flags, "choices"));
  if (choices.length < 2) return die("--choices needs at least 2 labels", 1);
  const criteria = parseKV(getStr(flags, "criteria"));
  // Default criteria: use the choice label itself
  for (const c of choices) if (!(c in criteria)) criteria[c] = c;

  const state = await readState(stateArg);
  const instructions = getStr(flags, "instructions", "Which label fits the state?") ?? "Which label fits the state?";

  const provider = await resolveProvider();
  if (!provider) return die("set TYPESAFE_API_KEY or OPENROUTER_API_KEY", 1);

  const dryRun = getBool(flags, "dry-run");
  if (dryRun) {
    console.log(JSON.stringify({
      provider: provider.name,
      body: { state, questions: { label: { type: "choice", instructions, criteria } } },
    }, null, 2));
    return 0;
  }

  const timeoutMs = Number(getStr(flags, "timeout") ?? "30000") || 30000;
  const failOn = getStr(flags, "fail-on");
  try {
    const raw = await callDecisions(provider, {
      state,
      questions: { label: { type: "choice", instructions, criteria } },
    }, timeoutMs);
    const ans = normalise(raw.answers.label, "label");
    return emit(ans, flags, failOn);
  } catch (err) {
    return die((err as Error).message, 1);
  }
}

function emit(ans: Answer, flags: Record<string, string | boolean>, failOn: string | undefined): number {
  const isTTY = process.stdout.isTTY ?? false;
  const mode: OutputMode = pickMode({
    json: flags.json === true,
    quiet: flags.quiet === true,
    table: flags.table === true,
  }, isTTY);
  process.stdout.write(render(mode, ans));
  return failOn && shouldFail(ans, failOn) ? 2 : 0;
}

function die(msg: string, code: number): number {
  process.stderr.write(`jevctl: ${msg}\n`);
  exit(code);
  return code;
}