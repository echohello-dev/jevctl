# jevctl

Clean-room CLI for typed AI judgments. Sends `state` + typed `questions` to the
TypeSafe or OpenRouter `/api/alpha/decisions` endpoint, returns structured
answers with probabilities and confidence.

## Install

```bash
# From a local clone
bun install
bun run build
npm link    # makes `jevctl` available globally

# Or via bunx once published
bunx @echohello/jevctl@latest verify "..." --evidence "..."
```

Requires Bun ≥ 1.1 and one of:

- `TYPESAFE_API_KEY` — TypeSafe direct API (cheapest, pinned `jev-latest`)
- `OPENROUTER_API_KEY` — routes through `/api/alpha/decisions` (`~typesafe/jev-latest`)

TypeSafe wins if both are present.

## Commands

| Command | Purpose | Returns |
|---|---|---|
| `verify` | Does evidence support the claim? | noul (true/false probability) |
| `classify` | Which label fits the state? | choice + probability distribution |
| `screen` | Relevance + risk of content | choice + score |
| `route` | Pick a handler, extract declared fields | choice + per-field nouls |
| `ask` | Arbitrary choice / noul / score question | as configured |

## Examples

```bash
# Verify a claim
jevctl verify "Helmets are optional for adults" --evidence "Every rider must wear an approved helmet."
# → supports: false   noul: 0.04   confidence: 0.99

# Classify a message intent
jevctl classify "I want to wash my car, the wash is 50m away" \
  --choices question,command,smalltalk,info \
  --criteria "question:Asking for a decision,command:Telling me to do something,smalltalk:Chat pleasantries,info:Seeking factual info"
# → choice: question   confidence: 0.92

# Screen fetched content
cat page.md | jevctl screen - --fail-on suspicious
# exits 2 if "suspicious" wins

# Route to a handler
jevctl route "What's the weather in Paris tomorrow?" \
  --handlers weather,calendar,smalltalk,command \
  --extract city,time_scope
# → handler: weather   extract: { city: true, time_scope: true }

# Arbitrary question
jevctl ask "Refund policy on item X" \
  --type noul --question "Does this state describe a refund policy"
```

## Global flags

- `--json` — emit machine-readable JSON
- `--quiet` — no output, exit code only
- `--table` — force human table even when piped
- `--fail-on <predicate>` — exit 2 if answer matches (per command semantics)
- `--timeout <ms>` — request timeout (default 30000)
- `--dry-run` — print request body without calling API

## Exit codes

- `0` — success
- `1` — usage, config, network, or provider error
- `2` — `--fail-on` predicate matched

## Provider routing

| Env | Endpoint |
|---|---|
| `TYPESAFE_API_KEY` set | `POST https://api.typesafe.ai/v1/systemone` (model `jev-latest`) |
| only `OPENROUTER_API_KEY` set | `POST https://openrouter.ai/api/alpha/decisions` (model `~typesafe/jev-latest`) |
| neither | exit 1 with hint |

## Design notes

This is a reimplementation. Source code is original; design intent
informed by the public API contract only. See `brief.md` for behavioural spec.

## License

MIT