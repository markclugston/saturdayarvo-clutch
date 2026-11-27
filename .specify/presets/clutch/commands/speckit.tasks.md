---
description: "Generate an actionable, dependency-ordered tasks.md for the feature based on available design artifacts."
strategy: wrap
---

## Clutch Rules

These take precedence over any conflicting instruction below.

- Tests are REQUIRED, not optional: ENG-001 requires test tasks for every behaviour change.
- Cite, do not restate: every FR, and every success criterion needing buildable work, is cited by ID in at least one task. Never quote or copy a constraint into a task, even where the instructions below say to; cite the entity or FR ID.
- After writing `tasks.md`, run `.\scripts\check-spec-artifacts.ps1` and fix its ERROR lines before reporting completion. If errors remain after two runs, report them.

{CORE_TEMPLATE}
