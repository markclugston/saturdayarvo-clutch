# Implementation Plan: Amortization Period Dates and End-of-Day Balances

**Branch**: `022-amortization-period-dates` | **Date**: 2026-11-23 | **Spec**: [spec.md](spec.md)

## Summary

Period k is the k-th payment, dated the Disbursal Date plus k intervals; the schedule shows Duration rows and no
payment follows period Duration. The shared repayment date function in each tier shifts by one interval, so the
row dates, the 31 Dec 9999 Duration limit and the Effective Date range all use the same final repayment date
(FR-007). The period balance endpoint re-windows each period to end on its date, so its unchanged lookup returns
the end-of-day balance. No schema, endpoint shape, auth or message changes.

## Technical Context

**Baseline**: The existing stack and settled decisions in the code (see `docs/code-map.md`).

**Feature-specific changes**:

- Domain: `RepaymentDates.FinalRepaymentDate` takes N steps, not N − 1 (research R1); validator code unchanged
  but follows it. `PeriodBalances.MortgagePeriods` yields Duration windows ending on each period date (R2);
  `MonthlyPeriods` adjusts its step index so the fallback is unchanged.
- Application: `PeriodBalanceService` returns `periodCount = duration`.
- API contract: semantics only, see [contracts/period-balances-api.md](contracts/period-balances-api.md).
- UI: `finalRepaymentDate` shifts identically (form validation follows); Date column filled with
  `formatDisplayDate`, Duration rows, with and without an account, see
  [contracts/amortization-schedule-ui.md](contracts/amortization-schedule-ui.md).
- Supersedes 016 FR-019 (period 1 on the Disbursal Date), 016 FR-011 and 016 SC-004 (Duration + 1 rows).
- No new packages, schema, endpoints, metrics or log messages. No data-model.md: nothing stored (both
  entities are derived).

**Performance Goals**: Constitution defaults; 020's SC-004 timing (360 periods, 10,000 transactions, < 2 s)
still holds: same query and single-pass lookup.

**Constraints**: Dates, validation boundaries and balances must agree across tiers: C# and TS share test vectors
(SC-006). No stored data changes; a saved mortgage pushed past 31 Dec 9999 is flagged on next save (spec edge case).

