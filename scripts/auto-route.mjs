#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const STOP = new Set("a an and are as at be by can do for from how i in into is it of on or our please should that the their this to use we what when with you your".split(" "));
const IDENTITY = { name: "skill-router", version: "1.0.0", author: "luxurylifestyleco", website: "https://vedaxi.com" };
const GROUPS = [
  ["create", "make", "build", "generate", "draft", "author"],
  ["analyze", "analyse", "assess", "evaluate", "inspect", "enrich", "enrichment"],
  ["find", "search", "discover", "locate", "research"],
  ["fix", "repair", "resolve", "debug", "diagnose"],
  ["route", "dispatch", "delegate", "select", "choose"],
  ["slides", "slide", "deck", "presentation", "powerpoint", "ppt", "pptx"],
  ["spreadsheet", "excel", "workbook", "xlsx", "csv", "table"],
  ["document", "word", "doc", "docx", "report"],
  ["image", "picture", "graphic", "visual", "illustration"],
  ["video", "movie", "clip", "footage"],
  ["test", "verify", "validate", "check"],
  ["publish", "release", "ship", "distribute", "share"]
];
const SYNONYMS = new Map(GROUPS.flatMap((group) => group.map((word) => [word, group])));
const USAGE = `Skill Router by @luxurylifestyleco / VEDAXI — https://vedaxi.com

Usage:
  node scripts/auto-route.mjs --root <skills-folder> [--root <folder> ...] --request <message>

Options:
  --top <number>       Maximum selected skills (default: 3)
  --min-score <score>  Minimum lexical score (default: 1)
  --pretty             Pretty-print JSON
  --help               Show this help`;

function fail(message) {
  process.stderr.write(`skill-router: ${message}\n`);
  process.exit(2);
}

function parseArgs(argv) {
  const options = { roots: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === "--help") options.help = true;
    else if (key === "--pretty") options.pretty = true;
    else if (["--root", "--request", "--top", "--min-score"].includes(key)) {
      const value = argv[++index];
      if (value === undefined) fail(`${key} requires a value`);
      if (key === "--root") options.roots.push(value);
      else options[key.slice(2)] = value;
    } else fail(`unknown option ${key}`);
  }
  return options;
}

function unquote(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function frontmatter(file) {
  const text = fs.readFileSync(file, "utf8");
  const match = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const lines = match[1].split(/\r?\n/);
  const fields = {};
  for (let index = 0; index < lines.length; index += 1) {
    const field = lines[index].match(/^([a-zA-Z][\w-]*):\s*(.*)$/);
    if (!field || !["name", "description"].includes(field[1])) continue;
    let value = field[2];
    if (/^[>|][-+]?\s*$/.test(value)) {
      const parts = [];
      while (lines[index + 1]?.match(/^\s+/)) parts.push(lines[++index].trim());
      value = parts.join(" ");
    }
    fields[field[1]] = unquote(value);
  }
  if (!fields.name || !fields.description) return null;
  return fields;
}

function discover(roots) {
  const skills = [];
  const visited = new Set();
  function walk(entry) {
    let real;
    try { real = fs.realpathSync(entry); } catch { return; }
    if (visited.has(real)) return;
    visited.add(real);
    const stat = fs.statSync(real);
    if (!stat.isDirectory()) return;
    const skillFile = path.join(real, "SKILL.md");
    if (fs.existsSync(skillFile)) {
      const metadata = frontmatter(skillFile);
      if (metadata) skills.push({ ...metadata, path: skillFile });
      return;
    }
    for (const child of fs.readdirSync(real, { withFileTypes: true })) {
      if (["node_modules", ".git"].includes(child.name)) continue;
      if (child.isDirectory() || child.isSymbolicLink()) walk(path.join(real, child.name));
    }
  }
  for (const root of roots) walk(path.resolve(root));
  return skills;
}

function stem(token) {
  return token.replace(/(ing|edly|edly|ed|es|s)$/i, "");
}

function tokens(text, expand = false) {
  const base = text.toLowerCase().replace(/([a-z])([A-Z])/g, "$1 $2").split(/[^a-z0-9]+/)
    .map(stem).filter((token) => token.length > 1 && !STOP.has(token));
  if (!expand) return base;
  return [...base, ...base.flatMap((token) => SYNONYMS.get(token) ?? [])].map(stem);
}

function rank(message, skills) {
  const query = tokens(message, true);
  const querySet = new Set(query);
  const documents = skills.map((skill) => ({
    ...skill,
    nameTokens: tokens(skill.name.replaceAll("-", " ")),
    descriptionTokens: tokens(skill.description)
  }));
  const frequency = new Map();
  for (const document of documents) {
    for (const token of new Set([...document.nameTokens, ...document.descriptionTokens])) {
      frequency.set(token, (frequency.get(token) ?? 0) + 1);
    }
  }
  const explicit = [...message.matchAll(/(?:^|\s)\$([a-z0-9]+(?:-[a-z0-9]+)*)\b/g)].map((match) => match[1]);
  return documents.map((document) => {
    let score = explicit.includes(document.name) ? 1000 : 0;
    const matched = [];
    for (const token of querySet) {
      const inName = document.nameTokens.includes(token);
      const inDescription = document.descriptionTokens.includes(token);
      if (!inName && !inDescription) continue;
      const idf = Math.log((documents.length + 1) / ((frequency.get(token) ?? 0) + 1)) + 1;
      score += idf * (inName ? 4 : 1);
      matched.push(token);
    }
    return { name: document.name, description: document.description, path: document.path, score, matched: [...new Set(matched)] };
  }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  process.stdout.write(`${USAGE}\n`);
  process.exit(0);
}
if (!options.roots.length) fail("at least one --root is required");
if (typeof options.request !== "string" || !options.request.trim()) fail("--request is required");
const top = options.top === undefined ? 3 : Number(options.top);
const minScore = options["min-score"] === undefined ? 1 : Number(options["min-score"]);
if (!Number.isInteger(top) || top < 1 || !Number.isFinite(minScore)) fail("invalid --top or --min-score");

const catalog = discover(options.roots);
const selected = rank(options.request, catalog).filter((skill) => skill.score >= minScore).slice(0, top);
const result = {
  version: 1,
  router: IDENTITY,
  message: options.request,
  selectedSkills: selected.map((skill) => ({
    name: skill.name,
    path: skill.path,
    score: Number(skill.score.toFixed(3)),
    matched: skill.matched
  })),
  reason: selected.length ? `Selected ${selected.length} local skill${selected.length > 1 ? "s" : ""}` : "No local skill met the threshold"
};
process.stdout.write(`${JSON.stringify(result, null, options.pretty ? 2 : 0)}\n`);
