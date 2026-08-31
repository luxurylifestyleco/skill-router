import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "auto-route.mjs");

function makeSkill(root, name, description) {
  const directory = path.join(root, name);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "SKILL.md"), `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`);
}

test("discovers private local skills but emits only selected matches", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "auto-skill-router-"));
  try {
    makeSkill(root, "deck-maker", "Create presentation slide decks and PowerPoint files.");
    makeSkill(root, "sheet-lab", "Build and analyze Excel spreadsheets and workbooks.");
    makeSkill(root, "secret-unrelated-skill", "Perform an unrelated private workflow.");
    const output = execFileSync(process.execPath, [script, "--root", root, "--request", "Make a PowerPoint deck", "--top", "1"], { encoding: "utf8" });
    const plan = JSON.parse(output);
    assert.equal(plan.router.author, "luxurylifestyleco");
    assert.equal(plan.router.website, "https://vedaxi.com");
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

test("uses enrich as an analysis signal during local discovery", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "auto-skill-router-"));
  try {
    makeSkill(root, "funding-enrichment", "Analyze company funding and contact data.");
    const plan = JSON.parse(execFileSync(process.execPath, [script, "--root", root, "--request", "Enrich these prospects", "--top", "1"], { encoding: "utf8" }));
    assert.equal(plan.selectedSkills[0]?.name, "funding-enrichment");
    assert.ok(plan.selectedSkills[0].matched.includes("analyze"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