**Scale/Scope**: Two date functions, one period function, one service line, one component, their tests.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| ID | Applies | How the plan complies | Gate / evidence | Status |
|----|---------|-----------------------|-----------------|--------|
| ARC-001 | Yes | Period windows stay in pure `Domain/Mortgages`; UI date logic in clutch-web. Only spec'd behaviour: Bank Schedule still not calculated, no shared-helper refactor. | Completion review (T020) | PASS |
| DOT-001 | Yes | .NET 10; existing async/cancellation patterns kept. | Build, tests (T020) | PASS |
| DOT-002 | Yes (unchanged query) | No query or schema change; existing SQL Server integration tests for the endpoint are updated for the new periods. No independent query review needed (no database change). | Provider-backed integration tests | PASS |
| AUD-001 | No | No audit reads or writes. | N/A | N/A |
| ENG-001 | Yes | Unit tests (`RepaymentDatesTests`, `MortgageValidatorTests` boundaries, `PeriodBalancesTests` windows, lookup and fallback, quickstart 1–5 and 6's fallback), integration (mortgage save boundaries, `period-balances` periodCount, end-of-day and old-rule refusal, quickstart 6–7), Vitest (`repaymentDates`, `loanDraft`, `InterestRateChangesDialog`, `AmortizationSchedule*`, `MortgagesPage`), Playwright (`mortgages.spec.ts`). | Test tasks (T001–T006, T009–T011, T013, T014, T017), quality gates (T020) | PASS |
| OPS-001 | Yes (unchanged) | Logging and metrics unchanged; no migration. | Logging check (T020) | PASS |
| SEC-001 | Yes | Endpoint auth and ownership 404 unchanged; Duration and Effective Date bounds move one interval, still enforced at the boundary with no overflow (`null` past 31 Dec 9999). No new dependencies. | Independent OWASP Top 10 and dependency vulnerability review (T018) | PASS |
| SEC-002 | No | No secrets or configuration. | N/A | N/A |
| SEC-003 | Yes | Balances still returned only to the owner, never logged or in errors. | Security review (T018) | PASS |
| SEC-004 | Yes | FR-007 changes one shared bound in both tiers at once: UI (`loanDraft.ts`) and server (`MortgageValidator`, `ParseSchedule`) both call their tier's `finalRepaymentDate`; parity proven by identical vectors (SC-006); field keys and messages unchanged and disclose nothing. | Security review (T018), boundary tests (T002, T003, T005) | PASS |
| WEB-001 | Yes | TypeScript; existing table primitives and tokens; date cells left aligned, numeric cells stay right aligned (`clutch/numeric-align`); Title Case headers unchanged; table roles and `aria-rowcount` kept correct. | Frontend gates (T017, T020), UI compliance checklist (T019) | PASS |
| Perf & Observability | Yes (unchanged) | Dates computed synchronously for visible rows only (windowed); existing balance metric. | 500 ms feedback, OpenTelemetry metrics (T020) | PASS |

**Applicable style guide sections**: §5 Components (table), §6 Tokens (text colours: Date moves from
`text-fg-secondary` to default), §7 Typography (headers unchanged), §9 Accessibility (table roles, row count).

**UI compliance checklist** (style guide §11):

- [ ] Only tokens used: no raw colours, default palette, non-token radius, extra ring or shadow, or `dark:` colour
- [ ] No borders or divider lines on layout containers (hairline utilities only)
- [ ] Transitions, durations and easing within the allowed set; `prefers-reduced-motion` respected
- [ ] Surface hierarchy follows canvas, content, card, raised
- [ ] Built from existing primitives and variants; none restyled ad hoc
- [ ] Form fields use floating labels (not applicable: no form change)
- [ ] Labels, headings and button text use Title Case; helper, error and body text use sentence case
- [ ] % and $ fields use the shared formatted field (not applicable: no entry field)
- [ ] Navigation expand/collapse behaviour unchanged unless an approved spec amends it
- [ ] Dark theme has no pure black surface or pure white text
- [ ] Both themes verified (screenshots)
- [ ] WCAG 2.2 AA (axe) and contrast pass in both themes
- [ ] Visible focus ring on every interactive element
- [ ] Status not conveyed by colour alone

**Post-design re-check (Phase 1)**: No violations. The earlier spec/code conflict on the final repayment date
is resolved by the user's clarification (spec FR-007): one rule, Disbursal Date plus Duration intervals, in both
tiers. 016 FR-019 and FR-011/SC-004 are superseded by this spec's FR-007 and FR-002.

## Project Structure

### Documentation (this feature)

```text
specs/022-amortization-period-dates/
├── plan.md
├── research.md
├── quickstart.md
├── contracts/
│   ├── period-balances-api.md
│   └── amortization-schedule-ui.md
└── tasks.md             # /speckit-tasks output
```

### Source Code (files this feature touches)

```text
src/Clutch.API/
├── Domain/Mortgages/RepaymentDates.cs                 # changed: N steps (payment N = disbursal + N intervals)
├── Domain/Mortgages/PeriodBalances.cs                 # changed: MortgagePeriods windows; MonthlyPeriods step index
└── Application/Mortgages/PeriodBalanceService.cs      # changed: periodCount = duration

tests/Clutch.API.Tests/
├── Unit/Mortgages/RepaymentDatesTests.cs              # changed: shared vectors shift one interval
├── Unit/Mortgages/MortgageValidatorTests.cs           # changed: Duration and Effective Date boundaries; existing range messages
├── Unit/Mortgages/PeriodBalancesTests.cs              # changed: windows, end of day, FR-005, fallback unchanged
├── Integration/Mortgages/MortgageCreateTests.cs       # changed: Duration and Effective Date save boundaries
├── Integration/Mortgages/MortgageUpdateTests.cs       # changed: adds Duration and Effective Date save boundaries (none today)
├── Integration/Mortgages/PeriodBalancesTests.cs       # changed: periodCount, end-of-day balances

src/clutch-web/
├── src/features/mortgages/repaymentDates.ts           # changed: N steps
├── src/features/mortgages/repaymentDates.test.ts      # changed: shared vectors
├── src/features/mortgages/loanDraft.test.ts           # changed: Duration and Effective Date boundaries
├── src/features/mortgages/InterestRateChangesDialog.test.tsx    # changed: range message end date
├── src/features/mortgages/MortgagesPage.test.tsx      # changed: unsaved-form row count (aria-rowcount 362 → 361)
├── src/features/mortgages/AmortizationSchedule.tsx    # changed: Duration rows, Date cells, props to PlainSchedule
├── src/features/mortgages/AmortizationSchedule.test.tsx         # changed: row count, dates, form changes
├── src/features/mortgages/AmortizationScheduleAccount.test.tsx  # changed: row count, dates with balances
├── src/features/mortgages/LoanDetailsForm.tsx         # changed: pre-existing 021 break (see Complexity Tracking)
└── e2e/mortgages.spec.ts                              # changed: row count, dated row, range message; 021 rate entry order
```

**Structure Decision**: Existing layout; no new files outside the spec folder.

## Complexity Tracking

No constitution violations to justify.

Two fixes outside this feature's scope stay in this change (T022). Both repair breaks that 021 left on
`main` and that blocked this feature's completion gates (T017 `npm run e2e`, T020 `typecheck`/`lint`).
Neither changes behaviour, so they are build repairs, not unrequested features (ARC-001):

- `LoanDetailsForm.tsx`: imports `PaymentFrequency` from `./repaymentDates` (the type is not exported
  from `@/lib/api/schemas`), and clears `interestRateChanges` without an unused destructured binding
  (lint error). Same result: the error is removed once the opening rate exists.
- `e2e/mortgages.spec.ts`: enters the rate changes opening-rate first, because since 021 the first rate
  added is the opening rate dated on the Disbursal Date. Saved data and assertions are unchanged.

Splitting them into a separate change would leave this branch failing its own gates until that change
merged.
