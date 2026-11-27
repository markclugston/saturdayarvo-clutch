---

description: "Clutch task list template"
---

# Tasks: [FEATURE NAME]

**Input**: `specs/[###-feature-name]/` (plan.md, spec.md, and data-model.md / contracts/ when present)

**Tests**: REQUIRED. ENG-001 makes every behaviour change an explicit request for tests. Write
tests first and confirm they fail before implementing.

## Format: `- [ ] T### [P?] [US#?] Description with exact file path`

- **[P]**: parallel-safe (different files, no dependency). **[US#]**: user story label.
- One line per task, at most about 200 characters. State the file and the outcome. Do not
  restate spec or plan text; reference it (e.g. `per data-model.md ImportReview`, `FR-004`).
- Paths and patterns follow the nearest existing sibling file (`docs/code-map.md`).
- Cite every FR, and every success criterion needing buildable work, by ID in at least one task.
- Each gate task cites every PENDING Constitution Check ID it closes.

<!--
  Replace every sample below with real tasks. Omit Setup or Foundational phases when the
  feature needs none. Do not keep sample tasks.
-->

## Phase 1: Setup

- [ ] T001 [Only if needed: new package, config or Playwright config]

## Phase 2: Foundational (blocks all stories)

- [ ] T002 [Shared domain type, migration or API client schema needed by every story]

**Checkpoint**: build + fast tests pass.

---

## Phase 3: User Story 1 - [Title] (Priority: P1) 🎯 MVP

**Goal**: [One sentence] | **Independent Test**: [One sentence]

- [ ] T003 [P] [US1] Unit tests in `<unit test path>`
- [ ] T004 [P] [US1] Integration test (Docker SQL Server fixture) in `<integration test path>`
- [ ] T005 [P] [US1] Component tests in `<component test path>`
- [ ] T006 [US1] Domain/application change in `<path>`
- [ ] T007 [US1] Endpoint in `<path>`
- [ ] T008 [US1] UI in `<path>`

**Checkpoint**: story's tests pass; phase gates per test cadence.

---

[Repeat the user story phase for each story in priority order]

---

## Phase N: Completion Gates

Include each applicable row from the plan's Constitution Check. Delete rows that are N/A there.

- [ ] TXXX Browser test for critical journey in `<e2e spec path>` (WEB-001)
- [ ] TXXX Independent query review of changed queries (DOT-002, `clutch-data-access`)
- [ ] TXXX Migration review with rollback/backfill plan (OPS-001, `clutch-data-access`)
- [ ] TXXX Independent security review of the full diff (SEC-001..004, `clutch-security-review`)
- [ ] TXXX Validate every UI compliance checklist item in both themes; record each result in `validation.md` (WEB-001, `clutch-ui-style`)
- [ ] TXXX Run completion quality gates and record results (ENG-001, DOT-001, test cadence in `clutch-dotnet-service` / `clutch-frontend`)

---

## Dependencies & Execution Order

- Setup → Foundational → user stories in priority order → Completion Gates.
- [List only cross-story or non-obvious task dependencies, e.g. `T012 needs T005`.]

## Parallel Opportunities

- [One line per story, e.g. `US1: T003, T004, T005`]

## Implementation Strategy

MVP = User Story 1. Deliver stories incrementally; each must pass its own tests before the next starts.
