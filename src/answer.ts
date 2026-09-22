// One judgment per command. Each returns a normalised answer object.
// Answers shape: { choice, probabilities, confidence } or { noul, confidence } or { score, legend, confidence }

export interface ChoiceAnswer {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence?: number;
}

export interface NoulAnswer {
  type: "noul";
  noul: number;
  confidence?: number;
}

export interface ScoreAnswer {
  type: "score";
  score: number;
  legend?: Record<string, string>;
  confidence?: number;
}

export type Answer = ChoiceAnswer | NoulAnswer | ScoreAnswer;

export function normalise(raw: unknown, key: string): Answer {
  const obj = raw as Record<string, unknown>;
  const type = obj.type as string;
  if (type === "choice") {
    return {
      type: "choice",
      choice: String(obj.choice),
      probabilities: (obj.probabilities as Record<string, number>) ?? {},
      confidence: obj.confidence as number | undefined,
    };
  }
  if (type === "noul" || type === "null") {
    return { type: "noul", noul: Number(obj.noul ?? 0), confidence: obj.confidence as number | undefined };
  }
  if (type === "score") {
    return {
      type: "score",
      score: Number(obj.score ?? 0),
      legend: obj.legend as Record<string, string> | undefined,
      confidence: obj.confidence as number | undefined,
    };
  }
  throw new Error(`unknown answer type for "${key}": ${type}`);
}

// --fail-on predicate evaluation
export function shouldFail(answer: Answer, predicate: string | undefined): boolean {
  if (!predicate) return false;
  switch (answer.type) {
    case "choice":
      return predicate === answer.choice;
    case "noul":
      if (predicate === "true") return answer.noul >= 0.5;
      if (predicate === "false") return answer.noul <= 0.5;
      return false;
    case "score":
      const n = Number(predicate);
      return !Number.isNaN(n) && answer.score >= n;
  }
}