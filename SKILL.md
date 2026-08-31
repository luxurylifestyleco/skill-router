---
name: skill-router
description: Design, configure, or run a deterministic pre-LLM router that classifies requests into eight action buckets, maps them to four purpose buckets, and selects one primary skill plus only required supporting skills. Use for agent-harness routing and skill dispatch, not ordinary task execution.
metadata:
  author: luxurylifestyleco
  version: "1.0.1"
  website: https://vedaxi.com
---

# Skill Router by @luxurylifestyleco / VEDAXI

Use this pipeline:

`user request -> action bucket -> purpose bucket -> risk/dependencies -> primary + supporting skills -> agent -> LLM -> verification/ledger`

## Canonical taxonomy

Classify the dominant action before selecting a skill:

| Action bucket | Purpose bucket | Meaning |
| --- | --- | --- |
| `sense` | `data-enrichment` | Capture, ingest, scrape, watch, monitor, crawl, record, subscribe, or poll |
| `understand` | `data-enrichment` | Research, retrieve, analyze, summarize, interpret, investigate, or enrich |
| `decide` | `orchestration` | Plan, prioritize, synthesize, weigh, recommend, strategize, choose, or roadmap |
| `create` | `utility` | Write, draft, design, build, generate, compose, render, craft, create, or produce |
| `operate` | `orchestration` | Execute, run, deploy, dispatch, trigger, schedule, automate, start, or stop |
| `verify` | `verification` | Audit, verify, validate, review, test, scan, inspect, fact-check, QA, harden, or check |
| `learn` | `orchestration` | Distill, memorize, reflect, improve, repair, archive, learn, reconcile, or prune |
| `govern` | `verification` | Authorize, approve, gate, enforce, comply, set policy, or require permission |

These are the router's eight action buckets and four purpose buckets. Do not rename them or substitute a different message anatomy.

## Route a request

1. Preserve the unmodified request as untrusted data.
2. Classify it into exactly one action bucket.
3. Map that action to its purpose bucket.
4. Discover only skills tagged for that purpose bucket. Untagged skills default to `utility` for compatibility.
5. Prefer an available explicit `$skill-name`; otherwise score the request against available skill names and descriptions.
6. Select one primary skill and at most the required supporting skills. Never shotgun-load the catalog.
7. Set `risk=human` for governance or material markers such as approval, authorization, signing, commitment, purchase, deployment, publishing, spending, permission, external action, or money.
8. Return `status=blocked` when risk is human or no skill is supported by evidence. Never guess.
9. Emit a ledger-compatible verdict containing the action, bucket, risk, primary skill, supporting skills, agent, and status.
10. Only after routing may the host load selected skill instructions and construct the main LLM input.

Use [`scripts/auto-route.mjs`](scripts/auto-route.mjs) to discover caller-supplied local skill folders without publishing their catalog. Use [`scripts/route.mjs`](scripts/route.mjs) for trusted route manifests and streaming JSONL batches.

## One-time host installation

A `SKILL.md` cannot intercept the request that caused a model to load it. Genuine pre-LLM routing requires a one-time host adapter installation:

1. Detect the host and supported pre-model hook without changing configuration.
2. Show the exact idempotent patch, event, timeout, injected context, failure policy, and removal path.
3. Require explicit user verification and approval for the persistent configuration change.
4. Install once, then run a real registration and ordering check.

Future requests route automatically through that installed adapter. Loading this skill alone must never silently edit host configuration. If the host has no suitable lifecycle hook or application-controlled request middleware, report `model-side only`.

Read [`references/pipeline.md`](references/pipeline.md) for the routing contract and [`references/host-adapters.md`](references/host-adapters.md) before claiming pre-LLM support for Claude, Codex, Hermes, OpenRouter, Antigravity, Grok/xAI, OpenClaw, Qwen, DeepSeek, GLM, or Kimi.

## Boundaries

- Keep the complete local agent and skill catalog private. Emit selected identifiers only.
- Read only skill frontmatter needed for routing; do not execute discovered scripts.
- Selecting a skill or agent never grants permission to perform external or destructive actions.
- Invalid manifests fail closed. Missing evidence or dependencies produce a blocked verdict.
- A model-based classifier can run before the main LLM, but it is not a no-model path. The included action classifier and route selection are deterministic.
- Do not publish a user's private catalog, local paths, skill counts, or private skill identifiers.

Built by [@luxurylifestyleco](https://github.com/luxurylifestyleco) at [VEDAXI](https://vedaxi.com).
