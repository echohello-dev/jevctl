// Command: jevctl ask <state> --type choice|noul|score --question "..." [--choices a,b,c]
// Generic primitive invocation.

import { readInput, readState } from "../input.js";
import { callDecisions, resolveProvider } from "../provider.js";
import { normalise, shouldFail, type Answer } from "../answer.js";
import { parse, getStr, getBool, csv } from "../parse.js";
import { pickMode, render, type OutputMode } from "../output.js";
import { exit } from "node:process";

export async function run(argv: string[]): Promise<number> {
  const { positional, flags } = parse(argv);
  const stateArg = positional[0];
  if (!stateArg) return die("usage: jevctl ask <state> --type choice|noul|score --question '...'", 1);
  const type = getStr(flags, "type") ?? "";
  const question = getStr(flags, "question") ?? "";
  if (!["choice","noul","score"].includes(type)) return die("--type must be choice|noul|score", 1);
  if (!question) return die("missing --question", 1);

  const state = await readState(stateArg);
  let questionDef: unknown;
  if (type === "choice") {
    const choices = csv(getStr(flags, "choices"));
    if (choices.length < 2) return die("--choices requires 2+ labels for choice type", 1);
    const criteria: Record<string, string> = {};
    for (const c of choices) criteria[c] = c;
    questionDef = { type: "choice", instructions: question, criteria };
  } else if (type === "score") {
    questionDef = { type: "score", instructions: question, criteria: ["low","medium","high"] };
  } else {
    questionDef = { type: "noul", instructions: question };
  }

  const provider = await resolveProvider();
  if (!provider) return die("set TYPESAFE_API_KEY or OPENROUTER_API_KEY", 1);

  const dryRun = getBool(flags, "dry-run");
  if (dryRun) {
    console.log(JSON.stringify({ provider: provider.name, body: { state, questions: { q: questionDef } } }, null, 2));
    return 0;
  }

  const timeoutMs = Number(getStr(flags, "timeout") ?? "30000") || 30000;
  const failOn = getStr(flags, "fail-on");
  try {
    const raw = await callDecisions(provider, { state, questions: { q: questionDef } }, timeoutMs);
    const ans = normalise(raw.answers.q, "q");
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