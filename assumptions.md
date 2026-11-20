# Refactor Assumptions

Traceability preserved through relocation of implementation requirements into path-scoped instructions. Constitutional governance and enforcement remain in Tier 1.
## Constitution 1.1.0 (2026-11-20): skill extraction

- Rationale: reduce context loaded on every Spec Kit step.
- Requirement IDs and their binding statements stay in the constitution, so /speckit-analyze and /speckit-converge still detect violations.
- Implementation detail and review procedures moved to `.github/skills/clutch-*`. The applicability index, Continuous Governance, UI Governance and Delivery Gates procedure moved to `clutch-constitution-check`.
- `docs/style-guide.md` became an index; its sections live in `.github/skills/clutch-ui-style/references/` with the same § numbers.
- Path-scoped instructions gained `applyTo` patterns and now point to the skills instead of duplicating rules.
- `.github/instructions.md` merged into `copilot-instructions.md`.
- Spec Kit skills (`.github/skills/speckit-*`) are unchanged.
- Versioning: no version was recorded before; 1.1.0 is the first recorded version (MINOR: content relocated, no rule removed).

## Constitution 1.2.0 (2026-11-20): rework-loop and test-cost reduction

- ENG-001: every feature explicitly requests tests, so `/speckit-tasks` (which treats tests as optional unless requested) always generates test tasks. Without this, `/speckit-converge` flagged missing tests as CRITICAL and forced another implement and converge cycle.
- Workflow: tasks.md must include a task for every gate the Constitution Check requires, for the same reason.
- MINOR bump: requirements added, none removed.
- Skills: test cadence (affected tests per task, full suites per phase and at completion), quiet build and test output, and reviews once per feature over the full diff.
- `copilot-instructions.md`: concise plan artifacts; failures-only output.

## Template overrides and project context (2026-11-20)

- Added `.specify/templates/overrides/` (plan, spec, tasks). Spec-kit resolves these before the core templates, so they survive upgrades. The core templates are unchanged.
- Overrides remove generic samples, state that tests are required, pre-seed the Constitution Check table and completion-gate tasks, and limit task lines to about 200 characters. Observed baseline: feature 012's tasks.md was 38 KB with 40 tasks averaging 640 characters.
- Added `docs/project-context.md` (layout, standing decisions, commands), taken from `original src`, so plan and implement don't explore the codebase.
- Skills use the real commands. SqlServer-trait (Testcontainers) tests are excluded from per-task runs.

## Code is the single source of truth (2026-11-20)

- Replaced `docs/project-context.md` (copied facts) with `docs/code-map.md`, which holds only pointers to the files that answer each question, plus a "follow the nearest sibling" rule. Nothing in it changes when code behaviour changes. A broken pointer is visible and is fixed when found.
- Removed copied code facts (project names, test trait values, npm script names, stack versions, sample paths) from the template overrides and the dotnet/frontend skills. They now tell the agent where to read the value.
- Behaviour already implemented in code is treated as settled, so it is not raised as NEEDS CLARIFICATION.
- Known remaining path references: `applyTo` globs in `.github/instructions/` (these must be paths; if a folder moves, the instruction stops auto-applying but the skills still load by description), and `clutch-ui-style` design content (the style guide's own rules, with `index.css` declared as the source of truth for values).

## AGENTS.md removed (2026-11-20)

- Its one rule (load UI guidance only for UI work) is covered by the `clutch-ui-style` skill description, `ui-design.instructions.md` (applyTo), and WEB-001. The project is Copilot-only, so `copilot-instructions.md` is the single always-loaded file. Delete `AGENTS.md` from the repository when these changes are copied back.

## docs/style-guide.md removed (2026-11-20)

- After the split it was only an index that duplicated the section table in `clutch-ui-style/SKILL.md`. The style guide now lives only in `.github/skills/clutch-ui-style/` (SKILL.md and `references/`, with the original § numbers). Delete `docs/style-guide.md` from the repository when these changes are copied back.
