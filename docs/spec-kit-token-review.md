# Spec Kit Token Review

28 November 2026. Scope: specify, clarify, plan, tasks and analyze (everything before implement).

## Verdict

The cost comes from **repeated runs over large, duplicated artifacts, on top of a large fixed context**. It does not come from your constitution. Your split into skills and path rules works: `CLAUDE.md` is 920 bytes and the constitution 6.5 KB.

Capping analyze should cut roughly **a third of pre-implement tokens** (about 11% of all tokens). This is an estimate that assumes each remaining run costs what a run costs today.

## Status

Applied on 28 November, not yet tried on a feature: improvements 1, 2, 4 and 6, and improvement 3 in a revised form. Improvement 5 is a decision for each feature. Improvements 7 and 8 are yours to try. The findings below describe the setup **before** these changes.

Revised after discussion: clarify may be run again, because finding a missed scenario there is cheaper than finding it during implement. It now asks only material questions and says "No material questions remain" when further runs are not needed.

### Upgrading Spec Kit

No core Spec Kit file is edited by hand. The rules for `specify`, `clarify`, `plan`, `tasks` and `analyze` are a local preset in `presets/clutch/`, which wraps the core commands. Its [README](../presets/clutch/README.md) gives the steps after an upgrade or a preset change. Tested with Spec Kit 1.3.2 only.

## Measured Use

From the local Claude Code logs for this project, 20 to 27 November. Copilot use is not included. Figures are input-token equivalents (input ×1, cache write ×1.25 or ×2, cache read ×0.1, output ×5). They show relative cost, ignore price differences between models, and are not your plan's limit accounting. Runs are grouped by the last Spec Kit command, so follow-up chat counts toward that command.

| Command | Runs | Share of all | Share of pre-implement |
|---|---|---|---|
| analyze (including your removed fix-all skill) | 76 analyze, 20 fix-all | 18.6% | **53%** |
| clarify | 36 | 5.4% | 16% |
| plan | 16 | 5.0% | 14% |
| specify | 17 | 3.2% | 9% |
| tasks | 16 | 2.5% | 7% |
| **Pre-implement total** | | **34.8%** | 100% |
| implement | 24 | 31.2% | |
| no Spec Kit command | | 20.5% | |
| converge | 26 | 12.4% | |
| other | | 1.2% | |

- Analyze ran about **5 times per feature** (025 ran 11, 029 ran 8). Clarify ran about 2.4 times.
- A new session starts at a median **76.5k tokens** before it does any work (last 20 sessions).
- Pre-implement made 2,079 model requests. That starting context accounts for about **73%** of the input they processed.
- A median analyze run makes 11 requests; the longest made 30. Every request re-reads the whole context.
- Opus handled 140 of 181 pre-implement runs, including 62 of 76 analyze runs.
- You already start fresh sessions between pre-implement commands. Keep doing that.

## Why The Loops Do Not Converge

### 1. Analyze has no finishing line

The skill runs six detection passes, including ambiguity, wording and terminology, and allows 50 findings. Each fresh run samples the documents again, so there is nearly always something new. Your removed fix-all skill made this worse by fixing LOW findings and re-analysing from fresh context.

The skill itself says you may proceed with only LOW or MEDIUM findings. The constitution does not require analyze or clarify at all ("Workflow and Delivery Gates").

### 2. The same fact lives in many files

Each fix must reach every copy, and a missed copy is the next finding.

- `speckit-tasks/SKILL.md` line 198 says to **quote constraints verbatim** into tasks. Your tasks template says **do not restate** them. In 029, T002 and T024 repeat the validation rules in full.
- 029 tasks average 350 characters against your 200 limit. The longest line in the file is 2,116.
- 029 mentions decimals or the value cap on 26 lines across 8 files.
- 029 documents total 103 KB. Analyze draws on spec, plan and tasks, which reached 61 KB.
- The Constitution Check is 55% of the 029 plan.

### 3. Clarify adds scope

Clarify scans ten categories and asks up to five questions, so some category is always "Partial". One category is concurrent edits.

029 shows the effect. Your description asked for asset create, edit and delete. A clarify answer ("follow the account import rules") added edit leases: FR-020, many edge cases, a third table, extra endpoints and status polling. By a rough keyword match, about 23% of the spec and 44% of the tasks concern it. Data is private to each user, so this protects a user from their own second tab. Mortgages already use a much smaller version check (029 research R3).

Clarify also loads only the spec and constitution, so it does not reliably see the "Settled decisions" rule in `docs/code-map.md`.

### 4. Your configuration disagrees with itself

