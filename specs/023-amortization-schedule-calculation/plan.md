# Implementation Plan: Amortization Schedule Calculation

**Branch**: `023-amortization-schedule-calculation` | **Date**: 2026-11-23 | **Spec**: [spec.md](spec.md)

## Summary

A pure TypeScript function in clutch-web turns the Details form's calculation inputs into a period-by-period
principal and interest schedule: integer-cent balances, level repayments recalculated whenever a period starts
wholly at a new rate, interest blended by days within a period that contains a rate change, and the last
repayment adjusted to close at $0.00 (research R1–R4). The form reports its calculation inputs (or "invalid")
to the page; the Amortization Schedule memoises the schedule once and feeds both the Bank Schedule column and a
drawn Burndown "Bank Schedule" line (R5–R7). No server, endpoint, schema or package change.

## Technical Context

**Baseline**: The existing stack and settled decisions in the code (see `docs/code-map.md`).

**Feature-specific changes**:

- New pure module `src/features/mortgages/scheduleCalculation.ts`: `calculateSchedule(inputs)` →
  `ScheduledPeriod[]`, see [data-model.md](data-model.md) and
  [contracts/amortization-schedule-ui.md](contracts/amortization-schedule-ui.md).
- `loanDraft.ts`: `scheduleInputs(draft, today)` → `ScheduleInputs | null`; null when `validateDraft` reports
  any error other than `name` (FR-002). `repaymentDates.ts`: export a `daysBetween` helper (UTC day count).
- `LoanDetailsForm.tsx`: new `onCalculationInputsChange` callback beside `onScheduleChange`; emits from the
  current draft, so a clean saved mortgage reports its saved values and an edited one its form values (R5).
- `MortgagesPage.tsx` / `LoanPayoffTimeline.tsx`: pass `calculation` (inputs or undefined) down; while valid,
  the table's Duration, Disbursal Date and Frequency come from it so rows, dates and balances always agree (R6).
- `AmortizationSchedule.tsx`: Bank Schedule cell shows the formatted closing balance when a schedule exists,
  else `NOT_CALCULATED`; Actual Balance column and fallback view unchanged.
- `BurnDownChart.tsx`: draws the series (polyline in the existing SVG frame, currency and date axis ticks,
  legend unchanged) and a value-describing `aria-label` when a schedule exists; existing message and
  enter-details prompt otherwise (R7).
- Supersedes 016 FR-016 (amortization values deferred). No new packages, endpoints, metrics or stored data.

**Performance Goals**: SC-004: calculation of 1,560 weekly periods well under 500 ms (target < 20 ms, single
O(periods + rate changes) pass); calculated once per input change via `useMemo`, shared by table and chart;
the table stays windowed; the chart plots Duration + 1 points (1,561 at 30 years weekly; longer Durations
up to 022's year-9999 limit are calculated in full, outside SC-004's bound).

**Constraints**: Exact cents (integer arithmetic for balances, half-away-from-zero rounding, R2). Calculation
never throws to the UI: any non-finite result yields `null` → "Not yet calculated" (spec edge case). No
saved-value fallback when the form is invalid (FR-002). Interest-only, extra repayments, offsets out of scope.

**Scale/Scope**: One new pure module, four component edits, one form callback, their tests.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| ID | Applies | How the plan complies | Gate / evidence | Status |
|----|---------|-----------------------|-----------------|--------|
| ARC-001 | Yes | Calculation is a pure module with no React, HTTP or storage; UI in clutch-web only (FR-011). Only spec'd output: Bank Schedule balance and chart series; no new columns, no repayment display, no server calculation. | Review | PENDING |
| DOT-001 | No | No C# change. | N/A | N/A |
| DOT-002 | No | No database access or schema change. | N/A | N/A |
| AUD-001 | No | No audit reads or writes. | N/A | N/A |
| ENG-001 | Yes | Vitest: `scheduleCalculation.test.ts` (spec worked examples, Weekly/Fortnightly, 0%, Duration 1, change on a period date, two changes in one period, final-date change, change inside period 1, balance rise, early repayment by rounding never negative, 100% rate, invariants SC-001/003, 1,560-period timing), `loanDraft.test.ts` (`scheduleInputs` incl. invalid Name ignored), `AmortizationSchedule*.test.tsx`, `BurnDownChart.test.tsx`, `LoanPayoffTimeline.test.tsx`, `MortgagesPage.test.tsx` (form edits update values, invalid edits hide them). Playwright `mortgages.spec.ts` journeys and `style-guide.spec.ts` chart screenshots. | Test tasks, quality gates (`npm run lint`, `typecheck`, `test`, `test:e2e`, `test:e2e:style-guide`, `build`) | PENDING |
| OPS-001 | No | No service or migration change; nothing logged. | N/A | N/A |
| SEC-001 | Yes (marginal) | No endpoint, auth or dependency change. Inputs are only consumed after the existing 016/017/021 client validation; server validation unchanged and unaffected (values not sent). | Independent OWASP Top 10 and dependency review over the diff | PENDING |
| SEC-002 | No | No configuration or secrets. | N/A | N/A |
| SEC-003 | Yes | Balances computed and shown only in the owner's session; never logged, stored, sent or put in error text; a failed calculation shows only "Not yet calculated". | Security review | PENDING |
| SEC-004 | Yes (unchanged) | No new inputs; the calculation reuses `validateDraft` (UI) and the server's existing `MortgageValidator` is untouched. | Security review | PASS |
| WEB-001 | Yes | TypeScript; currency cells right aligned with `tabular-nums` (`clutch/numeric-align`); chart uses token colours via `currentColor` classes (`text-primary`, `text-fg-secondary`); Title Case labels unchanged; chart `role="img"` with value-describing label. | Frontend gates, UI compliance checklist | PENDING |
| Perf & Observability | Yes | Values update synchronously on input change (< 500 ms, SC-004, timing test). No server behaviour, so no new OpenTelemetry metric; existing client-side setup unchanged. | 500 ms feedback test | PENDING |

