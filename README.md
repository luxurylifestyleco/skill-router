# Skill Router by [@luxurylifestyleco](https://github.com/luxurylifestyleco) / [VEDAXI](https://vedaxi.com)

**Install skills. Forget their names. Ask naturally.**

Skill Router is a deterministic, platform-agnostic routing layer between a user request and agent execution. It classifies the request before the main LLM, selects one primary skill plus only required supporting skills, and emits an auditable verdict without exposing the full local skill catalog.

```text
user request -> 8 action buckets -> 4 purpose buckets -> risk/dependencies
             -> primary + supporting skills -> agent -> LLM -> verification/ledger
```

Created by **[@luxurylifestyleco](https://github.com/luxurylifestyleco)** at **[VEDAXI](https://vedaxi.com)**.

## The router model

The eight action buckets describe what the request is doing. They map mechanically to the four purpose buckets used by each skill's `bucket:` frontmatter.

| Action bucket | Purpose bucket | Typical verbs |
| --- | --- | --- |
| `sense` | `data-enrichment` | capture, ingest, scrape, watch, monitor, crawl, record, subscribe, poll |
| `understand` | `data-enrichment` | research, retrieve, analyze, summarize, interpret, investigate, enrich |
| `decide` | `orchestration` | plan, prioritize, synthesize, weigh, recommend, strategize, choose, roadmap |
| `create` | `utility` | write, draft, design, build, generate, compose, render, craft, create, produce |
| `operate` | `orchestration` | execute, run, deploy, dispatch, trigger, schedule, automate, start, stop |
| `verify` | `verification` | audit, verify, validate, review, test, scan, inspect, fact-check, QA, harden, check |
| `learn` | `orchestration` | distill, memorize, reflect, improve, repair, archive, learn, reconcile, prune |
| `govern` | `verification` | authorize, approve, gate, enforce, comply, policy, permission, human gate |

Risk is resolved after classification. Routine, dependency-ready routes can proceed. Governance and material markers produce `risk=human`. Missing evidence or unavailable dependencies produce `status=blocked`; the router does not guess.

## What ships in v1.0.1

| Component | Working behavior |
| --- | --- |
| `taxonomy.mjs` | Deterministically classifies the eight action buckets and maps the four purpose buckets |
| `auto-route.mjs` | Finds locally installed skills under caller-supplied roots and emits selected matches only |
| `route.mjs` | Applies trusted purpose-bucket, agent, and skill policies |
| JSONL batch mode | Streams requests and routing plans without buffering a full batch |
| Privacy boundary | Does not bundle or emit a private catalog, call a service, or collect telemetry |
| Runtime | Node.js 18+, zero package dependencies, Windows/macOS/Linux |

## 60-second demo

```bash
node scripts/route.mjs \
  --manifest examples/routes.json \
  --request "Create a sales workbook for the Q3 forecast as .xlsx" \
  --pretty
```

```json
{
  "action_verb": "create",
  "action_bucket": "utility",
  "risk": "routine",
  "status": "routed",
  "agent": "data-agent",
  "skills": ["spreadsheets"],
  "primary": "spreadsheets",
  "supporting": [],
  "matchedRoutes": [{"id": "spreadsheets", "score": 108}]
}
```

Automatically select from downloaded skills without remembering their names:

```bash
node scripts/auto-route.mjs \
  --root /path/to/my/skills \
  --request "Create a PowerPoint deck from these results" \
  --top 2 \
  --pretty
```

The discovery router reads local `name`, `description`, and `bucket` frontmatter. It never prints or serializes the complete catalog.

## Install as an agent skill

```bash
npx skills add luxurylifestyleco/skill-router --skill skill-router
```

Loading `SKILL.md` gives an agent the routing method. True pre-LLM interception requires one separate, approved host-native installation.

## One-time pre-LLM installation

```text
one-time install -> detect host -> show exact adapter patch -> user verifies/approves
                 -> install + ordering test
future request   -> pre-LLM adapter -> deterministic router -> selected skills -> main LLM
```

The installer must be idempotent and approval-first. It may not silently edit configuration merely because this skill was installed. After activation, normal requests route automatically. Human Gates remain separate for publishing, spending, credentials, authorization, external commitments, and other material actions.

The primary adapter targets are Claude Code, Codex, Hermes Agent, OpenRouter, Google Antigravity, Grok/xAI, OpenClaw, Qwen, DeepSeek, GLM, and Kimi. The core is host-independent; each adapter must use and verify the host's real lifecycle surface. See [`references/host-adapters.md`](references/host-adapters.md).

## Batch routing

Each input line is a string or an object with `message` and optional `id`:

```jsonl
{"id":"1","message":"Create a quarterly deck"}
{"id":"2","message":"Build an Excel model for the Q3 forecast with no macros"}
```

```bash
node scripts/route.mjs --manifest examples/routes.json --input requests.jsonl
```

Output is JSONL, so a harness can stream plans to workers. Each verdict includes `action_verb`, `action_bucket`, `risk`, `status`, `primary`, `supporting`, selected skills, route evidence, and unavailable explicitly requested skills.

## Route manifest

Every route declares one of the four purpose buckets and may restrict matches to one or more of the eight action buckets:

```json
{
  "id": "presentations",
  "bucket": "utility",
  "agent": "presentation-agent",
  "skills": ["presentations"],
  "match": {
    "verbs": ["create"],
    "any": ["slide deck", "presentation", "powerpoint"]
  }
}
```

## Safety and privacy

- One primary skill; only required supporting skills.
- Explicit `$skill-name` requests are untrusted input: they route only when the manifest already declares that skill for the classified purpose bucket, and only when it is available. Everything else is reported in `unavailableSkills` and never becomes `primary`.
- Invalid manifests, missing evidence, and missing dependencies fail closed.
- Material or authorization-bearing requests reach a Human Gate.
- Routing selects context; it does not execute skills or grant permission.
- The public package contains no private catalog, local skill counts, or private skill names.
- The router makes no network calls and includes no telemetry.

## Verify

```bash
npm test
npm run check
```

The behavioral suite covers all eight action buckets, all four mappings, local discovery, explicit skill selection, privacy, batching, enrichment routing, Human Gates, fallback, and invalid manifests.

## Platform status

The executable release is the provider-neutral routing core. Host adapters remain `designed` until adapter code, contract tests, and a real-host smoke test prove pre-model ordering. Consumer chat websites cannot be intercepted without a supported hook, extension, or application-controlled API request.

See [`references/pipeline.md`](references/pipeline.md) for the contract and [`SECURITY.md`](SECURITY.md) for the trust boundary.

## License

MIT. See [`LICENSE`](LICENSE).

If Skill Router saves you from memorizing a growing skill stack, star [the repository](https://github.com/luxurylifestyleco/skill-router) and share a routing case. More from [VEDAXI](https://vedaxi.com).
