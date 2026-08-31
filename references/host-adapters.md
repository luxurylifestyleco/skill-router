# Host adapter support

Skill Router has one routing core and multiple host adapters. Platform agnostic does not mean pretending every host has the same extension API. It means every adapter translates a host lifecycle event into the same routing-plan contract.

## Support labels

Use these labels literally in documentation and releases:

- `verified`: the adapter has an automated contract test and a real-host smoke test for the listed host version.
- `implemented`: adapter code and contract tests ship, but the current release has no real-host smoke-test evidence.
- `designed`: the official host lifecycle is documented and mapped, but adapter code does not ship yet.
- `model-side only`: the host has no supported interception point before its model receives the prompt.

Never call a host `supported` without one of these labels and a dated compatibility record.

## Primary market

| Host | Correct interception surface | Adapter class | Current release |
| --- | --- | --- | --- |
| Claude Code | `UserPromptSubmit` hook | Native prompt hook | Designed |
| Codex CLI / desktop | `UserPromptSubmit` in a trusted plugin hook | Native prompt hook | Designed |
| Hermes Agent | `pre_llm_call` hook | Native prompt hook | Designed |
| OpenClaw | Typed plugin hook such as `before_prompt_build` | Native plugin hook | Designed |
| Google Antigravity CLI | `PreInvocation` hook; obtain the user turn from the host-provided transcript | Native invocation hook | Designed |
| OpenRouter | Wrap the outbound API call before `/chat/completions`, `/messages`, or `/responses` | Request middleware | Designed |
| Grok / xAI API | Wrap the outbound API call before `/v1/chat/completions` or the applicable xAI endpoint | Request middleware | Designed |
| Qwen / Alibaba Cloud Model Studio | Wrap the outbound OpenAI-compatible, Anthropic-compatible, or DashScope request | Request middleware | Designed |
| DeepSeek API | Wrap the outbound OpenAI-compatible or Anthropic-compatible request | Request middleware | Designed |
| GLM / Z.ai API | Wrap the outbound request before `/api/paas/v4/chat/completions` | Request middleware | Designed |
| Kimi / Moonshot API | Wrap the outbound request before `/v1/chat/completions` | Request middleware | Designed |

The table refers to developer and agent runtimes. It does not claim interception inside consumer web chat products such as claude.ai or grok.com.

## One-time activation contract

Every persistent adapter installer must perform the same transaction:

1. Detect the host and its version without changing configuration.
2. Resolve the exact user-level or project-level hook target.
3. Show the complete proposed patch, executable path, event, timeout, failure mode, and removal command.
4. Require one explicit approval for the persistent change.
5. Apply the patch idempotently and preserve unrelated configuration.
6. Ask the host to review or trust the hook when the host has its own trust store.
7. Run a canary request and prove that the routing verdict was injected before the model call.
8. Record the adapter version and verification result without recording private prompts or the local skill catalog.

Installation approval is not a per-request approval. Once installed, routine turns route automatically. Material actions remain subject to separate human gates.

## Shared adapter input

An adapter should reduce its host event to this internal shape:

```json
{
  "event": "user_prompt",
  "message": "the unmodified user request",
  "cwd": "/optional/current/workspace",
  "availableSkills": ["private", "host-supplied", "allowlist"],
  "host": {"name": "codex", "version": "host version"}
}
```

The router returns the public routing-plan contract. The adapter converts only the selected result into host-native context. It must not inject the full local catalog.

Suggested compact context:

```text
SKILL_ROUTER v1: verbs=<...>; task=<...>; constraints=<...>; agent=<...>; skills=<selected-only>; risk=<...>; route=<...>
```

The original message remains in its normal host position. The verdict is supplemental context, not a replacement prompt.

## Failure policy

- Empty, invalid, or unrelated lifecycle events emit nothing.
- An invalid route manifest fails closed: do not select a skill or agent.
- A router timeout should fail open for ordinary chat unless the installer explicitly selects a stricter policy.
- Security, publication, spending, credential, and external-commitment gates may fail closed.
- A hook must never turn routing into permission to execute the selected skill.

## Host notes

### Claude Code

Use `UserPromptSubmit`, which runs before Claude processes the submitted prompt and supports adding context. The installer modifies the selected Claude settings layer only after showing the exact hook definition.

### Codex

Bundle the hook in a Codex plugin and use `UserPromptSubmit`. Codex requires non-managed hooks to be reviewed and trusted; trust is tied to the current hook hash. Installation must not bypass that review.

### Hermes Agent

Use `pre_llm_call` and return a context injection. Ignore non-matching events and empty messages. Treat changes to `config.yaml` as the one-time approved installation mutation.

### OpenClaw

Use the typed plugin lifecycle rather than asking a skill to activate itself. Prefer the earliest supported prompt-building hook that can add context without rewriting the user's original message.

### Antigravity

`PreInvocation` runs before the model and can inject an ephemeral message. Its event payload identifies the transcript rather than directly carrying the prompt, so the adapter must conservatively resolve the current user turn from that host-provided transcript. If it cannot identify one unambiguously, emit nothing.

### OpenRouter, Grok, Qwen, DeepSeek, GLM, and Kimi

These are provider/API paths, not local skill hosts. Route before constructing the provider request, then add the selected-only verdict to the application's system or developer context. Do not market an SDK wrapper as a native host hook.

Qwen Code, Kimi Code, and any future vendor agent harnesses are separate host surfaces. They do not become native-hook integrations merely because their underlying model API is supported. Each needs its own lifecycle mapping and real-host verification.

## Evidence required for `verified`

For each adapter, keep a public fixture containing:

- host and adapter versions;
- sanitized input event;
- routing-plan output;
- sanitized model-bound request or injected context proving order;
- empty-event and malformed-event behavior;
- install, repeat-install, and uninstall results;
- elapsed router time;
- no-catalog-leak assertion.

This evidence, not platform-name repetition, is the compatibility claim.

## Primary references

- [Claude Code hooks](https://code.claude.com/docs/en/hooks)
- [Codex hooks](https://developers.openai.com/codex/hooks)
- [Codex plugins](https://developers.openai.com/codex/plugins)
- [Google Antigravity hooks](https://antigravity.google/docs/hooks/)
- [OpenClaw automation hooks](https://github.com/openclaw/openclaw/blob/main/docs/automation/hooks.md)
- [OpenClaw typed plugin hooks](https://github.com/openclaw/openclaw/blob/main/docs/plugins/hooks.md)
- [OpenRouter API quickstart](https://openrouter.ai/docs/quickstart)
- [xAI API documentation](https://docs.x.ai/)
- [Qwen API reference](https://www.alibabacloud.com/help/en/model-studio/qwen-api-reference)
- [DeepSeek API documentation](https://api-docs.deepseek.com/)
- [GLM / Z.ai quickstart](https://docs.z.ai/guides/overview/quick-start)
- [Kimi API overview](https://platform.kimi.ai/docs/api/overview)
