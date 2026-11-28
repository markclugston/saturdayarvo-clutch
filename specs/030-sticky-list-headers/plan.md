# Implementation Plan: Sticky List Headers

**Branch**: `030-sticky-list-headers` | **Date**: 2026-11-28 | **Spec**: [spec.md](./spec.md)

## Summary

On the account transactions list, the assets list and the mortgages amortization schedule (research R7), stop the list group at the top of the content panel while the panel's scroll moves the rows through it, then let the panel carry on (research R3). This replaces the first build, which held only the column header.

## Technical Context

**Baseline**: The existing stack and settled decisions in the code (see `docs/code-map.md`).

**Feature-specific changes**:
- UI: new hook `src/clutch-web/src/lib/usePinnedList.ts` (R3, R4), replacing `useHeldTableHeader.ts`; applied to `TransactionsTable.tsx` and `AssetsPage.tsx` with R5 and R6. See [contracts/pinned-list-ui.md](./contracts/pinned-list-ui.md).
- UI: the same hook in `LoanPayoffTimeline.tsx`, with the list element and row window in `AmortizationSchedule.tsx` (R7).
- No API, schema, package or primitive changes. The burndown chart is untouched.

**Performance Goals**: Constitution defaults. Updates are batched to one per animation frame with a passive scroll listener.

**Constraints**: One vertical scrollbar, the content panel's (FR-006). No change to `ContentPanel` or `Card`.

**Scale/Scope**: Three lists; transactions grow with Load More pages, and the schedule renders only the rows in view.

## Constitution Check

*Procedure: `clutch-constitution-check`. Pre-research: PASS for planning. Post-design: PASS for planning. Every PENDING gate needs a task in tasks.md.*

| ID | Applies | How the plan complies | Gate / evidence | Status |
|----|---------|-----------------------|-----------------|--------|
| ARC-001 | Yes | Scrolling behaviour only in clutch-web for the three lists the spec names. | Review | PASS |
| ENG-001 | Yes | Unit tests for the hook; component tests for all three lists; style-guide browser tests for the behaviour in a real browser. | Test tasks; lint, typecheck, unit, build, browser gates | PENDING |
| WEB-001 | Yes | TypeScript hook; existing primitives and tokens; table semantics and region unchanged apart from R6; keyboard focus kept visible; axe in both themes. | Lint, component, browser tests; UI compliance checklist | PENDING |
| Perf & Observability | Yes | No user action is added; rAF-batched updates. No new metrics: no server behaviour changes. | Browser test | PENDING |

N/A: DOT-001, DOT-002, AUD-001, OPS-001 (no .NET, data, audit or migration change); SEC-001, SEC-002, SEC-003, SEC-004 (no endpoint, input, secret or new data disclosure; the lists already show this data).

### Style guide sections (WEB-001)

- §2–3 layout: the content panel stays the only vertical scroller; the margin above and below a stopped group is the panel's padding.
- §6 tokens: the header keeps `bg-raised` so rows never show through.
- §7–9 motion and accessibility: no animation or transition added; WCAG 2.2 SC 2.4.11 focus not obscured (R4, R5); visible focus ring on the region, row controls and Load More.
- Gate: every item in `.claude/skills/clutch-ui-style/references/compliance-checklist.md`, recorded in `validation.md` at completion.

## Project Structure

### Documentation (this feature)

```text
specs/030-sticky-list-headers/
├── plan.md
├── research.md
├── quickstart.md
├── contracts/
│   └── pinned-list-ui.md
├── tasks.md
└── validation.md
```

No `data-model.md`: no entities or schema change.

### Source Code (files this feature touches)

```text
src/clutch-web/src/lib/
├── usePinnedList.ts                 # new (R3, R4)
├── usePinnedList.test.ts            # new
├── useHeldTableHeader.ts            # removed
└── useHeldTableHeader.test.ts       # removed
src/clutch-web/src/features/accounts/
├── TransactionsTable.tsx            # pinned group, Load More in the region
└── TransactionsTable.test.tsx
src/clutch-web/src/features/assets/
├── AssetsPage.tsx                   # pinned group
└── AssetsPage.test.tsx
src/clutch-web/src/features/mortgages/
├── LoanPayoffTimeline.tsx           # pinned group in the schedule view
├── LoanPayoffTimeline.test.tsx
├── AmortizationSchedule.tsx         # list element and row window (R7)
└── AmortizationSchedule.test.tsx
src/clutch-web/e2e/
└── style-guide.spec.ts              # pinned-list states, both themes (+ snapshots)
docs/code-map.md                     # hook pointer
```

**Structure Decision**: Existing layout. The hook sits beside `src/lib/useMediaQuery.ts`.

## Complexity Tracking

None.