| Conflict | Where |
|---|---|
| SEC-004 is in the constitution but missing from the plan template, tasks template (`SEC-001..003`), constitution-check table, security skill and frontend skill. The v1.7.0 follow-up note is still open. Only the spec template has it. | 5 files |
| "Tests are OPTIONAL" against "Tests: REQUIRED" | tasks skill and tasks template |
| "Dispatch research agents" for every technology against "research only for NEEDS CLARIFICATION" | plan skill and plan template |

A missing SEC-004 row is a likely source of CRITICAL findings, because the model must notice it from the constitution each time.

## Improvements, In Priority Order

### 1. Cap analyze at one pass plus one re-check

Run `/speckit-analyze` once in a fresh session. It now reports only CRITICAL and HIGH findings and asks once to apply all fixes. After you approve, it applies them, re-checks only what changed (at most twice) in the same session, and stops.

Then implement. Run a second full analysis only if you changed a requirement. Quality stays covered by tests, converge and the query, migration and security reviews.

### 2. Move mechanical checks into a script

`scripts/check-spec-artifacts.ps1` costs almost no tokens and gives the same answer every time. Tasks and analyze now run it. It checks that:

- every FR is cited by at least one task (uncited success criteria are warnings)
- every task is well formed (long tasks are warnings)
- the Constitution Check lists every constitution ID
- every PENDING gate is cited by a task
- no placeholders remain
- spec, plan and tasks are within a size budget (warning)

Features written before this rule report uncited requirements. That is expected.

### 3. Keep clarify on material questions

- Put an "Out of scope:" sentence in the `/speckit-specify` description. Specify now asks for it if missing.
- `docs/code-map.md` now holds defaults for concurrency, performance, scale and observability.
- Clarify now asks only where the answer changes stored data, visible behaviour or security, and marks options that add a mechanism with "Adds:".
- Run it again while it still asks material questions. Stop when it says none remain.
- When an "Adds:" option is worth having, consider making it a separate feature.

### 4. Give each fact one home

| Fact | Owner | Everyone else |
|---|---|---|
| Behaviour and rules | `spec.md` | cite FR ID |
| Fields, limits, constraints | `data-model.md` | cite entity |
| API and UI shapes | `contracts/` | cite file |
| Decisions and reasons | `research.md` | cite R number |
| Order of work | `tasks.md` | |

- Replace the "quote verbatim" line in the tasks skill with "cite the constraint by ID".
- In the plan, list only applicable IDs in full and put the rest on one N/A line. Link the UI checklist instead of pasting it. WEB-001 says the checklist "must appear", and the constitution-check skill and templates assume every ID has a row, so this needs a constitution amendment and matching edits.

### 5. Split features with two concerns

029 was a register plus edit coordination. As two features, each analyze reads less and each fix touches fewer files. For comparison, 028 produced 19 KB of artifacts and needed no clarify or analyze, though it was a much smaller change.

### 6. Fix the conflicts

Add SEC-004 to the five files. Override the plan skill's research-agent step with your template's rule, in the preset. Then run `.\scripts\sync-agent-config.ps1 -From claude`.

### 7. Shrink the starting context

This is the largest single input cost. Each 10k tokens removed saves about 4% or more of pre-implement cost.

- Optional measurement: run `claude` in a terminal, then `/context` (a built-in command), to see what fills it.
- The desktop session used for this review had a locally installed `dotnet-claude-kit` plugin (dozens of skills, 10 agents and an MCP server), a WireGuard skill plugin, and Claude Docs, Chrome and computer-use tools. No plugins are enabled on the claude.ai account. Disable what you do not use for this project.
- Compare a terminal session with a desktop Code tab session. I have not measured how much each source contributes.

### 8. Match the model to the step

Try Sonnet for specify, tasks and analyze, and keep Opus for plan and clarify. Trial it on one feature and compare what converge finds.

### Not worth doing

- Cutting the constitution or rules further. They are a small part of the context.
- Removing the extension-hook text from the Spec Kit skills. It is about 4.3 KB per command and unused (there is no `extensions.yml`), but editing it complicates upgrades.

## Next Feature Checklist

1. `/speckit-specify` with an "Out of scope:" sentence.
2. Read the spec yourself and cut anything you did not ask for.
3. Clarify until it says no material questions remain.
4. Plan, then tasks (which runs the script check).
5. One analyze run: approve the fixes and let it re-check.
6. Implement.

| Target | Before | Aim |
|---|---|---|
| Analyze runs per feature | about 5 | 1, at most 2 |
| Clarify runs per feature | about 2.4 | as many as ask material questions |
| Spec, plan and tasks combined (029) | 61 KB | under 35 KB |
| Starting context | 76.5k | measure, then reduce |

If converge starts finding more gaps after these changes, loosen the analyze filter to include MEDIUM.

## Outside This Scope

Converge runs start at about 219k tokens of existing context, which suggests they follow implement in the same session. Starting a fresh session before converge is the first thing to try there.
