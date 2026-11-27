---
description: "Execute the implementation planning workflow using the plan template to generate design artifacts."
strategy: wrap
---

## Clutch Rules

These take precedence over any conflicting instruction below.

- Phase 0 replaces the version below: take only the NEEDS CLARIFICATION items in Technical Context. If there are none, skip the phase and write no `research.md`. Otherwise resolve each from the code (`docs/code-map.md`) and record it in a few lines. Do not research dependencies or technology choices, and do not dispatch research agents.
- Phase 1 needs no `research.md`, only that no NEEDS CLARIFICATION remains.
- State each fact in one file only: behaviour and rules stay in `spec.md`, fields and constraints go in `data-model.md`, API and UI shapes in `contracts/`, decisions in `research.md`. Elsewhere cite the ID or file.

{CORE_TEMPLATE}
