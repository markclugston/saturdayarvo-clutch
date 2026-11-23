---

description: "Task list for 022-amortization-period-dates"
---

# Tasks: Amortization Period Dates and End-of-Day Balances

**Input**: `specs/022-amortization-period-dates/` (plan.md, spec.md, research.md, quickstart.md, contracts/)

**Tests**: REQUIRED. ENG-001 makes every behaviour change an explicit request for tests. Write
tests first and confirm they fail before implementing.

## Format: `- [ ] T### [P?] [US#?] Description with exact file path`

- **[P]**: parallel-safe (different files, no dependency). **[US#]**: user story label.
- **Notation**: `F(d, N)` = final repayment date, the Disbursal Date `d` plus N payment intervals (FR-007); `D(k)` = `F(disbursalDate, k)`, the date of period k (FR-001).

No Setup phase: no new package, config or schema.

## Phase 2: Foundational — one final repayment date rule in both tiers (FR-007, SEC-004)

Blocks both stories: period dates (US1) and period windows (US2) are built on the shifted function.

- [X] T001 [P] Shift shared vectors one interval per quickstart 1 (periods 1 → +1 interval, 360 Monthly → 2053-11-29, 0 → null) in `tests/Clutch.API.Tests/Unit/Mortgages/RepaymentDatesTests.cs`
- [X] T002 [P] Duration limit (Disbursal 9999-12-10 Weekly: Duration 3 accepted, Duration 4 refused with "The final repayment date would be later than 31 Dec 9999") and Effective Date (one day before and on `F(d, N)` accepted, one day after refused; SC-006) boundary tests per quickstart 2; also move the existing range-message cases in `Out_of_range_dates_use_the_invariant_formatted_range_message` to the new rule (0001-01-01, Duration 1: "Choose a date from 1 Jan 0001 to 1 Feb 0001" with out-of-range date 0001-02-02; 2000-01-01, 360 Monthly: "1 Dec 2029" → "1 Jan 2030" with out-of-range date 2029-12-02 → 2030-01-02) in `tests/Clutch.API.Tests/Unit/Mortgages/MortgageValidatorTests.cs`
- [X] T003 [P] Save boundary integration tests (Duration limit with the T002 vectors, Effective Date one day before/on/after `F(d, N)`, SC-006), plus an update of a mortgage seeded under the old rule (through the test fixture's EF Core DbContext, bypassing validation) whose `F(disbursalDate, Duration)` now passes 31 Dec 9999, refused with 400 and `duration`: "The final repayment date would be later than 31 Dec 9999" (spec edge case: flagged on its next save) in `tests/Clutch.API.Tests/Integration/Mortgages/MortgageCreateTests.cs` and `MortgageUpdateTests.cs`
- [X] T004 [P] Same vectors as T001 in `src/clutch-web/src/features/mortgages/repaymentDates.test.ts`
- [X] T005 [P] Duration and Effective Date boundary vectors matching T002 (Disbursal 9999-12-10 Weekly: Duration 3 accepted, 4 refused; Effective Date one day before, on, one day after `F(d, N)`; e.g. 1 Jan 2000, 360 Monthly → "Choose a date from 1 Jan 2000 to 1 Jan 2030"); existing 120 Monthly cases move from "1 Dec 2009" to "1 Jan 2010" and the "after final repayment" date from 2010-01-01 to 2010-01-02 in `src/clutch-web/src/features/mortgages/loanDraft.test.ts`
- [X] T006 [P] Update the "date out of range" case to the new end date ("Choose a date from 1 Jan 2000 to 1 Jan 2010", out-of-range date 2010-01-02) in `src/clutch-web/src/features/mortgages/InterestRateChangesDialog.test.tsx`
- [X] T007 `FinalRepaymentDate` takes N steps, not N − 1 (null past 31 Dec 9999, 0 → null) per research R1 in `src/Clutch.API/Domain/Mortgages/RepaymentDates.cs`
- [X] T008 `finalRepaymentDate` takes N steps, identical to T007, in `src/clutch-web/src/features/mortgages/repaymentDates.ts`
- [X] T009 Test first: add a fallback-unchanged assertion (020 `MonthlyPeriods` windows for a fixed first date, incl. a 31 Jan anchor) in `tests/Clutch.API.Tests/Unit/Mortgages/PeriodBalancesTests.cs` and confirm it fails after T007; then make `MonthlyPeriods` request `period − 1` steps (its loop starts at 2, so never 0) so the 020 fallback output is unchanged (R1) in `src/Clutch.API/Domain/Mortgages/PeriodBalances.cs`

**Checkpoint**: `dotnet test --filter "FullyQualifiedName~RepaymentDates|FullyQualifiedName~MortgageValidator|FullyQualifiedName~MortgageCreate|FullyQualifiedName~MortgageUpdate"`, the `MonthlyPeriods` fallback tests in `Unit/Mortgages/PeriodBalancesTests.cs`, and `npm test -- repaymentDates loanDraft InterestRateChangesDialog` pass. The `MortgagePeriods` unit tests and the mortgage-mode `period-balances` integration tests are expected to fail until US2 (T013–T016) rewrites them.

---

## Phase 3: User Story 1 - Each period shows its repayment date (Priority: P1) 🎯 MVP

**Goal**: Date column shows `formatDisplayDate(finalRepaymentDate(disbursalDate, k, frequency))` for Duration rows | **Independent Test**: Disbursal 29 Nov 2023, Monthly → rows 29 Dec 2023, 29 Jan 2024, 29 Feb 2024; Duration 360 → 360 rows, last 29 Nov 2053.

- [X] T010 [P] [US1] Component tests per UI contract: `aria-rowcount` = Duration + 1, row 1 "29 Dec 2023", row 360 "29 Nov 2053", 31 Jan clamp, Weekly/Fortnightly, dates follow form changes, fallback dates blank, a row dated past 31 Dec 9999 shows a blank Date (spec edge case), Date cells are read-only text and Bank Schedule still shows "Not yet calculated" (FR-003), no-account (SC-004), Date blank when `duration` is given without `disbursalDate` or `paymentFrequency` (UI contract); update the existing cases to the new row count (`aria-rowcount` 362 → 361, 522002 → 522001, 7 → 6, 14 → 13) and change the row-1 Date expectation from "Not yet calculated" in `src/clutch-web/src/features/mortgages/AmortizationSchedule.test.tsx`; update the unsaved-form row count (`aria-rowcount` 362 → 361) in `src/clutch-web/src/features/mortgages/MortgagesPage.test.tsx`
- [X] T011 [P] [US1] Component tests: account-linked schedule shows Duration rows with dates beside balances, `balances[k - 1]` mapping kept, rows after the last returned balance blank (FR-005), and a refused period balance request (old-rule mortgage past 31 Dec 9999) shows the existing balance error message beside the dates (spec edge case); the existing sign orientation, currency formatting and refresh-after-import/delete cases are kept and updated to the new row count (FR-006) in `src/clutch-web/src/features/mortgages/AmortizationScheduleAccount.test.tsx`
- [X] T012 [US1] Render Duration rows (not Duration + 1), fill Date cells with `formatDisplayDate` in default text colour (was `text-fg-secondary`), left aligned, computed only for the windowed (visible) rows; a `null` date (past 31 Dec 9999), or a missing `disbursalDate` or `paymentFrequency`, renders a blank cell; pass `disbursalDate` and `paymentFrequency` to `PlainSchedule` (both call sites: no account, and account not found) and into `ScheduleTable` from `PlainSchedule` and from `AccountSchedule`'s Details-complete table (UI contract); update the `AmortizationSchedule` doc comment "periods 1 to N + 1" to Duration rows, and the `disbursalDate`/`paymentFrequency` prop comment ("undefined for a new, unsaved mortgage") to say an unsaved mortgage passes the form's valid values; Bank Schedule unchanged in `src/clutch-web/src/features/mortgages/AmortizationSchedule.tsx`

**Checkpoint**: `npm test -- AmortizationSchedule LoanPayoffTimeline MortgagesPage` pass; `npm run typecheck` and `npm run lint` pass.

---

## Phase 4: User Story 2 - Account balance as at end of the period's date (Priority: P1)

**Goal**: `balances[k - 1]` is the last balance on or before D(k); first row on/after latest transaction shows it, later rows blank (FR-004, FR-005) | **Independent Test**: Account with transactions on, before and after period dates shows each row's end-of-day balance.

- [X] T013 [P] [US2] Unit tests per quickstart 3–5: 360 windows ending on each period date, period 1 `Start = DateOnly.MinValue`; lookup on-date (last by Id), previous-day, day-after ignored, before first → null; FR-005 latest between periods 3 and 4 (period 4 shows it, periods 5 onward omitted) and latest before period 1's date (period 1 shows it) in `tests/Clutch.API.Tests/Unit/Mortgages/PeriodBalancesTests.cs`
- [X] T014 [P] [US2] Integration tests: `periodCount` = duration, end-of-day balances, trailing nulls removed, ownership 404, sign orientation and fallback mode unchanged (FR-006), the endpoint's Duration limit at the new boundary with the T002 vectors (Disbursal 9999-12-10 Weekly: Duration 3 accepted, Duration 4 refused with 400 and the `duration` message; SEC-004, SC-006), and a mortgage saved under the old rule whose `F(disbursalDate, Duration)` now passes 31 Dec 9999 (seeded through the test fixture's EF Core DbContext, bypassing validation) refused with 400 and `duration`: "The final repayment date would be later than 31 Dec 9999" (spec edge case, FR-007) in `tests/Clutch.API.Tests/Integration/Mortgages/PeriodBalancesTests.cs`
- [X] T015 [US2] `MortgagePeriods` yields k = 1..Duration windows `(Start = D(k − 1) + 1 day, End = D(k))`, with period 1's `Start = DateOnly.MinValue` (D(0) is not a period date: `F(d, 0)` is `null`), per research R2; keep the 31 Dec 9999 guard as a defensive stop (when D(k) is `null`, `yield break` with no further windows; unreachable for validated input, R3), and rewrite its comment (period 1 starts on the Disbursal Date, Duration + 1 rows) to describe the new windows; `Lookup` unchanged in `src/Clutch.API/Domain/Mortgages/PeriodBalances.cs`
- [X] T016 [US2] Return `periodCount = duration` (was duration + 1) in `src/Clutch.API/Application/Mortgages/PeriodBalanceService.cs`

**Checkpoint**: `dotnet build` and `dotnet test --filter "FullyQualifiedName~Mortgages"` pass (Docker for Integration).

---

## Phase 5: Completion Gates

- [X] T017 Browser test: update row counts (both `aria-rowcount` 362 → 361 assertions for Duration 360, and 50 → 49 for Duration 48); add assertions for a dated row (e.g. "29 Dec 2023" for a 29 Nov 2023 Monthly mortgage) and for the Effective Date range message ending on `F(d, Duration)` (no range-message assertion exists today) in `src/clutch-web/e2e/mortgages.spec.ts`; run `npm run e2e` incl. `style-guide.spec.ts` (WEB-001)
- [X] T018 Independent security review of the full diff: OWASP Top 10 review, dependency vulnerability review (`dotnet list package --vulnerable --include-transitive`, `npm audit`; no new packages expected), auth/ownership unchanged, bounds enforced in both tiers without overflow, balances not logged or in errors; record findings and block completion until remediated (SEC-001, SEC-003, SEC-004, `clutch-security-review`)
- [X] T019 Validate the plan's UI compliance checklist in both themes with screenshots (WEB-001, `clutch-ui-style`)
- [X] T020 Run completion quality gates per quickstart (`dotnet build`, `dotnet test`, `npm run typecheck`, `lint`, `test`, `build`) and record results; confirm logging and metrics unchanged, no balance in logs, and the schedule still gives visible feedback within 500 ms (loading status); complete the Constitution Check completion review, including ARC-001 (only spec'd behaviour: Bank Schedule untouched, no unrequested refactor) (ENG-001, OPS-001, ARC-001, Perf & Observability, `clutch-constitution-check`, `clutch-dotnet-service` / `clutch-frontend`)
- [X] T021 Run `/speckit-converge` and complete any tasks it appends before declaring the feature complete (Workflow and Delivery Gates)

---

## Dependencies & Execution Order

- Foundational → US1 and US2 (either order or in parallel) → Completion Gates.
- T007 needs T001–T003 failing first; T008 needs T004–T006 failing first; T009 needs T007.
- T012 needs T008. T015 needs T007 and T009 (same file: do T009 first). T016 needs T015.
- T017, T018, T019 and T020 each need T012 and T016 (the full diff). T021 runs last, after T017–T020.

## Parallel Opportunities

- Foundational: T001–T006 together; then T007 and T008 together.
- US1: T010, T011.
- US2: T013, T014.
- US1 (web) and US2 (API) touch disjoint files and can run in parallel after Foundational.

## Implementation Strategy

MVP = Foundational + User Story 1 (dates visible with or without an account). Then User Story 2 aligns
balances to those dates. Each story must pass its own tests before the next starts.

---

## Phase 6: Convergence

- [X] T022 Review the two fixes outside the plan's file list (`src/clutch-web/src/features/mortgages/LoanDetailsForm.tsx` type import and lint fix; `src/clutch-web/e2e/mortgages.spec.ts` opening-rate-first entry order), both pre-existing 021 breaks that blocked the T017/T020 gates: keep them in this change with the reason recorded, or move them to a separate change per ARC-001 (unrequested)
