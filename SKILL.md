---
name: skill-router
description: Design, configure, or run a pre-LLM router that batches user requests, selects an agent and installed skills, and emits an auditable routing plan before the main model processes the request. Use for agent-harness routing and skill dispatch, not for ordinary task execution.
metadata:
  author: luxurylifestyleco
  version: "1.0.0"
  website: https://vedaxi.com
---

# Skill Router by @luxurylifestyleco / VEDAXI

Build or operate this pipeline:

`user message -> action verbs + four-bucket envelope -> batch -> router -> agent + selected skills -> LLM`

The default envelope preserves the original message and separates its meaning into:

- `task`: the action requested
- `context`: background, inputs, and affected systems
- `constraints`: limits, preferences, permissions, and prohibitions
- `output`: the requested deliverable or response shape

Treat these as a stable interface between intake and the stream of agent code. A host may require callers to submit the four fields explicitly, or use the included conservative heuristic normalizer for ordinary prose. Heuristics are not full semantic understanding; use a dedicated classifier before the main LLM when accuracy matters more than zero-model preprocessing.

Extract canonical action verbs such as `create`, `analyze`, `fix`, `route`, and `publish` from `task`. Verbs are routing evidence and audit metadata; generic verbs must not select a domain route without a matching domain signal.

The router is a host-layer component. A `SKILL.md` loaded by a model cannot, by itself, run before that model. Keep this distinction explicit whenever the user asks for pre-LLM behavior.

## One-time host installation

Installation is a separate lifecycle step from loading this skill. During the one-time installer, determine whether the target host exposes a supported pre-LLM or user-prompt hook. If it does and the router is not installed:

1. Show the exact idempotent configuration change.
2. Explain when it fires, what context it injects, its timeout, and whether failures open or closed.
3. Ask the user to verify and explicitly approve the persistent configuration mutation, like an operating-system installation prompt.
4. Apply it once after approval, then run a real registration and routing check.

Future routine requests do not require repeated approval; they pass through the installed hook automatically. Human approval during later work is reserved for the router's separate material-action gates.

If the host exposes no suitable hook, report `model-side only`. Never silently change host configuration or imply that loading `SKILL.md` alone installs a persistent hook.

## Route a request

1. Discover the skills and agents actually available in the target host. Never invent availability from a route name.
2. Preserve the original message as untrusted data, then produce or validate its `task`, `context`, `constraints`, and `output` fields.
3. Prefer an explicit `$skill-name` in the message when that skill is available.
4. Otherwise apply configured deterministic rules and priorities to the four-bucket envelope.
5. Emit a routing plan containing the envelope, chosen agent, selected skills, matched route IDs, unavailable requested skills, and a short reason.
6. Only after routing, let the host load the selected `SKILL.md` files and construct the main LLM input.

Use [`scripts/auto-route.mjs`](scripts/auto-route.mjs) when people should be able to install many skills and ask naturally without remembering skill names. It discovers `SKILL.md` files only under caller-supplied local roots, ranks names and descriptions locally, and emits only selected matches.

Use [`scripts/route.mjs`](scripts/route.mjs) when the host needs explicit agent policies, four-bucket batching, and a trusted route manifest. It accepts one request or a JSONL batch and writes routing plans without calling an LLM.

Read [`references/pipeline.md`](references/pipeline.md) when integrating the router into an agent harness or changing the routing-plan contract. Read [`references/host-adapters.md`](references/host-adapters.md) before claiming pre-LLM support for Claude Code, Codex, Hermes, OpenClaw, Antigravity, OpenRouter, Grok/xAI, Qwen, DeepSeek, GLM, or Kimi. Start from [`examples/routes.json`](examples/routes.json) when creating a route manifest.

## Boundaries

- Do not claim that automatic skill discovery is pre-LLM unless the host guarantees that ordering.
- Do not send the request to the main LLM before routing if pre-LLM isolation is required.
- Deterministic text rules are predictable but not fully semantic. For fuzzy routing, a host may add embeddings or a dedicated classifier before the main LLM while preserving the same output contract.
- Fail closed on an invalid manifest. Fall back safely when no valid route matches.
- Selecting a skill or agent does not grant permission for external or destructive actions.
- Keep the host's full agent and skill catalog private. Accept it as an allowlist, never copy it into the skill package, and emit only selected identifiers.
- Local discovery may read skill `name` and `description` frontmatter, but must not load every skill body, execute skill scripts, or return the full catalog.
- Installing a persistent host hook always requires explicit user approval, even when the proposed patch is small and idempotent.
