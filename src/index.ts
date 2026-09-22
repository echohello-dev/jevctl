#!/usr/bin/env bun
// jevctl — CLI for typed AI judgments.
// Usage: jevctl <command> [args] [flags]
// Run `jevctl help` for command list.

import { exit } from "node:process";

const COMMANDS: Record<string, { help: string; module?: string }> = {
  verify: { help: "Does the evidence support the claim?", module: "./commands/verify.js" },
  classify: { help: "Which label fits the state?", module: "./commands/classify.js" },
  screen: { help: "Judge content for relevance and risk", module: "./commands/screen.js" },
  route: { help: "Pick a handler and extract declared fields", module: "./commands/route.js" },
  ask: { help: "Generic choice|noul|score question", module: "./commands/ask.js" },
  help: { help: "Show this help" },
  "--help": { help: "Show this help" },
  "-h": { help: "Show this help" },
};

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    printHelp();
    return;
  }
  const entry = COMMANDS[cmd];
  if (!entry) {
    process.stderr.write(`jevctl: unknown command "${cmd}"\n\n`);
    printHelp();
    exit(1);
    return;
  }
  if (!entry.module) {
    printHelp();
    return;
  }
  const mod = await import(entry.module);
  const code = await mod.run(argv.slice(1));
  exit(code);
}

function printHelp(): void {
  const lines = [
    "jevctl — CLI for typed AI judgments (TypeSafe + OpenRouter)",
    "",
    "Usage: jevctl <command> [args] [flags]",
    "",
    "Commands:",
  ];
  for (const [name, info] of Object.entries(COMMANDS)) {
    if (!info.module) continue;
    lines.push(`  ${name.padEnd(10)} ${info.help}`);
  }
  lines.push("");
  lines.push("Flags (most commands):");
  lines.push("  --json           machine-readable output");
  lines.push("  --quiet          no output, exit code only");
  lines.push("  --fail-on X      exit 2 if answer matches X");
  lines.push("  --timeout MS     request timeout (default 30000)");
  lines.push("  --dry-run        print request body without calling the API");
  lines.push("");
  lines.push("Env:");
  lines.push("  TYPESAFE_API_KEY     primary — TypeSafe direct API");
  lines.push("  OPENROUTER_API_KEY   fallback — OpenRouter /api/alpha/decisions");
  process.stdout.write(lines.join("\n") + "\n");
}

main().catch((err) => {
  process.stderr.write(`jevctl: ${(err as Error).message}\n`);
  exit(1);
});