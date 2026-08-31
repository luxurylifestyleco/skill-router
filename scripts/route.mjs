#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import readline from "node:readline";

const BUCKETS = ["task", "context", "constraints", "output"];
const VERB_FORMS = new Map(Object.entries({
  add: ["add", "append", "include"],
  analyze: ["analyze", "analyse", "assess", "enrich", "enrichment"],
  audit: ["audit", "inspect"],
  build: ["build", "implement", "develop"],
  classify: ["classify", "bucket", "categorize", "categorise"],
  compare: ["compare", "contrast"],
  configure: ["configure", "set up", "setup"],
  convert: ["convert", "transform"],
  create: ["create", "make", "generate", "draft"],
  debug: ["debug", "diagnose", "investigate"],
  deploy: ["deploy", "release", "ship"],
  design: ["design", "prototype"],
  edit: ["edit", "revise", "rewrite"],
  explain: ["explain", "teach", "describe"],
  extract: ["extract", "parse"],
  find: ["find", "search", "discover", "locate"],
  fix: ["fix", "repair", "resolve"],
  integrate: ["integrate", "connect"],
  migrate: ["migrate", "move", "port"],
  optimize: ["optimize", "optimise", "improve"],
  plan: ["plan", "organize", "organise"],
  publish: ["publish", "distribute", "share"],
  remove: ["remove", "delete"],
  research: ["research", "study"],
  review: ["review", "critique"],
  route: ["route", "dispatch", "delegate"],
  summarize: ["summarize", "summarise", "recap"],
  test: ["test", "verify", "validate"],
  update: ["update", "upgrade", "refresh"],
  write: ["write", "author"]
}));
const IDENTITY = { name: "skill-router", version: "1.0.0", author: "luxurylifestyleco", website: "https://vedaxi.com" };
const USAGE = `Skill Router by @luxurylifestyleco / VEDAXI — https://vedaxi.com

Usage:
  node scripts/route.mjs --manifest <file> --request <message>
  node scripts/route.mjs --manifest <file> --input <jsonl-file|->

Options:
  --available <skill-a,skill-b>  Restrict output to available skills
  --id <value>                   Attach an ID to one request
  --pretty                       Pretty-print one-request output
  --help                         Show this help`;

function fail(message) {
  process.stderr.write(`skill-router: ${message}\n`);
  process.exit(2);
}

function args(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === "--help") result.help = true;
    else if (key === "--pretty") result.pretty = true;
    else if (["--manifest", "--request", "--input", "--id", "--available"].includes(key)) {
      if (argv[i + 1] === undefined) fail(`${key} requires a value`);
      result[key.slice(2)] = argv[++i];
    } else fail(`unknown option ${key}`);
  }
  return result;
}

function list(value, field) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) fail(`${field} must be a string array`);
  return value;
}

function loadManifest(file) {
  let raw;
  try { raw = JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (error) { fail(`cannot read manifest: ${error.message}`); }
  if (raw?.version !== 1 || !Array.isArray(raw.routes)) fail("manifest version must be 1 and routes must be an array");
  const ids = new Set();
  const routes = raw.routes.map((route, index) => {
    const at = `routes[${index}]`;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(route?.id ?? "")) fail(`${at}.id is invalid`);
    if (ids.has(route.id)) fail(`duplicate route id ${route.id}`);
    ids.add(route.id);
    if (typeof route.agent !== "string" || !route.agent) fail(`${at}.agent is required`);
    const match = route.match ?? {};
    const scopes = list(match.in, `${at}.match.in`);
    if (scopes.some((name) => !BUCKETS.includes(name))) fail(`${at}.match.in contains an unknown bucket`);
    const patterns = list(match.patterns, `${at}.match.patterns`).map((source) => {
      try { return { source, regex: new RegExp(source, "i") }; }
      catch (error) { fail(`${at} has invalid pattern ${JSON.stringify(source)}: ${error.message}`); }
    });
    return {
      id: route.id,
      agent: route.agent,
      skills: list(route.skills, `${at}.skills`),
      priority: Number.isFinite(route.priority) ? route.priority : 0,
      match: {
        in: scopes.length ? scopes : BUCKETS,
        verbs: list(match.verbs, `${at}.match.verbs`).map((verb) => verb.toLowerCase()),
        any: list(match.any, `${at}.match.any`),
        all: list(match.all, `${at}.match.all`),
        none: list(match.none, `${at}.match.none`),
        extensions: list(match.extensions, `${at}.match.extensions`),
        patterns
      }
    };
  });
  const maxRoutes = raw.settings?.maxRoutes ?? 1;
  const minScore = raw.settings?.minScore ?? 1;
  if (!Number.isInteger(maxRoutes) || maxRoutes < 1 || !Number.isFinite(minScore)) fail("invalid router settings");
  return {
    routes,
    maxRoutes,
    minScore,
    fallback: {
      agent: raw.fallback?.agent || "general-agent",
      skills: list(raw.fallback?.skills, "fallback.skills")
    }
  };
}

