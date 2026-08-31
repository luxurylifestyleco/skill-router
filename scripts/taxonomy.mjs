export const ACTION_VERBS = {
  sense: ["capture", "ingest", "scrape", "watch", "monitor", "crawl", "record", "subscribe", "poll"],
  understand: ["research", "retrieve", "analyze", "summarize", "interpret", "investigate", "understand", "deep-dive", "enrich", "enrichment"],
  decide: ["plan", "prioritize", "decide", "synthesize", "weigh", "recommend", "strategize", "choose", "roadmap"],
  create: ["write", "draft", "design", "build", "generate", "compose", "render", "craft", "create", "produce"],
  operate: ["execute", "run", "deploy", "operate", "dispatch", "trigger", "schedule", "automate", "start", "stop"],
  verify: ["audit", "verify", "validate", "review", "test", "scan", "inspect", "fact-check", "qa", "harden", "check"],
  learn: ["distill", "memorize", "reflect", "improve", "repair", "archive", "learn", "update-skill", "reconcile", "prune"],
  govern: ["authorize", "approve", "gate", "enforce", "comply", "policy", "permission", "human-gate"]
};

export const ACTION_TO_PURPOSE = {
  sense: "data-enrichment",
  understand: "data-enrichment",
  decide: "orchestration",
  create: "utility",
  operate: "orchestration",
  verify: "verification",
  learn: "orchestration",
  govern: "verification"
};

export const PURPOSE_BUCKETS = ["utility", "verification", "data-enrichment", "orchestration"];

const STOP = new Set(["for", "we", "this", "the", "and", "our", "before", "into", "with"]);
const MATERIAL = ["approve", "authorize", "sign", "commit", "purchase", "deploy", "publish", "spend", "grant", "permission", "external", "money"];

export function tokens(text) {
  return new Set((text ?? "").toLowerCase().match(/[a-z0-9][a-z0-9-]{1,}/g) ?? []);
}

export function keywordMatches(keyword, tokenSet) {
  if (STOP.has(keyword)) return false;
  return [...tokenSet].some((token) => token === keyword || (token.length >= 4 && token.startsWith(keyword)));
}

export function classifyAction(signal) {
  const tokenSet = tokens(signal);
  let actionVerb = "operate";
  let bestScore = 0;
  for (const [verb, keywords] of Object.entries(ACTION_VERBS)) {
    const hits = keywords.filter((keyword) => keywordMatches(keyword, tokenSet)).length;
    const score = hits / keywords.length;
    if (score > bestScore) {
      actionVerb = verb;
      bestScore = score;
    }
  }
  const lower = signal.toLowerCase();
  const risk = actionVerb === "govern" || MATERIAL.some((word) => lower.includes(word)) ? "human" : "routine";
  return { action_verb: actionVerb, action_bucket: ACTION_TO_PURPOSE[actionVerb], risk };
}
