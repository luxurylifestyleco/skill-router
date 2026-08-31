# Changelog

All notable changes are documented here. Skill Router follows semantic versioning.

## 1.0.0 — 2026-08-31

First stable public release by [@luxurylifestyleco](https://github.com/luxurylifestyleco) at [VEDAXI](https://vedaxi.com).

### Added

- Private local discovery of installed `SKILL.md` files.
- Natural-language lexical ranking with explicit `$skill-name` precedence.
- Four-bucket message anatomy: task, context, constraints, and output.
- Canonical action-verb extraction.
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
