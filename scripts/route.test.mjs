import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(directory, "route.mjs");
const manifest = path.join(directory, "..", "examples", "routes.json");

function run(...arguments_) {
  return JSON.parse(execFileSync(process.execPath, [script, "--manifest", manifest, ...arguments_], { encoding: "utf8" }));
}

test("classifies the eight action buckets and maps them to the four purpose buckets", () => {
  const fixtures = [
    ["capture screenshots of the landing page and ingest the image set", "sense", "data-enrichment"],
    ["research this company's funding history and decision-makers", "understand", "data-enrichment"],
    ["plan the Q3 strategy and prioritize the roadmap", "decide", "orchestration"],
    ["write a LinkedIn post about agent readiness", "create", "utility"],
    ["run the weekly cron and dispatch the background workers", "operate", "orchestration"],
    ["audit this codebase for PII", "verify", "verification"],
    ["distill this week's outcomes into a skill update", "learn", "orchestration"],
    ["approve the deployment and grant permission", "govern", "verification"]
  ];
  for (const [message, actionVerb, actionBucket] of fixtures) {
    const plan = run("--request", message);
    assert.equal(plan.action_verb, actionVerb, message);
    assert.equal(plan.action_bucket, actionBucket, message);
    assert.equal("buckets" in plan, false, message);
    assert.equal("verbs" in plan, false, message);
  }
});

test("selects a utility route after action and purpose classification", () => {
  const plan = run("--request", "Create a Word document with quarterly results as a .docx");
  assert.equal(plan.router.author, "luxurylifestyleco");
  assert.equal(plan.router.website, "https://vedaxi.com");
  assert.equal(plan.action_verb, "create");
  assert.equal(plan.action_bucket, "utility");
  assert.equal(plan.risk, "routine");
  assert.equal(plan.agent, "document-agent");
  assert.deepEqual(plan.skills, ["documents"]);
});

test("accepts a structured batch and preserves its ID", () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "skill-router-test-"));
  const input = path.join(temporary, "requests.jsonl");
  try {
    fs.writeFileSync(input, `${JSON.stringify({
      id: "r-1",
      message: "Build an Excel workbook for sales as an .xlsx"
    })}\n`);
    const plan = JSON.parse(execFileSync(process.execPath, [script, "--manifest", manifest, "--input", input], { encoding: "utf8" }));
    assert.equal(plan.id, "r-1");
    assert.equal(plan.action_verb, "create");
    assert.equal(plan.action_bucket, "utility");
    assert.equal(plan.agent, "data-agent");
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test("reports explicitly requested skills that are unavailable", () => {
  const plan = run("--request", "Use $presentations to create a Word document", "--available", "documents");
  assert.deepEqual(plan.explicitSkills, ["presentations"]);
  assert.deepEqual(plan.unavailableSkills, ["presentations"]);
  assert.deepEqual(plan.skills, ["documents"]);
});

test("falls back when no route matches", () => {
  const plan = run("--request", "Explain this function");
  assert.equal(plan.agent, "general-agent");
  assert.deepEqual(plan.matchedRoutes, []);
});

test("classifies enrich and enrichment as understand actions", () => {
  const enrich = run("--request", "Enrich this prospect list with company funding and contact details");
  const enrichment = run("--request", "Run enrichment on this prospect list");
  assert.equal(enrich.action_verb, "understand");
  assert.equal(enrichment.action_verb, "understand");
  assert.equal(enrich.action_bucket, "data-enrichment");
  assert.equal(enrich.agent, "research-agent");
  assert.deepEqual(enrich.skills, ["company-research", "contact-enrichment"]);
});

test("raises a human risk gate for material actions", () => {
  const plan = run("--request", "audit this codebase for PII before we publish");
  assert.equal(plan.action_verb, "verify");
  assert.equal(plan.action_bucket, "verification");
  assert.equal(plan.risk, "human");
  assert.equal(plan.status, "blocked");
});

test("routes a dream maintenance request to the dream skill", () => {
  const plan = run("--request", "Run the dream maintenance cron", "--available", "dream");
  assert.equal(plan.agent, "maintenance-agent");
  assert.deepEqual(plan.skills, ["dream"]);
});

test("rejects invalid route patterns before routing", () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "skill-router-test-"));
  const broken = path.join(temporary, "broken.json");
  try {
    fs.writeFileSync(broken, JSON.stringify({ version: 1, routes: [{ id: "bad", bucket: "utility", agent: "bad-agent", match: { patterns: ["("] } }] }));
    const result = spawnSync(process.execPath, [script, "--manifest", broken, "--request", "anything"], { encoding: "utf8" });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /invalid pattern/);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
