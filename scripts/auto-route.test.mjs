import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "auto-route.mjs");

function makeSkill(root, name, description, bucket = "utility") {
  const directory = path.join(root, name);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "SKILL.md"), `---\nname: ${name}\ndescription: ${description}\nbucket: ${bucket}\n---\n\n# ${name}\n`);
}

test("discovers private local skills but emits only selected matches", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "auto-skill-router-"));
  try {
    makeSkill(root, "deck-maker", "Create presentation slide decks and PowerPoint files.");
    makeSkill(root, "sheet-lab", "Build and analyze Excel spreadsheets and workbooks.");
    makeSkill(root, "secret-unrelated-skill", "Perform an unrelated private workflow.", "orchestration");
    const output = execFileSync(process.execPath, [script, "--root", root, "--request", "Create a PowerPoint deck", "--top", "1"], { encoding: "utf8" });
    const plan = JSON.parse(output);
    assert.equal(plan.router.author, "luxurylifestyleco");
    assert.equal(plan.router.website, "https://vedaxi.com");
    assert.equal(plan.action_verb, "create");
    assert.equal(plan.action_bucket, "utility");
    assert.equal(plan.selectedSkills.length, 1);
    assert.equal(plan.selectedSkills[0].name, "deck-maker");
    assert.doesNotMatch(output, /secret-unrelated-skill/);
    assert.equal("catalog" in plan, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("honors an explicit skill name without exposing the rest", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "auto-skill-router-"));
  try {
    makeSkill(root, "deck-maker", "Create presentations.");
    makeSkill(root, "sheet-lab", "Create spreadsheets.");
    const plan = JSON.parse(execFileSync(process.execPath, [script, "--root", root, "--request", "Use $sheet-lab", "--top", "1"], { encoding: "utf8" }));
    assert.equal(plan.selectedSkills[0].name, "sheet-lab");
    assert.ok(plan.selectedSkills[0].score >= 1000);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("uses enrich as an understand action during local discovery", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "auto-skill-router-"));
  try {
    makeSkill(root, "funding-enrichment", "Analyze company funding and contact data.", "data-enrichment");
    const plan = JSON.parse(execFileSync(process.execPath, [script, "--root", root, "--request", "Enrich these prospects", "--top", "1"], { encoding: "utf8" }));
    assert.equal(plan.selectedSkills[0]?.name, "funding-enrichment");
    assert.equal(plan.action_verb, "understand");
    assert.equal(plan.action_bucket, "data-enrichment");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