const clean = (text) => text.trim().replace(/\s+/g, " ");

function explicitEnvelope(message, supplied) {
  if (!supplied) return null;
  const envelope = {};
  for (const bucket of BUCKETS) {
    if (typeof supplied[bucket] !== "string") fail(`buckets.${bucket} must be a string`);
    envelope[bucket] = clean(supplied[bucket]);
  }
  return envelope;
}

function extractVerbs(task, supplied) {
  if (supplied !== undefined) {
    if (!Array.isArray(supplied) || supplied.some((verb) => typeof verb !== "string" || !verb.trim())) {
      fail("verbs must be an array of non-empty strings");
    }
    return unique(supplied.map((verb) => clean(verb).toLowerCase()));
  }
  const normalized = ` ${task.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  const found = [];
  for (const [canonical, forms] of VERB_FORMS) {
    if (forms.some((form) => normalized.includes(` ${form} `))) found.push(canonical);
  }
  return found;
}

function headedEnvelope(message) {
  const found = [...message.matchAll(/(?:^|\n)\s*(task|context|constraints?|output)\s*:\s*/gi)];
  if (!found.length) return null;
  const envelope = Object.fromEntries(BUCKETS.map((name) => [name, ""]));
  for (let index = 0; index < found.length; index += 1) {
    const rawName = found[index][1].toLowerCase();
    const name = rawName.startsWith("constraint") ? "constraints" : rawName;
    const start = found[index].index + found[index][0].length;
    const end = found[index + 1]?.index ?? message.length;
    envelope[name] = clean(message.slice(start, end));
  }
  return envelope;
}

function heuristicEnvelope(message) {
  const headed = headedEnvelope(message);
  if (headed) return { buckets: headed, method: "explicit-headings" };
  const sentences = message.split(/(?<=[.!?])\s+|\n+/).map(clean).filter(Boolean);
  const buckets = Object.fromEntries(BUCKETS.map((name) => [name, []]));
  for (const sentence of sentences) {
    if (/\b(must|should|only|without|do not|don't|never|prefer|limit|under|at most|required)\b/i.test(sentence)) buckets.constraints.push(sentence);
    else if (/\b(output|deliver|return|respond|format|as (?:a|an)|\.docx|\.xlsx|\.pptx|json|markdown)\b/i.test(sentence)) buckets.output.push(sentence);
    else if (/\b(context|background|currently|existing|because|given|using|in our|for our)\b/i.test(sentence)) buckets.context.push(sentence);
    else buckets.task.push(sentence);
  }
  if (!buckets.task.length && sentences.length) buckets.task.push(sentences[0]);
  return {
    buckets: Object.fromEntries(BUCKETS.map((name) => [name, buckets[name].join(" ")])),
    method: "heuristic"
  };
}

function envelope(item) {
  const message = typeof item === "string" ? item : (item?.message ?? item?.request);
  if (typeof message !== "string" || !message.trim()) throw new Error("input needs a non-empty message");
  const supplied = typeof item === "object" && item ? explicitEnvelope(message, item.buckets) : null;
  const inferred = supplied ? null : heuristicEnvelope(message);
  const buckets = supplied ?? inferred.buckets;
  return {
    id: typeof item === "object" && item?.id !== undefined ? String(item.id) : undefined,
    message,
    buckets,
    verbs: extractVerbs(buckets.task, typeof item === "object" && item ? item.verbs : undefined),
    bucketMethod: supplied ? "structured" : inferred.method
  };
}

function score(route, buckets) {
  const text = route.match.in.map((name) => buckets[name]).join(" ").toLowerCase();
  const hits = (items) => items.filter((item) => text.includes(item.toLowerCase()));
  if (hits(route.match.none).length) return null;
  const all = hits(route.match.all);
  if (all.length !== route.match.all.length) return null;
  const any = hits(route.match.any);
  const patterns = route.match.patterns.filter(({ regex }) => regex.test(text));
  const extensions = hits(route.match.extensions);
  if (!(any.length || patterns.length || extensions.length)) return null;
  return route.priority + all.length * 10 + any.length * 4 + patterns.length * 6 + extensions.length * 8;
}

const unique = (items) => [...new Set(items)];

function route(manifest, item, available) {
  const env = envelope(item);
  const matched = manifest.routes
    .map((entry) => {
      const textScore = score(entry, env.buckets);
      const verbHits = entry.match.verbs.filter((verb) => env.verbs.includes(verb)).length;
      return { route: entry, score: textScore === null ? null : textScore + verbHits * 12 };
    })
    .filter((entry) => entry.score !== null && entry.score >= manifest.minScore)
    .sort((a, b) => b.score - a.score || a.route.id.localeCompare(b.route.id))
    .slice(0, manifest.maxRoutes);
  const explicit = unique([...env.message.matchAll(/(?:^|\s)\$([a-z0-9]+(?:-[a-z0-9]+)*)\b/g)].map((match) => match[1]));
  const candidates = unique([...explicit, ...(matched.length ? matched.flatMap((entry) => entry.route.skills) : manifest.fallback.skills)]);
  const skills = available ? candidates.filter((name) => available.has(name)) : candidates;
  const unavailableSkills = available ? candidates.filter((name) => !available.has(name)) : [];
  return {
    version: 1,
    router: IDENTITY,
    ...(env.id === undefined ? {} : { id: env.id }),
    message: env.message,
    buckets: env.buckets,
    verbs: env.verbs,
    bucketMethod: env.bucketMethod,
    agent: matched[0]?.route.agent ?? manifest.fallback.agent,
    skills,
    matchedRoutes: matched.map((entry) => ({ id: entry.route.id, score: entry.score })),
    explicitSkills: explicit,
    unavailableSkills,
    reason: matched.length ? `Matched route${matched.length > 1 ? "s" : ""}: ${matched.map((entry) => entry.route.id).join(", ")}` : "No rule matched; used fallback"
  };
}

async function* jsonLines(input) {
  const stream = input === "-" ? process.stdin : fs.createReadStream(input, "utf8");
  let number = 0;
  for await (const line of readline.createInterface({ input: stream, crlfDelay: Infinity })) {
    number += 1;
    if (!line.trim()) continue;
    try { yield JSON.parse(line); }
    catch (error) { throw new Error(`invalid JSON on line ${number}: ${error.message}`); }
  }
}

const options = args(process.argv.slice(2));
if (options.help) {
  process.stdout.write(`${USAGE}\n`);
  process.exit(0);
}
if (!options.manifest) fail("--manifest is required");
if (Boolean(options.request) === Boolean(options.input)) fail("provide exactly one of --request or --input");
if (options.pretty && options.input) fail("--pretty only works with --request");
const manifest = loadManifest(path.resolve(options.manifest));
const available = options.available === undefined ? null : new Set(options.available.split(",").map(clean).filter(Boolean));

try {
  if (options.request) {
    const plan = route(manifest, { id: options.id, message: options.request }, available);
    process.stdout.write(`${JSON.stringify(plan, null, options.pretty ? 2 : 0)}\n`);
  } else {
    for await (const item of jsonLines(options.input)) process.stdout.write(`${JSON.stringify(route(manifest, item, available))}\n`);
  }
} catch (error) { fail(error.message); }
