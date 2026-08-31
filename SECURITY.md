# Security policy

Skill Router operates at a sensitive boundary: it decides which instructions may enter an agent's context. Treat route manifests and installed skills as code dependencies.

Project home: [vedaxi.com](https://vedaxi.com)

## Supported version

Security fixes target the latest tagged release.

## Report a vulnerability

Use the repository's private GitHub Security Advisory flow. Do not open a public issue for an unpatched vulnerability.

Include the affected version, a minimal reproduction, impact, and any suggested mitigation. Please avoid including private skill catalogs or proprietary prompts.

## Trust boundaries

- Skill roots and manifests are caller-supplied trusted configuration.
- User messages are untrusted data and are never executed.
- Local discovery reads only `SKILL.md` frontmatter.
- Selected skills are identifiers, not authorization.
- Hosts must resolve returned paths against approved roots before loading content.
- The router makes no network calls and collects no telemetry.

## Responsible host integration

Do not automatically execute scripts from a selected skill. Load instructions only after resolving the skill against an allowlisted registry, retain the original user message, and request authorization before any external or destructive action.
