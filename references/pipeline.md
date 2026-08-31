# Pre-LLM pipeline

## Mental model

The host, not the skill file, owns the execution order:

```text
message(s)
  -> action verbs + task/context/constraints/output envelope
  -> batch and normalization
  -> deterministic router
  -> routing plan
  -> agent/skill loader
  -> final model input
  -> main LLM
```

`SKILL.md` is context for an LLM. It becomes genuinely pre-LLM only when a host-side program reads routing metadata and selects context before making the main model call.

## Zero-config local discovery

When the goal is “install skills and stop remembering their names,” use the local discovery router:

```bash
node scripts/auto-route.mjs \
  --root /path/to/one/skills-folder \
  --root /path/to/another/skills-folder \
  --request "Turn these results into a PowerPoint deck" \
  --top 2 \
  --pretty
```

It recursively finds `SKILL.md` files under only the supplied roots, reads `name` and `description` frontmatter, and performs local lexical ranking with a small synonym map. It returns selected skills only. The full catalog is neither emitted nor sent to a service.

Explicit `$skill-name` requests receive highest precedence. Natural-language routing is convenient but approximate; the host should use a confidence threshold or require confirmation when a wrong skill would be costly.

## Routing-plan contract

Each invocation of `scripts/route.mjs` emits one JSON object per message:

The machine-readable contract is [`routing-plan.schema.json`](routing-plan.schema.json), published under the VEDAXI schema identifier `https://vedaxi.com/schemas/skill-router/routing-plan.v1.json`.

```json
{
  "version": 1,
  "id": "request-42",
  "message": "Create a formatted Word report as a .docx under ten pages",
  "buckets": {
    "task": "Create a formatted Word report",
    "context": "",
    "constraints": "under ten pages",
    "output": ".docx"
  },
  "verbs": ["create", "write"],
  "agent": "document-agent",
  "skills": ["documents"],
  "matchedRoutes": [{"id": "documents", "score": 114}],
  "explicitSkills": [],
  "unavailableSkills": [],
  "reason": "Matched route: documents"
}
```

The host should treat `agent` and `skills` as identifiers, resolve them against an allowlisted local registry, load only resolved resources, and append the original message last as untrusted user content.

## The four buckets

The envelope is deliberately small:

- `task`: what should happen.
- `context`: facts and inputs that affect the work.
- `constraints`: boundaries on how the work may happen.
- `output`: the expected artifact or response form.

Structured callers should send all four fields. Raw text is accepted for convenience and is split with conservative heuristics. The router always preserves `message`, because preprocessing must not silently discard meaning. If a wrong bucket would cause material harm, require structured input or use a dedicated classifier before the main LLM.

## Manifest

The manifest is trusted configuration:

- `version`: must be `1`.
- `settings.maxRoutes`: maximum matching routes combined for one request.
- `settings.minScore`: minimum rule score.
- `fallback.agent` and `fallback.skills`: used when no route matches.
- `routes[].id`: stable audit identifier.
- `routes[].agent`: agent selected when this is the highest-scoring route.
- `routes[].skills`: skills contributed by the route.
- `routes[].priority`: base score; use this to resolve overlap intentionally.
- `routes[].match.in`: which buckets to inspect; defaults to all four.
- `routes[].match.verbs`: canonical task verbs that increase confidence after a domain matcher hits.
- `routes[].match.any`: literal phrases; at least one positive matcher must hit.
- `routes[].match.all`: literal phrases that must all occur.
- `routes[].match.none`: literal phrases that disqualify the route.
- `routes[].match.patterns`: JavaScript regular expressions, without delimiters.
- `routes[].match.extensions`: file extensions such as `.docx`.

Literal matching is case-insensitive and whitespace-normalized. Patterns are also case-insensitive. Invalid regular expressions reject the manifest before any request is routed.

## Commands

Route one request:

```bash
node scripts/route.mjs --manifest examples/routes.json --request "Create a Word report"
```

Route a JSONL batch from a file:

```bash
node scripts/route.mjs --manifest examples/routes.json --input requests.jsonl
```

Route JSONL from standard input:

```bash
node scripts/route.mjs --manifest examples/routes.json --input -
```

Limit resolution to installed skills:

```bash
node scripts/route.mjs --manifest examples/routes.json --request "Use $documents" --available documents,spreadsheets
```

Each JSONL line can be a string, an object with `message` and optional `id`, or a structured object with `message`, `id`, and `buckets`. Output is JSONL so a harness can stream plans into workers without collecting the entire batch in memory.

## Loading the final model input

After receiving a plan, the host should:

1. Resolve `agent` through an allowlisted agent registry.
2. Resolve every skill through an allowlisted skill registry.
3. Read the selected agent instructions and skill files.
4. Construct the system/developer context.
5. Add the unchanged request as user content.
6. Call the main LLM.

Do not concatenate paths supplied by the request, execute a selected skill's scripts automatically, or treat routing as authorization.

## Private catalog boundary

The public package must not contain a user's complete agent or skill inventory. The host may pass available skill names as an in-memory allowlist, but the plan returns only selected identifiers. Do not log, serialize, or publish the full allowlist. Route manifests intended for public examples should use generic skills and agents.

## Semantic upgrades

Rules are appropriate when routes are known and explainability matters. If requests are too varied for literals:

- Use local embeddings against skill descriptions, then threshold the score.
- Use a small dedicated classifier and require structured output.
- Keep explicit `$skill-name` selection as the highest-precedence signal.
- Preserve the routing-plan schema so downstream agent loading does not change.

Any classifier call is still a model call. It may be *before the main LLM*, but it is not “before any model.”
