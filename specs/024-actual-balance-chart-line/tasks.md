---

description: "Tasks for 024-actual-balance-chart-line"
---

# Tasks: Actual Balance Chart Line

**Input**: `specs/024-actual-balance-chart-line/` (plan.md, spec.md, research.md, data-model.md, contracts/burndown-chart-ui.md, quickstart.md)

**Tests**: REQUIRED. ENG-001 makes every behaviour change an explicit request for tests. Write
tests first and confirm they fail before implementing.

## Format: `- [ ] T### [P?] [US#?] Description with exact file path`

- **[P]**: parallel-safe (different files, no dependency). **[US#]**: user story label.
- All paths are relative to `src/clutch-web/`.

## Phase 1: Setup

None: no package, config or Playwright change.

## Phase 2: Foundational (blocks all stories)

- [X] T001 Unit tests in `src/features/mortgages/actualBalances.test.ts` for `actualBalancePoints` (blanks skipped, no Disbursal Date point, trailing blanks, negative and large values passed through unchanged, schedule dates) per data-model.md ActualBalancePoint, and for `useActualBalances` status (`none` with no account or an account missing from the accounts list, `loading`, `failed`, `ready`), `currencyCode` fallback to the account's code, and the request key matching the table's per data-model.md ActualBalances
- [X] T002 Create `src/features/mortgages/actualBalances.ts`: pure `actualBalancePoints(balances, schedule)` returning `{ date, amount, value }` per R2, plus `ActualBalancePoint` type
- [X] T003 Add `useActualBalances(accountId, scheduleParams)` to `src/features/mortgages/actualBalances.ts`, moving the account lookup and `usePeriodBalances` call out of `AccountSchedule`; result `status`/`balances`/`currencyCode`/`periodCount` per data-model.md ActualBalances (R1)
- [X] T004 Refactor `AccountSchedule` in `src/features/mortgages/AmortizationSchedule.tsx` to use `useActualBalances`; column output, loading and error text unchanged
- [X] T005 Run `npx vitest run src/features/mortgages/AmortizationSchedule.test.tsx src/features/mortgages/AmortizationScheduleAccount.test.tsx`; fix only refactor breakage, no expectation changes

**Checkpoint**: `npm run typecheck` + `npx vitest run src/features/mortgages` pass.

---

## Phase 3: User Story 1 - See the actual balance against the bank schedule (Priority: P1) 🎯 MVP

**Goal**: The Burndown plots a dashed `chart-navy` Actual Balance series on top of the Bank Schedule line. | **Independent Test**: With a linked account carrying balances, the chart shows a dashed line through each non-blank Actual Balance at its row's date, named in the legend.

- [X] T006 [P] [US1] Component tests in `src/features/mortgages/BurnDownChart.test.tsx` for every row of contracts/burndown-chart-ui.md "Rendered output": no account (SVG + label identical to 023), loading/failed (no line, no message, legend both), account missing from the accounts list (as no account), ready 0/1/≥2 points, polyline order and classes. "Identical to 023" means identical markup except the Bank Schedule polyline and legend group class `text-primary` → `text-chart-primary` (same rendered colour)
- [X] T007 [US1] Component tests in `src/features/mortgages/BurnDownChart.test.tsx` for BalanceAxis (data-model.md): top above Opening Balance, negative extends below $0 with labelled $0 tick and `-$…` labels, guides aligned with every tick when negative, every point of both series inside the plot (SC-005), Bank Schedule not plotted → no Actual Balance line or legend (FR-005)
- [X] T008 [US1] SC-004 timing test in `src/features/mortgages/BurnDownChart.test.tsx`: 1,560 periods with balances render within 500 ms (R6)
- [X] T009 [P] [US1] Test in `src/features/mortgages/LoanPayoffTimeline.test.tsx` that `BurnDownChart` gets `accountId`, `duration` and `paymentFrequency` and shows the Actual Balance line with a linked account
- [X] T010 [US1] Add `accountId`, `duration`, `paymentFrequency` props and call `useActualBalances` + `actualBalancePoints` in one `useMemo` in `src/features/mortgages/BurnDownChart.tsx` (contract Props, R1, R6)
- [X] T011 [US1] Balance axis `upper`/`lower`/`ticks`/`y`/guides per R3 and data-model.md BalanceAxis in `src/features/mortgages/BurnDownChart.tsx` (both series use the shared `y`); with no Actual Balance points the axis output is identical to today (SC-002); negative tick labels `-$…`
- [X] T012 [US1] Draw Actual Balance in `src/features/mortgages/BurnDownChart.tsx` per R4: dashed `6 4` stroke 2 `text-chart-navy` polyline after Bank Schedule, or single `<circle r="3">` fill `currentColor`; Bank Schedule polyline and legend group `text-primary` → `text-chart-primary`
- [X] T013 [US1] Legend in `src/features/mortgages/BurnDownChart.tsx` per contract: with account, Bank Schedule x 270–294/label 300, dashed Actual Balance sample x 400–424/label 430; without, unchanged (FR-004)
- [X] T014 [US1] Text alternative suffixes per contract (0/1/≥2 points, none while loading/failed) using `formatCurrencyAmount` and `formatDisplayDate` in `src/features/mortgages/BurnDownChart.tsx` (FR-007, R5)
- [X] T015 [US1] Pass `accountId` and the valid calculation's `duration` and `paymentFrequency` to `BurnDownChart` in `src/features/mortgages/LoanPayoffTimeline.tsx`

**Checkpoint**: `npx vitest run src/features/mortgages` passes; `npm run lint` clean (`clutch/style-tokens`).

---

## Phase 4: User Story 2 - The line stays current (Priority: P2)

**Goal**: The line follows the account selection, Details and transaction changes without reload. | **Independent Test**: Change account, choose None, invalidate period balances and edit a Detail; the line matches the column each time.

- [X] T016 [US2] Tests in `src/features/mortgages/MortgagesPage.test.tsx`: picking another account (saved or not) redraws the line; "None" removes line and legend entry (FR-008, US2 AS-1)
- [X] T017 [US2] Tests in `src/features/mortgages/MortgagesPage.test.tsx`: invalidating `periodBalancesQueryKey` (import/delete) updates the line without reload; editing a Detail redraws both lines (US2 AS-2, AS-3)
- [X] T018 [US2] Fix any gap the T016–T017 tests expose in `src/features/mortgages/BurnDownChart.tsx` or `src/features/mortgages/LoanPayoffTimeline.tsx` (expected none: shared query key per R1)

**Checkpoint**: `npx vitest run src/features/mortgages` passes.

---

## Phase 5: Completion Gates

- [X] T019 [P] Browser test in `e2e/mortgages.spec.ts`: mortgage with linked account shows both lines and both legend entries; without account only Bank Schedule (WEB-001)
- [X] T020 [P] Style-guide test in `e2e/style-guide.spec.ts`: two-line Burndown screenshot (`mortgages-burndown-actual-{theme}.png`) in Light and Dark and at 320 px, axe passes (System resolves to Light or Dark, so these two cover SC-003's three themes); update snapshots in `e2e/style-guide.spec.ts-snapshots/`
- [X] T021 Independent security review of the full diff: OWASP Top 10 review, dependency vulnerability review (`npm audit`; confirm no package change), owner-scoped balances only, no logging or error text of amounts (SEC-001, SEC-003, `clutch-security-review`)
- [X] T022 Validate plan.md UI compliance checklist in both themes and tick it (WEB-001, `clutch-ui-style`)
- [X] T023 Run quickstart.md §4 gates (`npm run lint`, `typecheck`, `test`, `test:e2e`, `test:e2e:style-guide`, `build`) and record results (ENG-001, `clutch-frontend`)
- [X] T024 Add a row to `docs/code-map.md`: "Mortgage Actual Balance values shared by the schedule column and the Burndown chart" → `src/clutch-web/src/features/mortgages/actualBalances.ts`
- [X] T025 Run `/speckit-converge` and complete any tasks it appends before declaring the feature complete (Workflow and Delivery Gates)

---

## Dependencies & Execution Order

- Foundational (T001–T005) → US1 → US2 → Completion Gates.
- T002 and T003 need T001 failing; T004 needs T003; T010 needs T003; T011–T014 are sequential edits of `BurnDownChart.tsx` after T010.
- US2 relies on US1's chart wiring (T010, T015).
- T020 needs T012–T013 for the final visuals.
- T025 runs last, after T019–T024.

## Parallel Opportunities

- US1: T006–T008 (one file, sequential) alongside T009
- US2: T016 and T017 share `MortgagesPage.test.tsx`, so write them in sequence
- Gates: T019, T020

## Implementation Strategy

MVP = User Story 1. Deliver stories incrementally; each must pass its own tests before the next starts.
