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

## Constitution 1.8.0 (2026-11-28): token cost before implement

- Rationale: in local Claude Code logs (2026-11-20 to 2026-11-27), analyze was 53% of the token cost of specify through tasks plus analyze, at about 5 runs per feature. See `docs/spec-kit-token-review.md`.
- Analyze reports only CRITICAL and HIGH, applies one approved batch of fixes and re-checks only those, at most twice. An open reporting bar meant each run found something new.
- Clarify asks only what changes stored data, visible behaviour or security, marks options that add a mechanism, and says when no material questions remain. It may still be repeated, because a missed scenario is cheaper to find there than in implement.
- Specify records an optional "Out of scope:" statement (not required), and the code map gives simple defaults for silent areas, so scope does not grow unasked.
- One fact has one owning document, and tasks cite IDs instead of copying constraints. Repeated facts drifted and became findings. Plan researches only real unknowns.
- Added `scripts/check-spec-artifacts.ps1` for the mechanical checks, run by tasks and analyze.
- Command rules live in the `presets/clutch/` preset, not in edited `speckit-*` skills, so Spec Kit can be upgraded. Upgrades were tested only on 1.3.2.
- `.gitattributes` keeps Spec Kit files on LF, because line-ending conversion changes their recorded hashes.
- `scripts/sync-agent-config.ps1` creates the `.github/` `speckit-*` copies from the `.claude/` ones. A second Spec Kit integration for Copilot was refused without `--force`.
- WEB-001: plans name the UI compliance checklist instead of copying it; the completion review still records every item. MINOR bump.
- SEC-004 added to the templates, `clutch-constitution-check`, the security and frontend skills and the security rule, where it was missing.
- Supersedes earlier notes that the project is Copilot-only: Claude Code is also in use, with `CLAUDE.md` mirrored to `copilot-instructions.md`.
- Not yet proven on a feature.

## Constitution 1.9.0 (2026-11-28): list standard

- Rationale: lists differed from one another. The user asked for every list to follow the Assets list, deviating only with explicit approval. MINOR bump.
- The rules are in `clutch-ui-style` §12, which points to the Assets code for values. No shared list primitive exists yet, so review and tests enforce them, not lint.
- Interpretation: a list is any collection of records shown as rows or items. Navigation, tab strips, drop-down options, chart legends and toasts are not lists.
- Interpretation: approval is the user's own words naming the difference, including a feature description that asks for it.
- Existing lists that differ are listed in §12. They are neither approved nor changed.
- The `presets/clutch/` commands are unchanged: specify and clarify already read the code map's settled decisions, and plan loads the constitution check.
