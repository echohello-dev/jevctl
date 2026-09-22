// Command: jevctl route <state> --handlers a,b,c [--extract city,amount]
// Picks a handler (choice) and optionally extracts named fields (noul per field, but here: extra choices over candidate spans).
// For simplicity, this recreation's route emits handler + an "intent" noul, and declares fields as additional nouls.

import { readInput, readState } from "../input.js";
import { callDecisions, resolveProvider } from "../provider.js";
import { normalise, shouldFail, type Answer } from "../answer.js";
import { parse, getStr, getBool, csv, parseKV } from "../parse.js";
import { pickMode, render, type OutputMode } from "../output.js";
import { exit } from "node:process";

export async function run(argv: string[]): Promise<number> {
  const { positional, flags } = parse(argv);
  const stateArg = positional[0];
  if (!stateArg) return die("usage: jevctl route <state> --handlers a,b,c [--extract field1,field2]", 1);
  const handlers = csv(getStr(flags, "handlers"));
  if (handlers.length < 2) return die("--handlers requires 2+ labels", 1);
  const criteria: Record<string, string> = parseKV(getStr(flags, "handler-criteria"));
  for (const h of handlers) if (!(h in criteria)) criteria[h] = h;

  const extractFields = csv(getStr(flags, "extract"));
  const state = await readState(stateArg);

  const questions: Record<string, unknown> = {
    handler: { type: "choice", instructions: "Which handler should take this request?", criteria },
  };
  for (const f of extractFields) {
    questions[`has_${f}`] = { type: "noul", instructions: `Does the state explicitly contain the field "${f}"` };
  }

  const provider = await resolveProvider();
  if (!provider) return die("set TYPESAFE_API_KEY or OPENROUTER_API_KEY", 1);

  const dryRun = getBool(flags, "dry-run");
  if (dryRun) {
    console.log(JSON.stringify({ provider: provider.name, body: { state, questions } }, null, 2));
    return 0;
  }

  const timeoutMs = Number(getStr(flags, "timeout") ?? "30000") || 30000;
  const failOn = getStr(flags, "fail-on");
  try {
    const raw = await callDecisions(provider, { state, questions }, timeoutMs);
    const handlerAns = normalise(raw.answers.handler, "handler");
    const extractAns: Record<string, Answer> = {};
    for (const f of extractFields) extractAns[f] = normalise(raw.answers[`has_${f}`], `has_${f}`);
    return emit({ handler: handlerAns, extract: extractAns }, flags, failOn);
  } catch (err) {
    return die((err as Error).message, 1);
  }
}

function emit(ans: { handler: Answer; extract: Record<string, Answer> }, flags: Record<string, string | boolean>, failOn: string | undefined): number {
  const isTTY = process.stdout.isTTY ?? false;
  const mode: OutputMode = pickMode({
    json: flags.json === true,
    quiet: flags.quiet === true,
    table: flags.table === true,
  }, isTTY);
  process.stdout.write(render(mode, ans));
  if (!failOn) return 0;
  return shouldFail(ans.handler, failOn) ? 2 : 0;
}

function die(msg: string, code: number): number {
  process.stderr.write(`jevctl: ${msg}\n`);
  exit(code);
  return code;
}