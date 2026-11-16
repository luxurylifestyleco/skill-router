---
name: dream
description: Use when the DREAM maintenance cron is running. Classify what changed. Apply nothing without an existing approval record.
bucket: orchestration
---

# DREAM

Scheduled maintenance. Not a user command and not a new runtime.

1. Read the change set the host already produced.
2. Classify each item. Inference is not a fact.
3. Apply nothing to memory, rules, or source of truth unless an approval record already names that proposal.
4. Do not create a second scheduler, graph, or memory.
