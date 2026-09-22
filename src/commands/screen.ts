// Command: jevctl screen <text> [--relevance-label relevant,off_topic,suspicious] [--fail-on suspicious]
// Two questions: relevance (choice) + risk (score 0..2)

import { readInput } from "../input.js";
import { callDecisions, resolveProvider } from "../provider.js";
import { normalise, shouldFail, type Answer } from "../answer.js";
import { parse, getStr, getBool, csv, parseKV } from "../parse.js";
import { pickMode, render, type OutputMode } from "../output.js";
import { exit } from "node:process";

export async function run(argv: string[]): Promise<number> {
  const { positional, flags } = parse(argv);
  const text = positional[0];
  if (!text) return die("usage: jevctl screen <text> [--relevance a,b,c] [--fail-on label]", 1);

  const relevanceChoices = csv(getStr(flags, "relevance", "relevant,off_topic,suspicious"));
  const relevanceCriteria = parseKV(getStr(flags, "relevance-criteria"));
  for (const c of relevanceChoices) if (!(c in relevanceCriteria)) relevanceCriteria[c] = c;

  const state = await readInput(text);

  const provider = await resolveProvider();
  if (!provider) return die("set TYPESAFE_API_KEY or OPENROUTER_API_KEY", 1);

  const dryRun = getBool(flags, "dry-run");
  if (dryRun) {
    console.log(JSON.stringify({
      provider: provider.name,
      body: {
        state,
        questions: {
          relevance: { type: "choice", instructions: "Is this content relevant, off-topic, or suspicious?", criteria: relevanceCriteria },
          risk: { type: "score", instructions: "Risk level of acting on this content without further verification", criteria: ["safe","low","medium","high"] },
        },
      },
    }, null, 2));
    return 0;
  }

  const timeoutMs = Number(getStr(flags, "timeout") ?? "30000") || 30000;
  const failOn = getStr(flags, "fail-on");
  try {
    const raw = await callDecisions(provider, {
      state,
      questions: {
        relevance: { type: "choice", instructions: "Is this content relevant, off-topic, or suspicious?", criteria: relevanceCriteria },
        risk: { type: "score", instructions: "Risk level of acting on this content without further verification", criteria: ["safe","low","medium","high"] },
      },
    }, timeoutMs);
    const relevance = normalise(raw.answers.relevance, "relevance");
    const risk = normalise(raw.answers.risk, "risk");
    return emit({ relevance, risk }, flags, failOn);
  } catch (err) {
    return die((err as Error).message, 1);
  }
}

function emit(ans: { relevance: Answer; risk: Answer }, flags: Record<string, string | boolean>, failOn: string | undefined): number {
  const isTTY = process.stdout.isTTY ?? false;
  const mode: OutputMode = pickMode({
    json: flags.json === true,
    quiet: flags.quiet === true,
    table: flags.table === true,
  }, isTTY);
  process.stdout.write(render(mode, ans));
  if (!failOn) return 0;
  return shouldFail(ans.relevance, failOn) || shouldFail(ans.risk, failOn) ? 2 : 0;
}

function die(msg: string, code: number): number {
  process.stderr.write(`jevctl: ${msg}\n`);
  exit(code);
  return code;
}