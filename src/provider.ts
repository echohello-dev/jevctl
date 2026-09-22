// Provider routing: TypeSafe direct > OpenRouter > error
// TYPESAFE_API_KEY and OPENROUTER_API_KEY env vars
// Optional file fallback at ~/.config/jevctl/key (mode 0600)

export type ProviderName = "typesafe" | "openrouter";

export interface ProviderConfig {
  name: ProviderName;
  url: string;
  key: string;
  model: string;
}

const TYPESAFE_URL = "https://api.typesafe.ai/v1/systemone";
const TYPESAFE_MODEL = "jev-latest";
const OPENROUTER_URL = "https://openrouter.ai/api/alpha/decisions";
const OPENROUTER_MODEL = "~typesafe/jev-latest";

export async function resolveProvider(env = process.env, home = process.env.HOME): Promise<ProviderConfig | null> {
  const typesafeKey = env.TYPESAFE_API_KEY ?? (await readKeyFile(home));
  if (typesafeKey) {
    return { name: "typesafe", url: TYPESAFE_URL, key: typesafeKey, model: TYPESAFE_MODEL };
  }
  if (env.OPENROUTER_API_KEY) {
    return { name: "openrouter", url: OPENROUTER_URL, key: env.OPENROUTER_API_KEY, model: OPENROUTER_MODEL };
  }
  return null;
}

async function readKeyFile(home: string | undefined): Promise<string | null> {
  if (!home) return null;
  const { readFile } = await import("node:fs/promises");
  const { existsSync } = await import("node:fs");
  const path = `${home}/.config/jevctl/key`;
  if (!existsSync(path)) return null;
  try {
    return (await readFile(path, "utf8")).trim() || null;
  } catch {
    return null;
  }
}

export async function callDecisions(
  provider: ProviderConfig,
  body: { state: unknown; questions: Record<string, unknown> },
  timeoutMs: number,
): Promise<{ answers: Record<string, unknown>; usage?: unknown }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(provider.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.key}`,
      },
      body: JSON.stringify({ ...body, model: provider.model }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`provider ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as { answers: Record<string, unknown>; usage?: unknown };
    return json;
  } finally {
    clearTimeout(timer);
  }
}