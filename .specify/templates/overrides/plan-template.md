# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]

<!--
  Clutch override. Be concise: bullets over prose, no restating the spec.
  The code is the source of truth. Use docs/code-map.md to find the files that answer a
  question, and record only what this feature changes or adds.
  research.md: only when NEEDS CLARIFICATION items exist; one short entry per decision.
  contracts/: schema only. quickstart.md: runnable validation commands only.
-->

## Summary

[2–4 sentences: primary requirement and technical approach]

## Technical Context

**Baseline**: The existing stack and settled decisions in the code (see `docs/code-map.md`).
Do not restate them.

**Feature-specific changes**: [New packages, schema changes, new endpoints, new UI areas, or "None beyond baseline"]

**Performance Goals**: [Feature-specific targets beyond the constitution's 500 ms feedback rule, or "Constitution defaults"]

**Constraints**: [Feature-specific constraints only]

**Scale/Scope**: [Brief]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*
*Procedure: `clutch-constitution-check` skill. One row per ID; use N/A with a reason when an ID does not apply.*

| ID | Applies | How the plan complies | Gate / evidence | Status |
|----|---------|-----------------------|-----------------|--------|
| ARC-001 | Yes | | Review | |
| DOT-001 | | | Build, tests | |
| DOT-002 | | | Independent query review, provider-backed integration tests | |
| AUD-001 | | | Audit append-only check | |
| ENG-001 | Yes | | Test tasks, quality gates | |
| OPS-001 | | | Logging, health checks, migration review | |
| SEC-001 | | | Independent security review | |
| SEC-002 | | | Security review | |
| SEC-003 | | | Security review | |
| WEB-001 | | | Frontend gates, UI compliance checklist | |
| Perf & Observability | | | 500 ms feedback, OpenTelemetry metrics | |

[If WEB-001 applies: list the applicable style guide sections (§) and paste the UI compliance checklist from `clutch-ui-style/references/compliance-checklist.md`.]

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md
├── research.md          # only if there were open unknowns
├── data-model.md        # only if entities or schema change
├── quickstart.md
├── contracts/           # only if API or UI contracts change
└── tasks.md             # /speckit-tasks output
```

### Source Code (files this feature touches)

<!-- List only new or changed paths, grouped by layer, placed beside their nearest existing siblings. -->

```text
[new or changed paths]
```

**Structure Decision**: Existing layout, following sibling files. [Note any deviation]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
