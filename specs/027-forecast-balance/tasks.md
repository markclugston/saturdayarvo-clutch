# Tasks: Forecast Balance

**Input**: `specs/027-forecast-balance/` (plan.md, spec.md, research.md, data-model.md, quickstart.md, contracts/forecast-balance-ui.md)

**Tests**: REQUIRED. ENG-001 makes every behaviour change an explicit request for tests. Write
tests first; confirm unit, component and lint-rule tests fail before implementing. Browser tests
(T007, T016–T018) first run in the completion gates.

## Format: `- [ ] T### [P?] [US#?] Description with exact file path`

- **[P]**: parallel-safe (different files, no dependency). **[US#]**: user story label.
- Run commands from `src/clutch-web`. After each task: `npx vitest related <changed files> --run --reporter=dot`.
- No .NET, endpoint, schema or package change (plan.md).

## Phase 1: Setup (blocks all stories)

- [X] T001 (Withdrawn: see Checkpoint note) Confirm the "Fix Burndown chart contrast and style guide" fix is merged into the branch being implemented (`main`, or `027-forecast-balance` if created; `specs/027-forecast-balance/plan.md` Open Issues); if not, STOP and tell the user
  - Evidence: `npx playwright test --config playwright.style-guide.config.ts -g "burndown" --reporter=line` passes on `src/clutch-web/e2e/style-guide.spec.ts` before any change
  - Evidence (Open Issue 2): §5 in `.claude/skills/clutch-ui-style/references/forms-components.md` matches the gradients and fill opacities in `BurnDownChart.tsx`
- [X] T002 (Withdrawn: see Checkpoint note) Recheck research.md R4–R5 against the fixed chart; update `specs/027-forecast-balance/research.md` and `contracts/forecast-balance-ui.md` to reuse the fix's casing and paint order
  - Gate (R5): each forecast gradient step has contrast ≥ 3:1 on the card and OKLab distance ≥ 0.10 from both series at the same gradient level and from the danger, warning, success and info tokens; record any replaced colour in R5
  - Gate: the fixed §5 permits the forecast fill opacity 0.25 (R4); if it does not, STOP and tell the user. Keep line-to-line crossings outside the contrast measure (FR-010)

**Checkpoint**: dependency merged, colours and contract confirmed.

**Override (user decision, 2026-11-26)**: User Story 1 (T003–T010) was implemented before the dependency
merged. T001 and T002 stay open and still block User Story 2.

**Override (user decision, 2026-11-26)**: User Story 2 was then requested and implemented on `main`, still
without the dependency. The forecast casing and its paint order use the names the unmerged fix plans
(research.md R4). T001 stays open. T002 stays open until its recheck is repeated on the merged chart.

**Withdrawn (user decision, 2026-11-26)**: the dependency fix will not be merged (research.md R13). T001 and
T002 are closed without being performed.

---

## Phase 2: User Story 1 - Forecast the Remaining Balance (Priority: P1) 🎯 MVP

**Goal**: A "Forecast Balance" column in the Amortization Schedule projects the balance by the median recent reduction.

**Independent Test**: Link an account with known balances; each Forecast Balance cell equals the hand-calculated value, ending at the first zero.

### Tests

- [X] T003 [P] [US1] Unit tests for `forecastBalances` (all cases in the quickstart.md "Values" row, including still above zero at the final row, negative and zero reductions counted, blank pairs excluded, balances beyond `rowCount` ignored, and mostly repeated balances giving no forecast; US1 scenarios 1–4, 7) in new `src/clutch-web/src/features/mortgages/forecastBalances.test.ts`
- [X] T004 [P] [US1] Test the hook's `forecast`: values when ready; empty when none, loading, failed or Details incomplete, in `src/clutch-web/src/features/mortgages/actualBalances.test.ts`
- [X] T005 [P] [US1] Component tests per contract "Amortization Schedule" in `src/clutch-web/src/features/mortgages/AmortizationScheduleAccount.test.tsx`
  - Header order; right aligned `tabular-nums`; one `$0.00` then blanks; blank on actual rows and before, while loading, failed, fallback and no data; shown without a Bank Schedule (FR-007a)
  - Absent without an account; table `min-w-140` only with the column; 1,560 periods forecast within 500 ms (SC-003); add the new header and cell to existing header and row expectations
- [X] T006 [P] [US1] Test forecast cells recalculate on balances invalidation, account change and a Duration, Payment Frequency or Disbursal Date edit, with no request beyond those Actual Balance already makes (FR-008, FR-008a), in `src/clutch-web/src/features/mortgages/MortgagesPage.test.tsx`
- [X] T007 [P] [US1] Linked-account journey: change `importBalanceStatement` balances to `1000.00` then `900.00`; expect header "Forecast Balance" after "Actual Balance", rows 1–2 blank, row 3 `$800.00`, row 11 `$0.00` and row 12 blank; update the `$1,020.00` assertion to `$900.00`; unlinked stays 3 columns, in `src/clutch-web/e2e/mortgages.spec.ts`

### Implementation

- [X] T008 [US1] Create pure `forecastBalances(balances, frequency, rowCount): (string | null)[]` in `src/clutch-web/src/features/mortgages/forecastBalances.ts`, `BigInt` minor units per research.md R2–R3
  - Inputs: `balances` "index i is period i + 1; null or missing is blank"; `frequency` "window of 12, 26 or 52 reductions"; `rowCount` "later balances are ignored and no row is added"
  - Output: "indexed like `balances`; a decimal string on forecast rows, otherwise null. Empty when there is no forecast." Scale: "the longest fraction among the balances used"
  - Rule 1: "`last` = the last non-blank row within `rowCount`." Rule 2: "Reduction at row i = balance(i − 1) − balance(i), only when both are non-blank. Period 1 has none."
  - Rule 3: "Window = the newest reductions up to `last`, at most 12 / 26 / 52." Rule 4: "median of the window; even count: mean of the two middle values rounded half up to the minor unit."
  - Rule 5: "Rows after `last`: previous value (first: balance(`last`)) minus the reduction. The first result ≤ 0 is `0` (at the balance scale) and ends the output; otherwise it ends at `rowCount`."
  - Empty output: "No non-blank balance · no reduction (including a single balance) · reduction ≤ 0 · `last` is the final row."
- [X] T009 [US1] Add `forecast` to `ActualBalances` ("empty unless status is `ready` and Details are complete"), in `src/clutch-web/src/features/mortgages/actualBalances.ts`
  - `useMemo` on balances data, frequency and duration (R1), called before the hook's early returns; `rowCount` is `duration`
- [X] T010 [US1] Show the "Forecast Balance" column right of Actual Balance whenever that column is shown, in `src/clutch-web/src/features/mortgages/AmortizationSchedule.tsx`
  - Cell: `formatCurrencyAmount(value, currencyCode)` or empty, from `actual.forecast`, styled like Actual Balance; five grid columns and `min-w-140` with it (R7); no change without an account

**Checkpoint**: `npm run lint`, `npm run typecheck`, `npm test -- --reporter=dot` pass; column works on its own.

---

## Phase 3: User Story 2 - See the Forecast on the Chart (Priority: P2)

**Goal**: The Burndown draws Forecast Balance as a dashed line and soft area in a new colour scheme, continuing from Actual Balance.

**Independent Test**: Open the Burndown for a mortgage with forecast values; the new series passes through every Forecast Balance at its row's date.

### Tests

- [X] T011 [P] [US2] Add valid `text-chart-forecast-start/-mid/-end` and invalid `dark:` variants of each to `src/clutch-web/eslint-rules/clutch-style.test.js`
- [X] T012 [P] [US2] New forecast series tests per contract "Burndown SVG" and "Paint order" (FR-009 to FR-011) in `src/clutch-web/src/features/mortgages/BurnDownChart.test.tsx`
  - Vertices from the last Actual point through every forecast row; inside the plot; axis unchanged; casing present; 1,560 periods with most rows forecast within 500 ms (SC-003)
- [X] T013 [US2] Tests for legend (R6 positions), hover label, rings, announcement and text alternative per contract "Text" (FR-012, FR-013) in `src/clutch-web/src/features/mortgages/BurnDownChart.test.tsx`
  - Each hovered amount equals the formatted forecast value (SC-002); without forecast values, or without a Bank Schedule, output is as before (US2 scenario 5)
- [X] T014 [US2] Update existing tests whose balances now produce a forecast (line, ring and label counts, legend positions, text alternative) in `src/clutch-web/src/features/mortgages/BurnDownChart.test.tsx`
- [X] T015 [P] [US2] Update the series line count, now that its balances produce a forecast, in `src/clutch-web/src/features/mortgages/LoanPayoffTimeline.test.tsx`
- [X] T016 [P] [US2] Add a forecast mock (120 balances of `500000 - period * 2000`, so the forecast starts at row 121, reaches `$0.00` at row 250 and is blank from row 251) and states `mortgages-burndown-forecast`, `mortgages-schedule-forecast` in `src/clutch-web/e2e/style-guide.spec.ts`
  - Keep `actualBalancesFixture` output unchanged for the existing states and baselines
  - `mortgages-schedule-forecast` scrolls to forecast rows before its checks run
- [X] T017 [US2] Add per-theme "forecast contrast and distinct colours" test (T002 gate, series compared at the same gradient level; casing on line and ring; dashed line and legend sample; SC-004) in `src/clutch-web/e2e/style-guide.spec.ts`
- [X] T018 [US2] Add per-theme "forecast" screenshot tests: chart, hover label with axe, table, and both at 320 px with no page sideways scroll, in `src/clutch-web/e2e/style-guide.spec.ts`
  - At 320 px, table: scroll the "Forecast Balance" header and a forecast cell into view in the content panel; both in the viewport, unclipped (`scrollWidth <= clientWidth`) and not overlapping "Actual Balance" (contract "Amortization Schedule")
  - At 320 px, chart: forecast line, area and legend inside the SVG box, legend entries not overlapping, hover label inside the chart
  - Table state and screenshots: scroll the content panel to the first forecast row (121) before the axe check and one screenshot, then to rows 249–251 for another, showing the last positive value, `$0.00` and a blank cell

### Implementation

- [X] T019 [US2] Add `chart-forecast-start`, `-mid`, `-end` to `TOKEN_COLOURS` in `src/clutch-web/eslint-rules/clutch-style.js`
- [X] T020 [P] [US2] Add `--chart-forecast-start/-mid/-end` in both themes (research.md R5 as confirmed by T002) and `--color-chart-forecast-*` mappings in `src/clutch-web/src/index.css`
- [X] T021 [US2] Rename `ActualBalancePoint` → `BalancePoint` and `actualBalancePoints` → `balancePoints` in `src/clutch-web/src/features/mortgages/actualBalances.ts`, `actualBalances.test.ts` and `BurnDownChart.tsx`
- [X] T022 [US2] Build forecast points from `balances.forecast` and add `PlottedDate.forecast`, `Plot.forecastLine`/`forecastArea` in `src/clutch-web/src/features/mortgages/BurnDownChart.tsx`
  - "never at the Disbursal Date or on an Actual Balance row"; line and area "both starting at the last Actual Balance point; empty without forecast points"; only when the Bank Schedule is plotted
- [X] T023 [US2] Draw the forecast gradient, faded area (opacity 0.25), casing, dashed line and legend entry per contract and R4, R6 in `src/clutch-web/src/features/mortgages/BurnDownChart.tsx`
  - Paths and paint order per contract "Paths" and "Paint order". Extend the casing from the merged fix, not a second pattern; write the three `text-chart-forecast-*` class names literally (Tailwind cannot generate them from a template string)
- [X] T024 [US2] Add forecast ring and ring casing, label and announcement row, label position and text alternative sentence per contract "Text" in `src/clutch-web/src/features/mortgages/BurnDownChart.tsx`

**Checkpoint**: `npm run lint`, `npm run typecheck`, `npm test -- --reporter=dot` pass.

---

## Phase 4: Completion Gates

- [X] T025 [P] Add the forecast series to §5 in `.claude/skills/clutch-ui-style/references/forms-components.md`, then run `.\scripts\sync-agent-config.ps1 -From claude` from the repository root
- [X] T026 [P] Add a `forecastBalances.ts` pointer to `docs/code-map.md`
- [X] T027 Generate forecast baselines for `src/clutch-web/e2e/style-guide.spec.ts` with `-g "forecast" --update-snapshots`, review the images, rerun without the flag
  - Use `playwright.style-guide.config.ts`; existing burndown baselines must pass unchanged
- [X] T028 Independent security review of the full diff, mainly `src/clutch-web/` (SEC-001..003, `clutch-security-review`); fix and verify findings
  - Confirm forecast values are not logged, stored or sent (SEC-003)
- [X] T030 Run the completion gates in `specs/027-forecast-balance/quickstart.md` (also `npm run lint`, `typecheck`, `test`); record results in the ENG-001, SEC-003 and Performance & Observability rows of plan.md Constitution Check
  - Style-guide, mocked and integration Playwright, `npm run build`, `npm audit --omit=dev`; report every failed or blocked check
  - 2026-11-26: all gates run and recorded. The one failing integration journey, a test fault in `import-settings.spec.ts` outside this feature, is fixed; the integration suite then passed 36 of 36
- [X] T029 Validate the UI compliance checklist in `specs/027-forecast-balance/plan.md` in both themes, including screenshots (WEB-001, `clutch-ui-style`); record the result in the WEB-001 row
- [X] T031 Run `/speckit-converge` and complete any tasks it appends to `specs/027-forecast-balance/tasks.md` before declaring the feature complete (Workflow and Delivery Gates)

---

## Phase 5: Revision After Review (2026-11-26)

Replaces the dashed line, casing and colours of T012–T013, T017 and T020–T024 (research.md R9).

- [X] T032 [US2] Component tests first in `src/clutch-web/src/features/mortgages/BurnDownChart.test.tsx`: solid line and legend sample, no card-coloured outline, gradient over the forecast, no gap between the areas; confirm they fail
- [X] T033 [US2] Solid line and legend sample, remove the casings and fix the seam in `src/clutch-web/src/features/mortgages/BurnDownChart.tsx`; red, orange and yellow tokens in `src/clutch-web/src/index.css`
- [X] T034 [US2] Remove the casing and dash checks from `src/clutch-web/e2e/style-guide.spec.ts`, keeping the contrast and distinct colour checks, and update the forecast screenshots
- [X] T035 [US2] CRITICAL: resolve the failing "gradient contrast and hue" test (026 FR-002, FR-004, WEB-001), by changing the fills or colours or by a decision that changes the requirements ("forecast contrast and distinct colours" now passes: T041)
  - Closed by the accepted exception (research.md R13): test removed, chart unchanged
- [X] T036 [US2] Component tests first in `src/clutch-web/src/features/mortgages/BurnDownChart.test.tsx` for each gradient spanning its own line and for the stripe strength; confirm they fail
- [X] T037 [US2] Span each gradient over its own line in `src/clutch-web/src/features/mortgages/BurnDownChart.tsx`; green and blue tokens in `src/clutch-web/src/index.css`
- [X] T038 [US2] Stronger Bank Schedule stripes in Dark (`--chart-hatch-opacity`, `--chart-hatch-width`), with a browser check per theme
- [X] T039 [US2] Update the burndown screenshot baselines and run the chart browser tests
- [X] T040 [US2] Final colours: single green for Actual Balance and single orange for Forecast Balance in `src/clutch-web/src/index.css` (research.md R11)
- [X] T041 [US2] Browser test first in `src/clutch-web/e2e/style-guide.spec.ts` that every series reaches 3:1 on the card, then the Light orange and Dark blue and violet shades in `src/clutch-web/src/index.css` (research.md R12)

---

## Phase 6: Convergence

- [X] T042 CRITICAL: Tell the series apart in the legend without relying on colour (the Actual Balance and Forecast Balance samples differ only by colour, WCAG 2.2 SC 1.4.1), or record a decision that changes the requirement, per Constitution WEB-001 and FR-011 (contradicts)
  - Closed by the accepted exception (research.md R13): legend unchanged
- [X] T043 Update plan.md Open Issues and Dependency, T001 and T002 to the review decisions, which replace or reject what the unmerged contrast fix plans, once the user decides whether that fix is withdrawn or re-scoped, per plan: Dependency (contradicts)
  - Withdrawn (research.md R13)
- [X] T044 Bring the statements about unchanged series drawing, balance-level shading, existing screenshot baselines and chart state in plan.md, spec.md, quickstart.md and data-model.md in line with the built chart, per plan: Technical Context (contradicts)
- [X] T045 Record the schedule scroll-anchoring fix in `AmortizationSchedule.tsx`, which no 027 requirement asks for, in plan.md Complexity Tracking, per Constitution ARC-001 (unrequested)

---

## Phase 7: Convergence

- [X] T046 Correct the contract's statement that the current colours do not reach 3:1 on the card, which they now do, per FR-010 and SC-004 (contradicts)

---

## Dependencies & Execution Order

- Setup (T001 → T002) → US1 → US2 → Completion Gates. Nothing starts until T001 passes.
- US2 needs US1's `forecast` (T008, T009).
- US1: T003–T007 → T008 → T009 → T010.
- US2: T012 → T013 → T014 and T016 → T017 → T018 share files. T019 needs T011; T020 needs T002; then T021 → T022 → T023 → T024 (T023 also needs T019, T020).
- Gates: T025, T026 → T027 → T028 → T030 → T029 → T031. Fixes from T028, T029 or T031 rerun the gates they affect.

## Parallel Opportunities

- US1: T003, T004, T005, T006, T007
- US2: T011, T012, T015, T016 (tests); T020 alongside T019
- Gates: T025, T026

## Implementation Strategy

MVP = User Story 1 (after Setup): the column is usable and testable without any chart change. Verify the
values, then deliver User Story 2. Each story must pass its own tests before the next starts; browser
tests, build and audit run in the completion gates.
