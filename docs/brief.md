# jevctl — behavioural spec

Target observed: a CLI that wraps the TypeSafe/OpenRouter /api/alpha/decisions endpoint and exposes atomic judgment commands for agent/CI use. The recreation is built from the public API contract only — no source-code reading.

## Behavioural spec (numbered)

1. CLI invokes a single primitive per call against the decisions endpoint, returning the typed answer.
2. Each command accepts the same input shapes: literal text, `@path` (file), or `-` (stdin).
3. Provider is selectable: TypeSafe direct (`TYPESAFE_API_KEY`) or OpenRouter (`OPENROUTER_API_KEY` against `/api/alpha/decisions`).
4. Output modes: human-readable table by default; `--json` for machine-readable; `--quiet` to suppress everything except exit code.
5. Exit codes follow Unix norms: 0 success, 1 usage/config/network error, 2 a `--fail-on` threshold matched (so commands compose in `&&` and CI).
6. API key storage: env var takes precedence, fallback to `~/.config/jevctl/key` (mode 0600). Never accept key on CLI args.
7. Dry-run (`--dry-run`) prints the request body without calling the network.
8. Commands implemented (recreation's chosen scope, not a mirror of upstream):
   - `verify` — does evidence support a claim? (noul: true/false)
   - `classify` — pick the best label from a set (choice)
   - `screen` — judge text as relevant/noise/risk (choice + score)
   - `route` — pick a handler and extract named fields (multiple choice primitives)
   - `ask` — arbitrary yes/no, multiple-choice, or rating question

## Design choices that differ from upstream

- Fewer commands (5 vs ~13). Each command does one thing.
- No Claude Code plugin (out of scope).
- Single binary built with Bun, no Node LTS check dance.
- TS strict, ESM, no runtime deps beyond Bun stdlib + a 30-line HTTP wrapper.
- Provider selection by env var (not interactive `auth login`).
- Output is JSON-Lines when piped (stdin detected), table when interactive.

## Out of scope (for this recreation)

- Plugin/marketplace model
- Batch concurrency pools
- Hierarchical classification
- Auto-compaction hooks for coding agents
- Bash completion, shell init scripts

## Provider routing

```
TYPESAFE_API_KEY set       → POST https://api.typesafe.ai/v1/systemone
                            model: jev-latest
OPENROUTER_API_KEY set     → POST https://openrouter.ai/api/alpha/decisions
                            model: ~typesafe/jev-latest
both set                   → TYPESAFE_API_KEY wins (cheaper, pinned alias)
neither set                → error exit 1 with hint
```

## Question-construction patterns

Each command translates CLI flags into the upstream `questions` record shape:

```
verify:
  supports_claim: { type: noul, instructions: "Does the evidence support the claim?" }

classify:
  label: { type: choice, instructions: "...", criteria: { ... } }

screen:
  relevance: { type: choice, ..., criteria: { relevant, off_topic, suspicious } }
  risk:      { type: score, ..., criteria: [safe, low, medium, high] }

route:
  handler: { type: choice, ..., criteria: { ... } }
  city / amount / date: { type: choice, ..., criteria: { ... } } (per declared field)

ask:
  parsed from --question and --type flags
```

## Confidence / fail-on semantics

- `--fail-on <predicate>` runs after every command; common predicates are pre-baked per command (`contradicted` for verify, label name for classify, etc.) and default to none.
- Choice answers: failure if `choice == X` AND `confidence >= threshold` (default 0.5).
- Noul answers: failure if `noul >= threshold` (true direction) or `<= 1 - threshold` (false direction), depending on `--expect true|false`.
- Score answers: failure if score crosses the configured level boundary.