---

description: "Tasks for 026-mortgage-area-chart"
---

# Tasks: Mortgage Area Chart

**Input**: `specs/026-mortgage-area-chart/` (plan.md, spec.md, research.md, data-model.md, contracts/burndown-chart-ui.md, quickstart.md)

**Tests**: REQUIRED. ENG-001 makes every behaviour change an explicit request for tests. Write
tests first and confirm they fail before implementing. Commands: quickstart.md (run from `src/clutch-web`).

## Format: `- [ ] T### [P?] [US#?] Description with exact file path`

- **[P]**: parallel-safe (different files, no dependency). **[US#]**: user story label.
- Paths below are relative to `src/clutch-web/` unless they start with `.claude/`, `.github/` or `scripts/`.

## Phase 1: Setup

None: no new package, config or Playwright config.

## Phase 2: Foundational (blocks all stories)

- [X] T001 [P] Add a rule test accepting `text-chart-schedule-start/end` and `text-chart-actual-start/end` in `eslint-rules/clutch-style.test.js`; confirm it fails
- [X] T002 Add `chart-schedule-start`, `chart-schedule-end`, `chart-actual-start`, `chart-actual-end` to `TOKEN_COLOURS` in `eslint-rules/clutch-style.js` so T001 passes
- [X] T003 [P] Add the four RGB-triplet tokens for Light and Dark (values per research.md R1) and `--color-chart-schedule-start` … `--color-chart-actual-end` mappings beside `--color-chart-navy` in `src/index.css`

**Checkpoint**: `npm run lint` and `npm run typecheck` pass.

---

## Phase 3: User Story 1 - Read the burndown as a coloured area chart (Priority: P1) 🎯 MVP

**Goal**: Both series drawn as monotone-smoothed gradient lines with light gradient fills to $0, legend to match | **Independent Test**: With valid Details and a linked account, both series show a date-aligned gradient line and fill; without one, only Bank Schedule.

- [X] T004 [P] [US1] Unit tests in new `src/features/mortgages/chartGeometry.test.ts`: monotone path passes through every point, no control point outside its neighbours' y range (FR-005), 1 and 2 point inputs; area path closes at y($0), above and below for negative values (R4)
- [X] T005 [P] [US1] Component tests in `src/features/mortgages/BurnDownChart.test.tsx`: gradients per contract (`linearGradient[data-series]`, `userSpaceOnUse` x 70→580, stops with the four token classes, unique ids for two charts)
- [X] T006 [US1] Component tests in `src/features/mortgages/BurnDownChart.test.tsx`: line/area `path[data-series][data-part]` vertices equal the 023/024 point lists, and every area vertex lies within x 70–580 and the balance axis range (FR-001, SC-005); a negative Actual Balance renders an Actual area that closes at y($0), filling above and below it (Edge Cases); replace every assertion found by searching the file for `polyline`, `text-chart-primary` and `text-chart-navy` with contract selectors
- [X] T007 [US1] Component tests in `src/features/mortgages/BurnDownChart.test.tsx`: Actual line dashed, Bank solid (FR-004); fill opacities 0.18/0.14 and draw order Bank area, Actual area, guides, Bank line, Actual line (R3, US1-3)
- [X] T008 [US1] Component tests in `src/features/mortgages/BurnDownChart.test.tsx`: single Actual Balance → `circle[data-series="actual"][data-part="dot"]` filled from the Actual Balance gradient, no area; no account → Bank Schedule only; legend `[data-part="legend"]` samples per FR-006, each filled from its own `linearGradient[data-part="legend-gradient"]` (`objectBoundingBox`, start and end token stops — full colour range, research.md R2); invalid Details → message, no fill (FR-011); the chart renders no `button`, `menu`, `combobox` or `listbox` (FR-012); the existing 024 text-alternative and update-behaviour tests in this file stay and pass unchanged (FR-011)
- [X] T009 [US1] Implement exported `monotonePath(points)` (Fritsch–Carlson, as d3 curveMonotoneX) and `areaPath(points, zeroY)` in `src/features/mortgages/chartGeometry.ts` so T004 passes (research.md R4)
- [X] T010 [US1] In `src/features/mortgages/BurnDownChart.tsx` add per-series `<linearGradient>` (`useId()` ids, stops `className="text-chart-…"` + `stopColor="currentColor"`, `data-series`) and per-series `objectBoundingBox` legend gradients (`data-part="legend-gradient"`) per research.md R2
- [X] T011 [US1] In `src/features/mortgages/BurnDownChart.tsx` replace both polylines with memoised line and area `path`s from T009 (`data-series`/`data-part`, gradient stroke/fill, opacities, dash, draw order per R3), and give the single Actual Balance dot `data-series="actual"`, `data-part="dot"` and the Actual Balance gradient fill in place of `text-chart-navy`
- [X] T012 [US1] In `src/features/mortgages/BurnDownChart.tsx` update legend samples to each series' legend gradient (full start→end range) and solid/dashed style, keeping 024 FR-004 listing rules; T005–T008 pass
- [X] T013 [US1] Update every locator found by searching for `polyline`, `text-chart-primary` and `text-chart-navy` to the contract's `path[data-series][data-part="line"]` / `circle[data-part="dot"]` selectors in `e2e/mortgages.spec.ts`
- [X] T014 [US1] Update every locator found by searching for `polyline`, `text-chart-primary` and `text-chart-navy` to the contract's `path[data-series][data-part="line"]` selectors (reading vertices from `d` instead of `points`) in `src/features/mortgages/LoanPayoffTimeline.test.tsx` and `src/features/mortgages/MortgagesPage.test.tsx`, alongside T011 so they pass with it
- [X] T015 [US1] Update every locator found by searching for `polyline`, `text-chart-primary` and `text-chart-navy`, including the `reach` steps of the `mortgages-timeline-burndown` and `mortgages-burndown-actual` states and the other burndown check in `e2e/style-guide.spec.ts` to the contract's path selectors
- [X] T016 [US1] Style-guide test sampling each gradient (≥ 41 steps from computed stop colours) for ≥ 3:1 against `card` and against `card` blended with each fill that can lie beneath the line (other series' fill, both fills), and under the hover band (`fg` at 0.05); the same backgrounds for ring strokes and the single dot; and the hue of every sampled Actual Balance step ≥ 30° from `success`, Light and Dark (FR-002, FR-004, SC-002) in `e2e/style-guide.spec.ts`
- [X] T017 [P] [US1] Document the four gradient series tokens and fill/dash rules in §5 Charts of `.claude/skills/clutch-ui-style/references/forms-components.md` as the burndown's series colours, stating that `primary`/`primary-tint`/`accent-navy` remain the series colours for other charts, then run `scripts/sync-agent-config.ps1 -From claude`

**Checkpoint**: US1 component and unit tests pass; `npm run lint`, `npm run typecheck`, `npm test` pass.

---

## Phase 4: User Story 2 - Hover a point to see its value (Priority: P1)

**Goal**: One shared label, band and rings, moved by pointer or keyboard, with keyboard moves announced | **Independent Test**: Pointer and keys move the label across plotted dates; values equal the Amortization Schedule rows.

- [X] T018 [P] [US2] Unit tests in `src/features/mortgages/chartGeometry.test.ts`: `nearestIndex` (binary search, ties → earlier, clamps outside plot), `yearStepIndex` (nearest to date ±1 calendar year, ≥ 1 step, clamped), `clientXToViewBox` (`xMidYMid meet` letterboxing)
- [X] T019 [P] [US2] Component tests in `src/features/mortgages/BurnDownChart.test.tsx`: pointer move shows band, rings per series and `[data-slot="burndown-label"]` with date and amounts equal to the schedule table (FR-007, SC-001); the label sits in the lower part of the plot when the hovered points are in the upper half, else the upper part, never covering a ring (R5); label amounts carry `text-right tabular-nums` (FR-007, WEB-001); at the Disbursal Date the label shows the Opening Balance from Details and no Actual Balance (FR-007, SC-001); no Actual Balance on blank rows (FR-008); with exactly one Actual Balance, hovering its date shows its value (Edge Cases)
- [X] T020 [US2] Component tests in `src/features/mortgages/BurnDownChart.test.tsx`: `group` "Burndown Values" focus shows no label; Right/Home/Page Down → first, Left/End/Page Up → last; arrows, Home/End, Page keys move; Escape hides and keeps focus; handled keys `preventDefault` (FR-009)
- [X] T021 [US2] Component tests in `src/features/mortgages/BurnDownChart.test.tsx`: `status` text set only after key moves, empty after pointer moves and hide (FR-009, SC 4.1.3); pointer-then-key continues; keyboard label survives pointer leave; pointer label hides on leave; blur hides (FR-009a); while the label shows, the band is drawn after both areas and before the guides, lines, rings and dot (FR-004, R3); band, rings and the `[data-slot="burndown-label"]` overlay have `pointer-events: none`, and moving the pointer across them (including under the label) fires no `pointerleave` hide and still reaches every date (FR-010)
- [X] T022 [US2] Component tests in `src/features/mortgages/BurnDownChart.test.tsx`: no label/band/rings for invalid Details; balances loading/failed → Bank Schedule only in label; hover update on a 1,560-period schedule completes < 100 ms in jsdom (SC-003 early warning; T028 is the gate)
- [X] T023 [US2] Implement `nearestIndex`, `yearStepIndex` and `clientXToViewBox` in `src/features/mortgages/chartGeometry.ts` so T018 passes (research.md R6, R7)
- [X] T024 [US2] In `src/features/mortgages/BurnDownChart.tsx` derive memoised `PlottedDate[]` (data-model.md) and add `HoverState` per data-model.md transitions, reset to null when index is out of range, no `useEffect` (R8)
- [X] T025 [US2] In `src/features/mortgages/BurnDownChart.tsx` add the transparent plot-area `rect` with `pointermove`/`pointerleave` handlers, band `rect[data-part="band"]` (`fill-fg`, `fillOpacity` 0.05, ≥ 6 units, above the fills and below guides, lines, rings and dot) and `circle[data-part="ring"]` rings, both `pointer-events-none` (R5, R6)
- [X] T026 [US2] In `src/features/mortgages/BurnDownChart.tsx` render the `aria-hidden` `pointer-events-none` label (`rounded-control bg-raised text-fg shadow-float`, amounts `text-right tabular-nums`, formatters per contract: export one shared cents formatter and use it for both the label's Bank Schedule amount and the closing balance in `src/features/mortgages/AmortizationSchedule.tsx` (existing `AmortizationSchedule.test.tsx` and `AmortizationScheduleAccount.test.tsx` keep covering the table's format), `left: p%` + `translateX(-p%)`, upper/lower placement, no transitions)
- [X] T027 [US2] In `src/features/mortgages/BurnDownChart.tsx` wrap the SVG in the focusable `role="group"` div (`aria-label`, `aria-describedby` sr-only instructions, `focus-visible:focus-ring rounded-control`), key/blur handlers and sr-only polite `role="status"` (R7); T019–T022 pass
- [X] T028 [US2] Hover and keyboard journey (label values match table rows, Escape hides) and, with a mocked 1,560-period schedule, pointer move to label shown < 100 ms (SC-003) in `e2e/mortgages.spec.ts`
- [X] T029 [US2] Style-guide tests in `e2e/style-guide.spec.ts`: label box inside the chart's box (FR-010, SC-005) at first and last dates; under reduced motion the label, band and rings have computed transition and animation durations of 0 (FR-010); at 320 px, both themes, under reduced motion; label text ≥ 4.5:1 (SC-002); axe WCAG 2.2 AA with label shown; focused-group focus ring visible (computed ring style and screenshot) in both themes (FR-009); hovered-label screenshots

**Checkpoint**: US2 component and unit tests pass; `npm run lint`, `npm run typecheck`, `npm test` pass.

---

## Phase 5: Completion Gates

- [X] T030 Regenerate burndown style-guide screenshot baselines once with `--update-snapshots` (quickstart.md), review the images in both themes, then rerun without the flag in `e2e/style-guide.spec.ts-snapshots/`
- [X] T031 Run the browser tests for the critical journey and style guide (`e2e/mortgages.spec.ts`, style-guide config `-g "burndown|tooltip|reduced motion"`) and record results (WEB-001)
- [X] T032 Independent security review of the full diff, confirming balances are not logged, stored or sent and live-region text stays in-page (SEC-001..003, `clutch-security-review`)
- [X] T033 Validate the plan's UI compliance checklist in both themes and tick each item in `specs/026-mortgage-area-chart/plan.md` (WEB-001, `clutch-ui-style`)
- [X] T034 Confirm FR-012: no header totals, period selector, display menu, refresh, expand or "updated" footer added in `src/features/mortgages/BurnDownChart.tsx` (ARC-001), backed by T008's assertion that the chart renders no buttons, menus or selects
- [X] T035 Run completion quality gates (`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm audit --omit=dev`) and record results (ENG-001, `clutch-frontend`)
- [X] T036 Run `/speckit-converge` and complete any tasks it appends before declaring the feature complete (Workflow and Delivery Gates)

---

## Dependencies & Execution Order

- Setup → Foundational → US1 → US2 → Completion Gates.
- T002 needs T001. T010–T012 need T003 (tokens); T011–T012 also need T009. T013, T014 and T015 land with T011 (it removes the polylines they locate).
- US2 builds on US1's `BurnDownChart.tsx` (rings use the series gradients from T010); start T024 after T012.
- T004 and T018 share `chartGeometry.test.ts`; T005–T008 and T019–T022 share `BurnDownChart.test.tsx`, so run each file's tasks in order.
- T015, T016 and T029 share `e2e/style-guide.spec.ts`; T013 and T028 share `e2e/mortgages.spec.ts`; run each file's tasks in order.
- T030 needs T015, T016 and T029. T036 runs last.

## Parallel Opportunities

- Foundational: T001, T003
- US1: T004, T005 (tests); then T017 alongside T009–T012
- US2: T018, T019 (tests); then T028 and T029 (different files, after T013 and T016 respectively) alongside T023–T027

## Implementation Strategy

MVP = User Story 1 (area chart treatment). Deliver stories incrementally; each must pass its own tests before the next starts.

---

## Phase 6: Convergence

- [X] T037 Place the hover label clear of both rings when the Bank Schedule and Actual Balance rings straddle the plot's middle (opposite side of the hovered date, upper part), with a component test, in `src/features/mortgages/BurnDownChart.tsx` per FR-010 / research.md R5 (partial)
- [X] T038 Add `chart-schedule-mid` and `chart-actual-mid` tokens (both themes) to `src/index.css`, the `clutch/style-tokens` lint rule and its tests, and the style guide's chart guidance; gradient stops at 0, 0.5 and 1 in `src/features/mortgages/BurnDownChart.tsx` with component tests (FR-002, FR-006, research.md R1, R2)
- [X] T039 Draw the Actual Balance line and legend sample solid and add the end-of-line "Actual Balance" name, with component tests (FR-004, FR-006, research.md R10)
- [X] T040 Make the hover label follow the hovered date: pure `labelPosition` in `src/features/mortgages/chartGeometry.ts` with unit tests, applied by layout effect in `BurnDownChart.tsx` (FR-010, research.md R5)
- [X] T041 Update `e2e/style-guide.spec.ts` contrast test for three stops and the series-name text (4.5:1), regenerate burndown baselines, and run lint, typecheck, unit and browser tests (ENG-001, WEB-001)