**Applicable style guide sections**: §5 Components (table cells; chart inside the existing card), §6 Tokens
(series and axis colours via text tokens, no raw colours), §7 Typography (`tabular-nums`, axis label size),
§9 Accessibility (chart text alternative, colour not the only cue: legend label and text alternative).

**UI compliance checklist** (style guide §11):

- [x] Only tokens used: no raw colours, default palette, non-token radius, extra ring or shadow, or `dark:` colour
- [x] No borders or divider lines on layout containers (hairline utilities only)
- [x] Transitions, durations and easing within the allowed set; `prefers-reduced-motion` respected (no animation added)
- [x] Surface hierarchy follows canvas, content, card, raised
- [x] Built from existing primitives and variants; none restyled ad hoc
- [x] Form fields use floating labels (not applicable: no form field change)
- [x] Labels, headings and button text use Title Case; helper, error and body text use sentence case
- [x] % and $ fields use the shared formatted field (not applicable: no entry field)
- [x] Numbers and currency amounts, and their column headers, are right aligned (`text-right`, `tabular-nums`)
- [x] Navigation expand/collapse behaviour unchanged unless an approved spec amends it
- [x] Dark theme has no pure black surface or pure white text
- [x] Both themes verified (screenshots)
- [x] WCAG 2.2 AA (axe) and contrast pass in both themes
- [x] Visible focus ring on every interactive element
- [x] Status not conveyed by colour alone

**Post-design re-check (Phase 1)**: No violations. R6 (table follows valid form inputs) applies 022's row and
date rule to the inputs shown on screen; it changes nothing for a clean saved mortgage (form = saved) or an
unsaved one (already follows the form), so FR-009 holds.

## Project Structure

### Documentation (this feature)

```text
specs/023-amortization-schedule-calculation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── amortization-schedule-ui.md
└── tasks.md             # /speckit-tasks output
```

### Source Code (files this feature touches)

```text
src/clutch-web/
├── src/features/mortgages/scheduleCalculation.ts          # new: calculateSchedule (pure)
├── src/features/mortgages/scheduleCalculation.test.ts     # new: worked examples, edge cases, invariants, timing
├── src/features/mortgages/repaymentDates.ts                # changed: export daysBetween
├── src/features/mortgages/repaymentDates.test.ts           # changed: daysBetween
├── src/features/mortgages/loanDraft.ts                     # changed: scheduleInputs(draft, today)
├── src/features/mortgages/loanDraft.test.ts                # changed: scheduleInputs
├── src/features/mortgages/LoanDetailsForm.tsx              # changed: onCalculationInputsChange
├── src/features/mortgages/LoanDetailsForm.test.tsx         # changed: callback emits valid / undefined
├── src/features/mortgages/MortgagesPage.tsx                # changed: holds and passes calculation inputs
├── src/features/mortgages/MortgagesPage.test.tsx           # changed: live updates, invalid edits, no saved fallback
├── src/features/mortgages/LoanPayoffTimeline.tsx           # changed: useMemo schedule, passes to both views
├── src/features/mortgages/LoanPayoffTimeline.test.tsx      # changed
├── src/features/mortgages/AmortizationSchedule.tsx         # changed: Bank Schedule cell values
├── src/features/mortgages/AmortizationSchedule.test.tsx    # changed
├── src/features/mortgages/AmortizationScheduleAccount.test.tsx  # changed: both balance columns
├── src/features/mortgages/BurnDownChart.tsx                # changed: plotted series, ticks, text alternative
├── src/features/mortgages/BurnDownChart.test.tsx           # changed
├── e2e/mortgages.spec.ts                                   # changed: calculated values, rate change, burndown
└── e2e/style-guide.spec.ts (+ snapshots)                   # changed: burndown with a plotted line, both themes
```

**Structure Decision**: Existing layout; the calculation sits beside `repaymentDates.ts` as a sibling pure module.

## Complexity Tracking

No constitution violations to justify.
