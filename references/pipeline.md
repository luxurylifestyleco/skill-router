# Pre-LLM pipeline

## Execution order

The host owns the ordering:

```text
user request
  -> classify one of 8 action buckets
  -> map to one of 4 purpose buckets
  -> resolve risk and dependencies
  -> select one primary skill + required supporting skills
  -> select agent
  -> construct model context
  -> main LLM
  -> verification and ledger
```

`SKILL.md` is model context, not a pre-model hook. The pipeline runs before the main LLM only when a host adapter or application-controlled request middleware invokes the router first.

## Canonical taxonomy

| Action bucket | Purpose bucket |
| --- | --- |
| `sense` | `data-enrichment` |
| `understand` | `data-enrichment` |
| `decide` | `orchestration` |
| `create` | `utility` |
| `operate` | `orchestration` |
| `verify` | `verification` |
| `learn` | `orchestration` |
| `govern` | `verification` |

Classification uses the dominant action verb, not the request subject. The purpose bucket limits the candidate set before route scoring.

## Routing-plan contract

Each invocation emits one JSON object per request. The machine-readable contract is [`routing-plan.schema.json`](routing-plan.schema.json).

```json
{
  "version": 1,
  "id": "request-42",
  "message": "Create a formatted Word report as a .docx",
  "action_verb": "create",
  "action_bucket": "utility",
  "risk": "routine",
  "status": "routed",
  "agent": "document-agent",
  "skills": ["documents"],
  "primary": "documents",
  "supporting": [],
  "matchedRoutes": [{"id": "documents", "score": 114}],
  "explicitSkills": [],
  "unavailableSkills": [],
  "reason": "Matched route: documents"
}
```

The host resolves `agent` and `skills` against allowlisted local registries. A verdict with `risk=human` or `status=blocked` must not auto-execute.

## Manifest

The manifest is trusted configuration:

- `version`: must be `1`.
- `settings.maxRoutes`: maximum matching routes combined for one request.
- `settings.minScore`: minimum route score.
- `fallback.agent` and `fallback.skills`: safe fallback identifiers.
- `routes[].id`: stable audit identifier.
- `routes[].bucket`: one of `data-enrichment`, `orchestration`, `utility`, or `verification`.
- `routes[].agent`: selected agent when the route wins.
- `routes[].skills`: skills contributed by the route.
- `routes[].priority`: base score for intentional overlap resolution.
- `routes[].match.verbs`: any of the eight action buckets.
- `routes[].match.any`: literal phrases; at least one positive matcher must hit.
- `routes[].match.all`: literal phrases that must all occur.
- `routes[].match.none`: literal phrases that disqualify the route.
- `routes[].match.patterns`: JavaScript regular expressions without delimiters.
- `routes[].match.extensions`: file extensions such as `.docx`.

Invalid manifests fail closed before routing.

## Commands

```bash
node scripts/route.mjs --manifest examples/routes.json --request "Create a Word report"
node scripts/route.mjs --manifest examples/routes.json --input requests.jsonl
node scripts/route.mjs --manifest examples/routes.json --input -
node scripts/route.mjs --manifest examples/routes.json --request "Use $documents" --available documents,spreadsheets
```

Each JSONL line is a string or an object with `message` and optional `id`. Output is JSONL for streaming into workers.

## Local discovery

```bash
node scripts/auto-route.mjs \
  --root /path/to/skills \
  --request "Create a PowerPoint deck" \
  --top 2 \
  --pretty
```

The discovery router reads `name`, `description`, and `bucket` frontmatter only. Explicit `$skill-name` requests receive precedence when available. Untagged skills default to `utility`. The full catalog is never emitted.

## Final model input

After a routable verdict, the host should:

1. Resolve the selected agent and skills through allowlisted registries.
2. Load only the primary and required supporting instructions.
3. Inject a compact routing verdict as trusted context.
4. Add the unchanged request as untrusted user content.
5. Call the main LLM.
6. Record the outcome in its ledger and run required verification.

Do not concatenate request-supplied paths, execute discovered scripts automatically, or treat routing as authorization.

## Failure and risk policy

- Governance or material markers produce `risk=human`.
- Missing evidence, missing dependencies, or no supported skill produce `status=blocked`.
- Invalid configuration fails closed.
- Empty or unrelated lifecycle events emit nothing at the adapter boundary.
- Routing never grants permission for external or destructive actions.

## Privacy boundary

The public package must not contain a user's catalog, private skill identifiers, local paths, or catalog counts. Hosts may keep an in-memory allowlist, but logs and routing plans contain selected identifiers only.

Built by [@luxurylifestyleco](https://github.com/luxurylifestyleco) at [VEDAXI](https://vedaxi.com).
