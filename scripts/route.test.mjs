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

test("creates four buckets before selecting the agent", () => {
  const plan = run("--request", "Task: Create a Word document\nContext: quarterly results\nConstraints: under ten pages\nOutput: .docx");
  assert.deepEqual(Object.keys(plan.buckets), ["task", "context", "constraints", "output"]);
  assert.equal(plan.router.author, "luxurylifestyleco");
  assert.equal(plan.router.website, "https://vedaxi.com");
  assert.equal(plan.bucketMethod, "explicit-headings");
  assert.equal(plan.agent, "document-agent");
  assert.deepEqual(plan.skills, ["documents"]);
});

test("accepts a structured batch and preserves its ID", () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "skill-router-test-"));
  const input = path.join(temporary, "requests.jsonl");
  try {
    fs.writeFileSync(input, `${JSON.stringify({
      id: "r-1",
      message: "Build it",
      buckets: { task: "Build an Excel workbook", context: "sales", constraints: "", output: ".xlsx" }
    })}\n`);
    const plan = JSON.parse(execFileSync(process.execPath, [script, "--manifest", manifest, "--input", input], { encoding: "utf8" }));
    assert.equal(plan.id, "r-1");
    assert.equal(plan.bucketMethod, "structured");
    assert.equal(plan.agent, "data-agent");
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test("reports explicitly requested skills that are unavailable", () => {
  const plan = run("--request", "Use $presentations to make a Word document", "--available", "documents");
  assert.deepEqual(plan.explicitSkills, ["presentations"]);
  assert.deepEqual(plan.unavailableSkills, ["presentations"]);
  assert.deepEqual(plan.skills, ["documents"]);
});

test("falls back when no route matches", () => {
  const plan = run("--request", "Explain this function");
  assert.equal(plan.agent, "general-agent");
  assert.deepEqual(plan.matchedRoutes, []);
});

test("classifies enrich and enrichment as analysis verbs", () => {
  const enrich = run("--request", "Enrich this prospect list with company funding and contact details");
  const enrichment = run("--request", "Run enrichment on this prospect list");
  assert.ok(enrich.verbs.includes("analyze"));
  assert.ok(enrichment.verbs.includes("analyze"));
  assert.equal(enrich.agent, "research-agent");
  assert.deepEqual(enrich.skills, ["company-research", "contact-enrichment"]);
});

test("rejects invalid route patterns before routing", () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "skill-router-test-"));
  const broken = path.join(temporary, "broken.json");
  try {
    fs.writeFileSync(broken, JSON.stringify({ version: 1, routes: [{ id: "bad", agent: "bad-agent", match: { patterns: ["("] } }] }));
    const result = spawnSync(process.execPath, [script, "--manifest", broken, "--request", "anything"], { encoding: "utf8" });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /invalid pattern/);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
