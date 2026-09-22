// Command: jevctl verify <claim> --evidence <text>
// One noul question: does evidence support claim?

import { readInput, readState } from "../input.js";
import { callDecisions } from "../provider.js";
import { normalise, shouldFail, type Answer } from "../answer.js";
import { parse, getStr, getBool } from "../parse.js";
import { pickMode, render, type OutputMode } from "../output.js";
import { exit } from "node:process";

export async function run(argv: string[]): Promise<number> {
  const { positional, flags } = parse(argv);
  const claim = positional[0];
  const evidence = getStr(flags, "evidence", "");
  if (!claim) return die("usage: jevctl verify <claim> --evidence <text|@file|->", 1);
  if (!evidence) return die("missing --evidence", 1);

  const state = await readInput(claim);
  const evidenceText = await readInput(evidence);
  const instructions = getStr(flags, "instructions", "Does the evidence support the claim?") ?? "Does the evidence support the claim?";
  const failOn = getStr(flags, "fail-on", "false");

  const provider = await (await import("../provider.js")).resolveProvider();
  if (!provider) return die("set TYPESAFE_API_KEY or OPENROUTER_API_KEY", 1);

  const dryRun = getBool(flags, "dry-run");
  if (dryRun) {
    console.log(JSON.stringify({
      provider: provider.name,
      body: {
        state: `${state}\n\nEvidence:\n${evidenceText}`,
        questions: { supports_claim: { type: "noul", instructions } },
      },
    }, null, 2));
    return 0;
  }

  const timeoutMs = Number(getStr(flags, "timeout") ?? "30000") || 30000;
  try {
    const raw = await callDecisions(provider, {
      state: `${state}\n\nEvidence:\n${evidenceText}`,
      questions: { supports_claim: { type: "noul", instructions } },
    }, timeoutMs);
    const ans = normalise(raw.answers.supports_claim, "supports_claim");
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
  const payload = ans.type === "noul"
    ? { supports: ans.noul >= 0.5, noul: ans.noul, confidence: ans.confidence }
    : ans;
  process.stdout.write(render(mode, payload));
  return shouldFail(ans, failOn) ? 2 : 0;
}

function die(msg: string, code: number): number {
  process.stderr.write(`jevctl: ${msg}\n`);
  exit(code);
  return code;
}