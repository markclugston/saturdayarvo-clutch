---
name: "clutch-constitution-check"
description: "How to apply the Clutch constitution: Constitution Check, gate tasks, completion review. Use when planning, checking compliance, or before declaring work complete."
metadata:
  author: "saturdayarvo-clutch"
  governs: "Constitution governance, ENG-001 completion"
---

# Clutch Constitution Check

The constitution (`.specify/memory/constitution.md`) holds the binding rules. This skill holds the
procedure for applying them. Constitutional violations are CRITICAL findings.

## 1. Identify applicable requirement IDs (before planning)

| ID | Applies when the feature… | Load skill |
|---|---|---|
| ARC-001 | always | — |
| ENG-001 | always | `clutch-dotnet-service` / `clutch-frontend` for test tooling |
| DOT-001 | adds or changes C# code or projects | `clutch-dotnet-service` |
| OPS-001 | adds or changes a service, its runtime behaviour, or a migration | `clutch-dotnet-service`, `clutch-data-access` |
| DOT-002 | touches EF Core, queries, schema or migrations | `clutch-data-access` |
| AUD-001 | creates, reads or changes audit records | `clutch-data-access` |
| SEC-001 | adds or changes endpoints, auth, input handling or dependencies | `clutch-security-review` |
| SEC-002 | touches configuration, credentials or integrations | `clutch-security-review` |
| SEC-003 | handles personal, payment or financial data, logging or error responses | `clutch-security-review` |
| SEC-004 | accepts or changes data entry or input validation | `clutch-security-review`, `clutch-frontend` |
| WEB-001 | touches `src/clutch-web` | `clutch-frontend`, `clutch-ui-style` |
| Perf & Observability | adds user-initiated actions or service behaviour | `clutch-dotnet-service` / `clutch-frontend` |

Load only the skills for the IDs that apply. When unsure whether an ID applies, include it and
say why it is marginal.

## 2. Write the Constitution Check (plan)

Fill the plan's Constitution Check section with one row per applicable ID, then name every other
ID on one N/A line with a short reason:

```markdown
| ID | Applies | How the plan complies | Gate / evidence | Status |
|----|---------|-----------------------|-----------------|--------|
| ARC-001 | Yes | Domain logic in X, no HTTP types in domain | Review | PASS |
| DOT-002 | Yes | New query in Y; independent query review planned | Query review checklist | PENDING |

N/A: WEB-001 (no clutch-web changes)
```

- When WEB-001 applies: list the applicable style guide sections (by §) and name
  `clutch-ui-style/references/compliance-checklist.md` as a gate. Do not copy it into the plan.
- Any deviation goes in the plan's Complexity Tracking table with a justification. An unjustified
  deviation is a CRITICAL finding.
- Re-evaluate the Constitution Check after design (Phase 1).

## 3. Tasks

Every gate marked PENDING in the Constitution Check needs a task: tests, the independent query
review, the migration review, the security review, the UI checklist validation, and the quality gates.
Add them when tasks.md is generated, not later. Missing gate tasks make `/speckit-converge` create
fix-up tasks, which means another implement and converge run.

- Every user story phase includes its test tasks (ENG-001 counts as an explicit request for tests).
- The independent query, migration and security reviews run once per feature over the full diff,
  in the final phase, not after each task.

## 4. Completion review (delivery gates)

Work is complete only when all of these hold. Record each with evidence:

- [ ] Applicable requirement IDs identified
- [ ] Constitution Check completed, with no unjustified deviations
- [ ] All applicable automated tests and quality gates pass (see the domain skills for the commands)
- [ ] Required database reviews completed (`clutch-data-access`)
- [ ] Independent security review completed and all findings remediated and verified (`clutch-security-review`)
- [ ] Every UI compliance checklist item validated and its result recorded, if WEB-001 applies
- [ ] No blocking findings remain

Reporting rules:

- Validation must be agent-executable. Manual testing is not a required gate. Browser,
  accessibility, integration and other automated validation replace manual verification.
- Participant usability studies are not acceptance criteria.
- After a fix, rerun the gates whose covered code changed. Follow the test cadence in the domain skills.
- Report every failed or blocked check. Never claim a check passed when it failed or could not run.

## Spec Kit order

specify → (clarify) → plan → tasks → (analyze, checklist) → implement → converge. Converge is
required before completion.
