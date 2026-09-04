#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import readline from "node:readline";
import { ACTION_VERBS, PURPOSE_BUCKETS, classifyAction } from "./taxonomy.mjs";

const IDENTITY = { name: "skill-router", version: "1.0.1", author: "luxurylifestyleco", website: "https://vedaxi.com" };
const USAGE = `Skill Router by @luxurylifestyleco / VEDAXI — https://vedaxi.com

Usage:
  node scripts/route.mjs --manifest <file> --request <message>
  node scripts/route.mjs --manifest <file> --input <jsonl-file|->

Options:
  --available <skill-a,skill-b>  Restrict output to available skills
  --id <value>                   Attach an ID to one request
  --pretty                       Pretty-print one-request output
  --help                         Show this help`;

function fail(message) { process.stderr.write(`skill-router: ${message}\n`); process.exit(2); }
function list(value, field) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) fail(`${field} must be a string array`);
  return value;
}
const clean = (text) => text.trim().replace(/\s+/g, " ");
const unique = (items) => [...new Set(items)];

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
    if (!PURPOSE_BUCKETS.includes(route.bucket)) fail(`${at}.bucket must be one of ${PURPOSE_BUCKETS.join(", ")}`);
    const match = route.match ?? {};
    const verbs = list(match.verbs, `${at}.match.verbs`).map((verb) => verb.toLowerCase());
    if (verbs.some((verb) => !(verb in ACTION_VERBS))) fail(`${at}.match.verbs contains an unknown action bucket`);
    const patterns = list(match.patterns, `${at}.match.patterns`).map((source) => {
      try { return { source, regex: new RegExp(source, "i") }; }
      catch (error) { fail(`${at} has invalid pattern ${JSON.stringify(source)}: ${error.message}`); }
    });
    return {
      id: route.id,
      bucket: route.bucket,
      agent: route.agent,
      skills: list(route.skills, `${at}.skills`),
      priority: Number.isFinite(route.priority) ? route.priority : 0,
      match: {
        verbs,
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
  const fallback = { agent: raw.fallback?.agent || "general-agent", skills: list(raw.fallback?.skills, "fallback.skills") };
  const skillBuckets = new Map();
  const declare = (name, bucket) => {
    if (!skillBuckets.has(name)) skillBuckets.set(name, new Set());
    skillBuckets.get(name).add(bucket);
  };
  for (const entry of routes) for (const name of entry.skills) declare(name, entry.bucket);
  for (const name of fallback.skills) for (const bucket of PURPOSE_BUCKETS) declare(name, bucket);
  return { routes, maxRoutes, minScore, fallback, skillBuckets };
}

function score(route, message, actionVerb) {
  if (route.match.verbs.length && !route.match.verbs.includes(actionVerb)) return null;
  const text = message.toLowerCase();
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

function normalize(item) {
  const message = typeof item === "string" ? item : (item?.message ?? item?.request);
  if (typeof message !== "string" || !message.trim()) throw new Error("input needs a non-empty message");
  return { id: typeof item === "object" && item?.id !== undefined ? String(item.id) : undefined, message };
}

function route(manifest, item, available) {
  const input = normalize(item);
  const classification = classifyAction(input.message);
  const matched = manifest.routes
    .filter((entry) => entry.bucket === classification.action_bucket)
    .map((entry) => ({ route: entry, score: score(entry, input.message, classification.action_verb) }))
    .filter((entry) => entry.score !== null && entry.score >= manifest.minScore)
    .sort((a, b) => b.score - a.score || a.route.id.localeCompare(b.route.id))
    .slice(0, manifest.maxRoutes);
  // A $skill-name arrives inside the untrusted message, so it may only name a skill the
  // manifest already declares for this purpose bucket. Anything else is reported, not routed.
  const requested = unique([...input.message.matchAll(/(?:^|\s)\$([a-z0-9]+(?:-[a-z0-9]+)*)\b/g)].map((match) => match[1]));
  const explicit = requested.filter((name) => manifest.skillBuckets.get(name)?.has(classification.action_bucket));
  const candidates = unique([...explicit, ...(matched.length ? matched.flatMap((entry) => entry.route.skills) : manifest.fallback.skills)]);
  const skills = available ? candidates.filter((name) => available.has(name)) : candidates;
  const unavailableSkills = unique([
    ...requested.filter((name) => !explicit.includes(name)),
    ...(available ? candidates.filter((name) => !available.has(name)) : [])
  ]);
  const blocked = classification.risk === "human" || skills.length === 0;
  return {
    version: 1,
    router: IDENTITY,
    ...(input.id === undefined ? {} : { id: input.id }),
    message: input.message,
    ...classification,
    status: blocked ? "blocked" : "routed",
    agent: matched[0]?.route.agent ?? manifest.fallback.agent,
    skills,
    primary: skills[0] ?? null,
    supporting: skills.slice(1, 4),
    matchedRoutes: matched.map((entry) => ({ id: entry.route.id, score: entry.score })),
    explicitSkills: requested,
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
if (options.help) { process.stdout.write(`${USAGE}\n`); process.exit(0); }
if (!options.manifest) fail("--manifest is required");
if (Boolean(options.request) === Boolean(options.input)) fail("provide exactly one of --request or --input");
if (options.pretty && options.input) fail("--pretty only works with --request");
const manifest = loadManifest(path.resolve(options.manifest));
const available = options.available === undefined ? null : new Set(options.available.split(",").map(clean).filter(Boolean));
try {
  if (options.request) {
    process.stdout.write(`${JSON.stringify(route(manifest, { id: options.id, message: options.request }, available), null, options.pretty ? 2 : 0)}\n`);
  } else {
    for await (const item of jsonLines(options.input)) process.stdout.write(`${JSON.stringify(route(manifest, item, available))}\n`);
  }
} catch (error) { fail(error.message); }
