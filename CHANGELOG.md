# Changelog

All notable changes are documented here. Skill Router follows semantic versioning.

## 1.0.1 — 2026-08-31

### Corrected

- Restored the canonical eight action buckets: `sense`, `understand`, `decide`, `create`, `operate`, `verify`, `learn`, and `govern`.
- Restored their four purpose buckets: `data-enrichment`, `orchestration`, `utility`, and `verification`.
- Removed the incorrectly introduced `task`, `context`, `constraints`, and `output` intake taxonomy.
- Added purpose-bucket filtering before skill scoring and preserved one primary skill plus required supporting skills.
- Added blocked verdicts for Human Gates and missing routing evidence or dependencies.
- Added regression coverage for every action mapping and for `enrich` / `enrichment` routing to `understand`.

## 1.0.0 — 2026-08-31

First stable public release by [@luxurylifestyleco](https://github.com/luxurylifestyleco) at [VEDAXI](https://vedaxi.com).

### Added

- Private local discovery of installed `SKILL.md` files.
- Natural-language lexical ranking with explicit `$skill-name` precedence.
- Canonical action classification and purpose-bucket mapping.
- Trusted manifest routing for agents and skills.
- Streaming JSONL batch input and output.
- Skill availability filtering and safe fallback behavior.
- Provider-neutral routing-plan contract.
- Tests for discovery, privacy, batching, invalid manifests, and fallback behavior.
- Approval-first host bootstrap contract for persistent pre-LLM adapters.
- Regression coverage mapping `enrich` and `enrichment` to the analysis family.

### Security and privacy

- The complete local skill catalog is never emitted.
- Discovery reads only `name` and `description` frontmatter.
- Routing does not execute skill scripts or grant permissions.
- No network calls, telemetry, or runtime package dependencies.
