# Skill Router by [@luxurylifestyleco](https://github.com/luxurylifestyleco) / [VEDAXI](https://vedaxi.com)

**The open message-anatomy and routing layer between a raw user request and agent execution.**

Created by **[@luxurylifestyleco](https://github.com/luxurylifestyleco)** at **[VEDAXI](https://vedaxi.com)**. Install skills, forget their names, and ask naturally.

Skill Router turns incoming messages into an auditable four-bucket envelope, then selects an agent and skills before the main LLM runs.

```text
message -> verbs + task/context/constraints/output -> batch -> router -> agent + selected skills -> main LLM
```

The primary adapter market is Claude Code, Codex, Hermes Agent, OpenRouter, Google Antigravity, Grok/xAI, OpenClaw, Qwen, DeepSeek, GLM, and Kimi. Those names define implementation targets, not keyword stuffing. The routing contract stays host-independent while each integration uses the host's real lifecycle surface.

## What ships in v1.0

| Component | Working behavior |
| --- | --- |
| `auto-route.mjs` | Finds locally installed skills and returns only the strongest matches |
| `route.mjs` | Extracts verbs and four buckets, then applies trusted agent/skill policies |
| JSONL batch mode | Streams requests and routing plans without buffering a full batch |
| Privacy boundary | Does not emit the complete skill catalog, call a service, or collect telemetry |
| Verification | Nine behavioral tests plus JavaScript syntax checks |
| Runtime | Node.js 18+, zero package dependencies, Windows/macOS/Linux |

This repository contains executable routers, tests, examples, a versioned contract, security guidance, and contribution templates. `SKILL.md` is the agent-facing entry point—not the entire implementation.

## One-time installation model

A skill cannot route the same request that caused a host to load it. True pre-LLM behavior requires one approved, host-native adapter installation, separate from normal skill loading:

```text
one-time install -> detect host -> show exact hook patch -> user verifies/approves -> install + test
future request -> pre-LLM hook -> deterministic router -> selected skills -> main LLM
```

The installer must be idempotent and approval-first, similar to a one-time operating-system permission prompt. Routine future routing is automatic. Separate Human Gates still protect publishing, spending, credentials, external commitments, and other material actions. Unsupported hosts fall back honestly to model-side routing; they are never labeled pre-LLM.

## The four-bucket contract

Every message is preserved and organized into:

| Bucket | Meaning |
| --- | --- |
| `task` | What should happen |
| `context` | Background, inputs, and affected systems |
| `constraints` | Limits, preferences, permissions, and prohibitions |
| `output` | The expected artifact or response shape |

This gives downstream code a predictable intake shape without pretending that routing is task execution.

Canonical action verbs such as `create`, `analyze`, `fix`, `route`, and `publish` are extracted from the task. They improve confidence and make plans easier to inspect, but a generic verb never selects a domain route by itself.

## Why it exists

Agent frameworks often pass raw prose directly into a growing stream of prompts, tools, and code. That makes routing hard to inspect and failures hard to explain.

Skill Router adds a narrow preflight layer:

- preserves the original message;
- accepts explicit structured buckets or labeled prose;
- provides conservative zero-model heuristics as a fallback;
- routes one request or streaming JSONL batches;
- allowlists skills available in the current host;
- emits scores, matched route IDs, and unavailable skills;
- never calls an LLM, executes a skill, or grants permission.

## 60-second demo

Requires Node.js 18 or newer. There are no package dependencies.

```bash
node scripts/route.mjs \
  --manifest examples/routes.json \
  --request "Task: Create a sales workbook
Context: Q3 pipeline
Constraints: No macros
Output: .xlsx" \
  --pretty
```

The result is a routing plan that any host can consume:

```json
{
  "buckets": {
    "task": "Create a sales workbook",
    "context": "Q3 pipeline",
    "constraints": "No macros",
    "output": ".xlsx"
  },
  "verbs": ["create"],
  "agent": "data-agent",
  "skills": ["spreadsheets"],
  "matchedRoutes": [{"id": "spreadsheets", "score": 120}]
}
```

### Automatically select downloaded skills

Point the router at any local skill folders. No catalog is bundled with this repository:

```bash
node scripts/auto-route.mjs \
  --root /path/to/my/skills \
  --request "Turn these results into a PowerPoint deck" \
  --top 2 \
  --pretty
```

It reads local `name` and `description` frontmatter and returns only the best matches. People can keep downloading useful skills without memorizing invocation names, and private skill stacks stay private.

## Install as an agent skill

After publishing this folder in a public Git repository:

```bash
npx skills add owner/repository --skill skill-router
```

Install from a local checkout:

```bash
npx skills add ./skill-router
```

The standard [`SKILL.md`](SKILL.md) works without the reference CLI. The CLI is an optional, cross-platform implementation of the pre-LLM contract.

## Batch routing

Send strings or structured envelopes as JSONL:

```jsonl
{"id":"1","message":"Make a quarterly deck"}
{"id":"2","message":"Build it","buckets":{"task":"Build an Excel model","context":"Q3 forecast","constraints":"No macros","output":".xlsx"}}
```

```bash
node scripts/route.mjs --manifest examples/routes.json --input requests.jsonl
```

Output is also JSONL, so a harness can stream plans to workers without buffering the entire batch.

## Platform-agnostic by design

Skill Router does not import an agent SDK, call a provider API, assume a skill directory, or load arbitrary paths. A host supplies:

1. a trusted route manifest;
2. an optional allowlist of available skills;
3. one message or a JSONL stream.

The host receives JSON and decides how to resolve the selected agent and skills. See [`references/pipeline.md`](references/pipeline.md) for the contract, safety boundaries, and integration sequence.

### Host adapter status

| Host | Pre-model integration | v1.0 status |
| --- | --- | --- |
| Claude Code | `UserPromptSubmit` | Designed |
| Codex CLI / desktop | trusted plugin `UserPromptSubmit` | Designed |
| Hermes Agent | `pre_llm_call` | Designed |
| OpenClaw | typed pre-prompt plugin hook | Designed |
| Google Antigravity CLI | `PreInvocation` | Designed |
| OpenRouter | outbound request middleware | Designed |
| Grok / xAI API | outbound request middleware | Designed |
| Qwen / Alibaba Cloud Model Studio | outbound request middleware | Designed |
| DeepSeek API | outbound request middleware | Designed |
| GLM / Z.ai API | outbound request middleware | Designed |
| Kimi / Moonshot API | outbound request middleware | Designed |

`Designed` is deliberately not `shipped` or `verified`. The executable v1.0 release is the routing core. An adapter becomes verified only after contract tests and a real-host smoke test prove that it runs before the model call. See [`references/host-adapters.md`](references/host-adapters.md) for the activation contract, failure policy, and evidence requirements.

Consumer chat websites are outside this claim. Without a supported hook, extension, or application-controlled API request, the router cannot honestly promise pre-LLM interception.

### Your catalog stays private

The public repository contains no personal skill inventory. A host can privately index 5, 500, or 10,000 locally installed skills; the router emits only the selected identifiers. It never prints or serializes the full catalog.

## Accuracy boundary

Deterministic code can parse structured fields and match rules, but it cannot fully understand arbitrary language. The CLI labels each envelope as `structured`, `explicit-headings`, or `heuristic`.

For high-stakes or highly varied inputs, use structured callers, embeddings, or a dedicated routing classifier before the main LLM. Keep the same routing-plan contract so downstream integrations remain stable.

## Test

```bash
node --test scripts/route.test.mjs
node --test scripts/auto-route.test.mjs
```

The suite covers four-bucket intake, structured batches, explicit skill requests, allowlisting, fallback behavior, and invalid manifests.

## Roadmap

- verified adapters for Claude Code, Codex, Hermes, OpenClaw, and Antigravity;
- request middleware for OpenRouter, Grok/xAI, Qwen, DeepSeek, GLM, and Kimi;
- a benchmark corpus for routing accuracy;
- a visual manifest builder;
- route analytics and drift detection;
- signed, versioned route manifests.

Contributions should improve the open contract, add realistic routing fixtures, or provide small host adapters without coupling the core to one platform.

## Publish and discovery

A public repository containing `skill-router/SKILL.md` follows skills.sh discovery conventions. Add the `agent-skills` GitHub topic, publish tagged releases, and use the install command above in examples.

The strongest path to stars is evidence: publish reproducible routing fixtures and comparisons, not unverified performance claims. The strongest path to domain authority is a useful body of reference material about pre-LLM intake, skill routing, and auditable agent dispatch.

## License

MIT. See [`LICENSE`](LICENSE).

---

**Skill Router is built by [@luxurylifestyleco](https://github.com/luxurylifestyleco) at [VEDAXI](https://vedaxi.com).** If it saves you from memorizing your growing skill stack, star the repository and share what you routed with it.
