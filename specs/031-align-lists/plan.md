# Implementation Plan: Align Existing Lists

**Branch**: `031-align-lists` | **Date**: 2026-11-28 | **Spec**: [spec.md](spec.md)

## Summary

Extract the Assets list markup and its delete confirmation into shared UI primitives, with the
Assets list unchanged, then rebuild the five lists in scope on them (UI shapes:
[contracts/list-ui.md](contracts/list-ui.md)). Frontend only.

## Technical Context

**Baseline**: The existing stack and settled decisions in the code (see `docs/code-map.md`).

**Feature-specific changes**: new primitives in `src/clutch-web/src/components/ui/`; the
`clutch/numeric-align` lint rule covers their cells; no packages, API or schema changes.

**Performance Goals**: Constitution defaults.

**Constraints**: The schedule keeps rendering only the rows near view (FR-010), with an exact row
pitch of 40 px.

**Scale/Scope**: Six lists, two delete dialogs.

## Constitution Check

*Procedure: `clutch-constitution-check` skill.*

| ID | Applies | How the plan complies | Gate / evidence | Status |
|----|---------|-----------------------|-----------------|--------|
| ARC-001 | Yes | Only the lists and decisions in spec.md; no domain changes | Review | PASS |
| ENG-001 | Yes | Tests written first for each primitive and list | Test tasks, quality gates | PENDING |
| SEC-001 | Yes | No endpoint, input rule or dependency change | Independent security and dependency review | PENDING |
| SEC-003 | Yes | Descriptions shown in dialog and toast only; fixed error messages, nothing logged | Security review | PENDING |
| WEB-001 | Yes | Lists follow §12 through shared primitives; differences approved below | Frontend gates, UI compliance checklist | PENDING |
| Perf & Observability | Yes | Loading, retry and "Deleting…" feedback shown at once; no service change, so no new metrics | Component tests | PENDING |

N/A: DOT-001, DOT-002, AUD-001, OPS-001, SEC-004 (no server, data or validation change),
SEC-002 (no configuration or credentials).

Style guide sections: §2, §5, §7, §8, §9, §12. Gate: every item in
`clutch-ui-style/references/compliance-checklist.md`.

Re-check after design: unchanged; no unapproved list difference remains.

## Project Structure

### Documentation (this feature)

```text
specs/031-align-lists/
├── plan.md
├── quickstart.md
├── contracts/list-ui.md
└── tasks.md
```

### Source Code (files this feature touches)

```text
src/clutch-web/src/components/ui/       list.tsx, delete-dialog.tsx (new, with tests)
src/clutch-web/src/features/assets/     AssetsPage.tsx, DeleteAssetDialog.tsx, AssetForm.tsx
src/clutch-web/src/features/accounts/   TransactionsTable.tsx, DeleteTransactionDialog.tsx
src/clutch-web/src/features/imports/    ImportReviewTable.tsx
src/clutch-web/src/features/mortgages/  AmortizationSchedule.tsx, actualBalances.ts,
                                        InterestRateChangesDialog.tsx, testSupport.tsx
src/clutch-web/eslint-rules/            clutch-numeric-align.js and its test
src/clutch-web/e2e/                     style-guide, accounts-transaction-delete, assets, mortgages specs
.claude/skills/clutch-ui-style/         SKILL.md, references/lists.md (synced to .github/)
docs/code-map.md
```

**Structure Decision**: Existing layout, following sibling files.

## Complexity Tracking

Differences from `clutch-ui-style` §12, each approved by the user on 2026-11-28 (their words or the
option they chose):

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Categories page: every difference | "Approve as is"; "just like categories is different" | User declined alignment |
| Your Accounts: every difference | "the account table should stay as is. its not a list in the same way as the others"; "dont change accounts" | User declined alignment |
| Interest rate changes scroll inside the dialog, no page pinning | Chose "Table styled like Assets, still scrolling below the add inputs" | Page pinning cannot work in a dialog |
| Interest Rates adds through inputs above the list | Chose "Inputs stay above the table; recorded as an approved difference" | User declined a second dialog |
| Account Details keeps the secondary "Import Transactions" button above the heading | Chose "No change to the button; recorded as an approved difference" | User declined moving it |
