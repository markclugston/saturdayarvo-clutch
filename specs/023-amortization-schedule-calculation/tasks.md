---

description: "Task list for 023-amortization-schedule-calculation"
---

# Tasks: Amortization Schedule Calculation

**Input**: `specs/023-amortization-schedule-calculation/` (plan.md, spec.md, research.md, data-model.md, contracts/amortization-schedule-ui.md, quickstart.md)

**Tests**: REQUIRED. ENG-001 makes every behaviour change an explicit request for tests. Write
tests first and confirm they fail before implementing.

## Format: `- [ ] T### [P?] [US#?] Description with exact file path`

- **[P]**: parallel-safe (different files, no dependency). **[US#]**: user story label.
- Paths are relative to `src/clutch-web/` and follow the nearest existing sibling file (`docs/code-map.md`).
- `M` = the `src/features/mortgages/` folder.

No Setup phase: no new package, config, endpoint or schema (plan.md).

## Phase 2: Foundational (blocks all stories)

- [X] T001 [P] Tests for `daysBetween(from, to)`: whole UTC days `to − from` (29 Dec 2023 → 29 Jan 2024 = 31, leap day, same day = 0, year < 100) in `M/repaymentDates.test.ts`
- [X] T002 [P] Tests for `scheduleInputs(draft, today)`: valid draft → `ScheduleInputs` (cents parsed from the decimal string without float multiply, `rateChanges` sorted by date, empty rows skipped); null for any `validateDraft` error except `name`; invalid Name alone → inputs (FR-002, R5) in `M/loanDraft.test.ts`
- [X] T003 Export `daysBetween` using the existing `utcMilliseconds` (never `new Date(string)`, R3) in `M/repaymentDates.ts`
- [X] T004 New module with the `ScheduleInputs` and `ScheduledPeriod` types exactly per contract and a `calculateSchedule` stub returning `null` in `M/scheduleCalculation.ts`
- [X] T005 Implement `scheduleInputs(draft, today): ScheduleInputs | null` per data-model.md ScheduleInputs ("integer > 0", "≤ 99,999,999,999,999 cents", "duration integer ≥ 1", "rates 0–100, ≤ 2 dp" via `validateDraft`) in `M/loanDraft.ts`

**Checkpoint**: `npx vitest run M/repaymentDates.test.ts M/loanDraft.test.ts`, `npm run typecheck` pass.

---

## Phase 3: User Story 1 - Calculated bank schedule balance per period (Priority: P1) 🎯 MVP

**Goal**: Each row's Bank Schedule cell shows the single-rate level P&I closing balance from the Details on screen | **Independent Test**: $500,000.00, 360 Monthly, 6.00% → P1 $499,502.25, P2 $499,002.01, P360 $0.00.

- [X] T006 [P] [US1] Unit tests per quickstart 1: spec example (repayment 299775, interest 250000, P1 49950225, P2 49900201, P360 0, final repayment 300044); Weekly/Fortnightly (÷52/÷26, last 0); 0% equal repayments; Duration 1; 100% rate; half-away-from-zero rounding; $1.80/360/0% early repayment stops at 0, never negative (FR-007); invariants SC-001 (last = 0, all ≥ 0, non-increasing) and closing = opening + interest − repayment; dates match `finalRepaymentDate`; unparseable/non-finite → null (R4); 1,560 Weekly periods < 500 ms (SC-004) in `M/scheduleCalculation.test.ts`
- [X] T007 [P] [US1] Tests: `onCalculationInputsChange` emits inputs for a valid draft (incl. a clean saved mortgage's saved values), `undefined` when any calculation input is invalid, inputs when only Name is invalid in `M/LoanDetailsForm.test.tsx`
- [X] T008 [P] [US1] Tests: `schedule` prop → Bank Schedule cell k = `formatCurrency(closingCents k)`, right aligned `tabular-nums`, default text colour; absent → "Not yet calculated"; Period/Date/`aria-rowcount`/windowing unchanged (FR-009) in `M/AmortizationSchedule.test.tsx`
- [X] T009 [P] [US1] Tests: account-linked table shows Bank Schedule and Actual Balance side by side, Actual Balance values and fallback monthly view unchanged (FR-009, SC-006) in `M/AmortizationScheduleAccount.test.tsx`
- [X] T010 [P] [US1] Tests: `calculation` prop → schedule calculated once (memoised) and passed to the table; rows/dates follow `calculation`'s Duration, Disbursal Date, Frequency (R6) in `M/LoanPayoffTimeline.test.tsx`
- [X] T011 [P] [US1] Tests: saved mortgage shows calculated balances; editing Opening Balance/Duration updates them without saving; invalid edit on a saved mortgage → "Not yet calculated" (no saved fallback); invalid Name keeps values; unsaved valid form shows values in `M/MortgagesPage.test.tsx`
- [X] T012 [US1] Implement `calculateSchedule` single forward pass per research R1–R2 (integer cents, `Math.sign(x) * Math.round(Math.abs(x))`, level repayment round(B·r ÷ (1 − (1 + r)^−n)), r = 0 → round(B ÷ n), period 1 at the Disbursal Date's rate, each repayment capped at opening + interest, last repayment = opening + interest, null on any non-finite value, never throws) in `M/scheduleCalculation.ts`
- [X] T013 [US1] Add `onCalculationInputsChange?: (inputs: ScheduleInputs | undefined) => void` emitted beside `onScheduleChange` on every draft change via `scheduleInputs(draft, today) ?? undefined` (R5) in `M/LoanDetailsForm.tsx`
- [X] T014 [US1] Hold the emitted inputs in state and pass `calculation` to `LoanPayoffTimeline`; while valid, its Duration, Disbursal Date and Frequency replace the saved ones (R6); invalid keeps today's rule in `M/MortgagesPage.tsx`
- [X] T015 [US1] Add `calculation?: ScheduleInputs`; `useMemo(() => calculation && calculateSchedule(calculation))`; pass `schedule` (undefined when null) to `AmortizationSchedule` in `M/LoanPayoffTimeline.tsx`
- [X] T016 [US1] Add `schedule?: ScheduledPeriod[]`; Bank Schedule cell shows `formatCurrency` (takes a 2dp string) of `schedule[k − 1].closingCents` converted by integer division, e.g. 49950225 → `"499502.25"` (R8) for windowed rows, else `NOT_CALCULATED`; plain and account tables both; fallback view unchanged in `M/AmortizationSchedule.tsx`

**Checkpoint**: `npx vitest run src/features/mortgages`, `npm run typecheck`, `npm run lint` pass.

---

## Phase 4: User Story 2 - Interest rate changes take effect by date (Priority: P1)

**Goal**: Rates apply from their Effective Date, blended by days within a period, repayment recalculated from the first period wholly at a new rate | **Independent Test**: 6.00% → 5.50% part-way: earlier periods at 6.00%, the containing period blended, later periods recalculated, last balance $0.00.

- [X] T017 [P] [US2] Unit tests per quickstart 1 and spec US2: 6.00% → 5.50% on period 24's date (P1–24 at 6.00%, P25 repayment recalculated over 336 from P24's closing); 29 Dec 2023–29 Jan 2024 with 5.00% on 8 Jan 2024 = round(opening × (0.06/12 × 10/31 + 0.05/12 × 21/31)); two changes in one period (three segments); change inside period 1 (P1 repayment at the Disbursal Date's rate, P1 interest blended, recalculated from P2, FR-006); change on final date unaffected; mid-period rise above kept repayment → balance rises, next period recalculated (FR-006); SC-003 interest check over all periods; last = 0 in `M/scheduleCalculation.test.ts`
- [X] T018 [P] [US2] Tests: adding, editing and removing a rate change in the dialog updates Bank Schedule values without saving (US2 scenario 4) in `M/MortgagesPage.test.tsx`
- [X] T019 [US2] Segment each period's days [start, end) by sorted `rateChanges` via `daysBetween`; weighted periodic rate Σ (rateᵢ ÷ 100 ÷ periods per year) × daysᵢ ÷ period days (FR-005); recalculate repayment only at the first period accruing wholly at a rate that took effect after the current repayment's period began (FR-006, R1, R3) in `M/scheduleCalculation.ts`

**Checkpoint**: `npx vitest run src/features/mortgages` passes.

---

## Phase 5: User Story 3 - Burndown chart plots the bank schedule (Priority: P2)

**Goal**: The Burndown draws the "Bank Schedule" line from the Opening Balance at the Disbursal Date to $0.00 on the final date | **Independent Test**: Valid Details → line has a point at the Disbursal Date and one per period date, last at $0.00; text alternative states the values.

- [X] T020 [P] [US3] Tests: with `schedule`, `openingBalanceCents`, `disbursalDate` → one `polyline` with Duration + 1 points (SC-005: point k's y matches closing k), Y ticks `$0`, `$125K`, `$250K`, `$375K`, `$500K` for $500,000.00 (R7), X year ticks, legend "Bank Schedule", `role="img"` with R7 `aria-label`, message removed; without → today's message and enter-details prompt unchanged in `M/BurnDownChart.test.tsx`
- [X] T021 [P] [US3] Tests: Burndown view receives the same memoised schedule as the table and redraws when `calculation` changes; invalid → existing message in `M/LoanPayoffTimeline.test.tsx`
- [X] T022 [US3] Draw the series per research R7 in the existing SVG (viewBox 600 × 300, plot x 70–580, y 30–260): `polyline` `text-primary` stroke `currentColor`, x linear in days, Y max = smallest 1/2/2.5/5 × 10ⁿ ≥ highest balance, split into 4 equal intervals (R7), compact `$` Y labels, ≤ 5 year X ticks in `text-fg-secondary`, R7 `aria-label`; no raw colours, no animation in `M/BurnDownChart.tsx`
- [X] T023 [US3] Pass `schedule`, `calculation.openingBalanceCents` and `calculation.disbursalDate` to `BurnDownChart` in `M/LoanPayoffTimeline.tsx`

**Checkpoint**: `npx vitest run src/features/mortgages`, `npm run lint` pass.

---

## Phase 6: Completion Gates

- [X] T024 Browser journeys: saved mortgage shows $499,502.25 / $0.00; a rate change edit updates values without saving; invalid edit shows "Not yet calculated"; Burndown shows a plotted line with its `aria-label`; axe passes in `e2e/mortgages.spec.ts` (WEB-001)
- [X] T025 Style guide: Burndown with a plotted line in light and dark themes; update snapshots in `e2e/style-guide.spec.ts` and `e2e/style-guide.spec.ts-snapshots/` (WEB-001)
- [X] T026 Independent security review of the full diff: OWASP Top 10, `npm audit` (no new packages), balances never logged, stored, sent or put in error text, calculation failure shows only "Not yet calculated" (SEC-001, SEC-003, SEC-004, `clutch-security-review`) — Reviewed 2026-11-23: no Critical/High/Medium findings. Client-only change (no endpoint, auth, server, config or dependency change; `npm audit` 0 vulnerabilities); no logging, storage, network call, HTML injection or secrets in the diff; SVG text and `aria-label` are escaped by React; inputs consumed only after `validateDraft`, failures show only "Not yet calculated". LOW, accepted: a 520,000-period weekly Duration (year 2 to 9999) calculates in about 0.5 s and plots 520,001 points (self-inflicted slowness only; SC-005 needs every point).
- [X] T027 Validate the plan's UI compliance checklist in both themes with screenshots (WEB-001, `clutch-ui-style`)
- [X] T028 Run completion quality gates per quickstart 4 (`npm run lint`, `typecheck`, `test`, `test:e2e`, `test:e2e:style-guide`, `build`), record results incl. the SC-004 timing test; complete the Constitution Check review incl. ARC-001 (no extra columns, no server calculation) (ENG-001, Perf & Observability, `clutch-constitution-check`, `clutch-frontend`)
- [X] T029 Run `/speckit-converge` and complete any tasks it appends before declaring the feature complete (Workflow and Delivery Gates)

---

## Dependencies & Execution Order

- Foundational → US1 → US2 and US3 (either order or in parallel) → Completion Gates.
- T003 needs T001 failing; T005 needs T002 failing and T004. T012 needs T004, T006 failing. T013 needs T005, T007.
- T014 needs T013. T015 needs T012, T014. T016 needs T008, T009 failing. T019 needs T003, T012, T017 failing.
- T022 needs T020 failing; T023 needs T015, T022 (same file as T015: do T015 first). T021 shares a file with T010.
- T024–T028 need T016, T019, T023. T029 runs last.

## Parallel Opportunities

- Foundational: T001, T002; then T003, T004.
- US1: T006–T011 together; then T012 alongside T013.
- US2: T017, T018. US3: T020 (T021 after T010). US2 and US3 run in parallel after US1 (T019 vs T022 touch different files).
- Gates: T024–T027 together.

## Implementation Strategy

MVP = Foundational + User Story 1 (single-rate balances in the table, live with the form). Then US2
makes rate changes correct, and US3 draws the same schedule on the Burndown. Each story must pass its
own tests before the next starts.

## Phase 7: Convergence

- [X] T030 CRITICAL: Run the independent OWASP Top 10 / secrets / data-exposure review of the full diff with `clutch-security-review` (only a pattern scan and `npm audit`, 0 vulnerabilities, were done) and record the result per Constitution SEC-001, SEC-003 and T026 (missing) — Reviewed 2026-11-23: no Critical/High/Medium findings. Client-only change (no endpoint, auth, server, config or dependency change; `npm audit` 0 vulnerabilities); no logging, storage, network call, HTML injection or secrets in the diff; SVG text and `aria-label` are escaped by React; inputs consumed only after `validateDraft`, failures show only "Not yet calculated". LOW, accepted: a 520,000-period weekly Duration (year 2 to 9999) calculates in about 0.5 s and plots 520,001 points (self-inflicted slowness only; SC-005 needs every point).
- [X] T031 Make the Burndown style-guide screenshots show the plotted Bank Schedule line in both themes: the baselines in `e2e/style-guide.spec.ts-snapshots/mortgages-timeline-burndown-*` still pass within the 2% tolerance but are stale (old labels) and clipped above the line, so scroll or crop to the chart, then regenerate with `--update-snapshots` per T025, US3/AC1, WEB-001 (partial)
- [X] T032 Tick the plan's UI compliance checklist (plan.md) against those screenshots in light and dark, and record the T028 gate results (lint, typecheck, 631 unit tests, test:e2e 42, mortgages integration 4, style-guide 188, build, SC-004 timing test) per T027, T028 (partial)

