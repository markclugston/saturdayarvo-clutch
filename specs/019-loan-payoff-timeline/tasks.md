---

description: "Task list for 019 Loan Payoff Timeline Group"
---

# Tasks: Loan Payoff Timeline Group

**Input**: `specs/019-loan-payoff-timeline/` (plan.md, spec.md, research.md, data-model.md, contracts/loan-payoff-timeline-preferences.md, quickstart.md)

**Tests**: REQUIRED. ENG-001 makes every behaviour change an explicit request for tests. Write
tests first and confirm they fail before implementing.

## Format: `- [ ] T### [P?] [US#?] Description with exact file path`

- **[P]**: parallel-safe (different files, no dependency). **[US#]**: user story label.
- Siblings: 018 navigation preference for every API, persistence and client preference file
  (`NavigationState.cs`, `UserNavigationPreference.cs`, `NavigationPreferenceService.cs`,
  `NavigationPreferenceEndpoints.cs`, `NavigationPreferenceTests.cs`, `features/preferences/api.ts`);
  the trash button in `DeleteMortgageControl.tsx` for the icon button.

## Phase 1: Setup

None. No new packages or config (lucide-react `RefreshCw` already available).

## Phase 2: Foundational (blocks all stories)

- [X] T001 [P] Add `LoanPayoffTimelineView` enum (`Burndown`, `Schedule`) per data-model.md in `src/Clutch.API/Domain/Preferences/LoanPayoffTimelineView.cs`
- [X] T002 Add `UserLoanPayoffTimelinePreference` entity (`UserId`, `View`, `ClientId`, `ClientSequence`, `UpdatedAtUtc`) in `src/Clutch.API/Infrastructure/Persistence/Entities/UserLoanPayoffTimelinePreference.cs`
- [X] T003 Map in `src/Clutch.API/Infrastructure/Persistence/AppDbContext.cs`: `UserId` nvarchar(450) PK, FK `AspNetUsers.Id` `ON DELETE CASCADE`; `View` varchar(16) required, enum string, `CK_UserLoanPayoffTimelinePreferences_View`: `[View] IN ('Burndown', 'Schedule')`; `ClientId` uniqueidentifier required; `ClientSequence` bigint required, `CK_UserLoanPayoffTimelinePreferences_ClientSequence`: `[ClientSequence] >= 1`; `UpdatedAtUtc` datetimeoffset required
- [X] T004 Generate migration `AddLoanPayoffTimelinePreferences` (table, PK, FK, both check constraints only; `Down` drops table; no backfill) plus snapshot in `src/Clutch.API/Infrastructure/Persistence/Migrations/`
- [X] T005 [P] Add `LoanPayoffTimelineViewSchema` (`z.enum(['Burndown', 'Schedule'])`) and `LoanPayoffTimelinePreferenceSchema` (`{ view }`) per contract in `src/clutch-web/src/lib/api/schemas.ts`

**Checkpoint**: build + fast tests pass.

---

## Phase 3: User Story 1 - One group, switchable view (Priority: P1) 🎯 MVP

**Goal**: One full-width "Loan Payoff Timeline" card shows Burndown or Schedule, switched by a top-right icon button. | **Independent Test**: Open Mortgages → one group shows the chart; switch → schedule; switch → chart.

View state here is page-local (`useState`, default `Burndown`) in `MortgagesPage`; US2 replaces it with the persisted preference.

### Tests (write first, confirm failing)

- [X] T006 [P] [US1] Tooltip primitive tests: shows on hover and keyboard focus, stays while pointer is over the tooltip, hides on Escape, blur and pointer leave; `aria-hidden` when text equals the trigger's accessible name, `aria-describedby` otherwise, in `src/clutch-web/src/components/ui/tooltip.test.tsx`
- [X] T007 [P] [US1] Group tests: `section` labelled by `h2` "Loan Payoff Timeline"; exactly one of chart/schedule rendered; button `aria-label` "Show Amortization Schedule"/"Show Burndown Chart", same tooltip text, no `aria-pressed`, `RefreshCw` `aria-hidden`; hidden `role="status"` "Showing Burndown Chart"/"Showing Amortization Schedule"; keyboard Enter/Space calls `onSwitch` (FR-003, FR-004) in `src/clutch-web/src/features/mortgages/LoanPayoffTimeline.test.tsx`
- [X] T008 [P] [US1] Update chart and schedule tests: no own card `section` or `h2` ("Mortgage Burndown"/"Amortization Schedule"); content, series, columns and messages unchanged (FR-002) in `src/clutch-web/src/features/mortgages/BurnDownChart.test.tsx` and `AmortizationSchedule.test.tsx`
- [X] T009 [US1] Page tests: one "Loan Payoff Timeline" group below Details, never both views (SC-001); default Burndown; switch changes view synchronously (FR-012) and the hidden `role="status"` text changes to the new view after each switch (FR-004); view kept across mortgage tabs and "Add mortgage" (US1-5); unsaved mortgage shows "Please enter your mortgage details" in both views and switch still works (US1-6) in `src/clutch-web/src/features/mortgages/MortgagesPage.test.tsx`

### Implementation

- [X] T010 [P] [US1] Add token-only `Tooltip` primitive per research.md R6 (hover + focus, hoverable, Escape dismiss, allowed motion only and none under reduced motion; no new package) in `src/clutch-web/src/components/ui/tooltip.tsx`
- [X] T011 [P] [US1] Remove own card `section` and `h2` from `src/clutch-web/src/features/mortgages/BurnDownChart.tsx` and `AmortizationSchedule.tsx`, keeping all content unchanged (R7)
- [X] T012 [US1] Add `LoanPayoffTimeline` (`view`, `onSwitch`, mortgage data props) per contract UI table: card `section`, Title Case `h2`, `Button variant="icon" size="icon"` top right wrapped in `Tooltip`, hidden status, body = one view, in `src/clutch-web/src/features/mortgages/LoanPayoffTimeline.tsx`
- [X] T013 [US1] In `src/clutch-web/src/features/mortgages/MortgagesPage.tsx`: remove the two-column grid, render one full-width `LoanPayoffTimeline` below Details, hold the view in page state (default `Burndown`) shared across tabs and "Add mortgage" (FR-001, FR-009)

**Checkpoint**: story's tests pass; phase gates per test cadence.

---

## Phase 4: User Story 2 - Remember my view (Priority: P1)

**Goal**: The chosen view is saved per user on every switch and shown on every load with no swap. | **Independent Test**: Switch to Schedule, reload → Schedule; sign out/in → Schedule; other user → Burndown; switch back, reload → Burndown.

### Tests (write first, confirm failing)

- [X] T014 [P] [US2] Integration tests (SQL Server fixture): no row → `Burndown`; PUT `Schedule` then GET from a second client of the same user → `Schedule`; GET and PUT without a session → 401; PUT without a valid antiforgery token → existing 400/403 and nothing saved (SEC-001); user B never reads user A's view; user delete cascades the row; migration applies and `Down` drops the table, in `tests/Clutch.API.Tests/Integration/Preferences/LoanPayoffTimelinePreferenceTests.cs`
- [X] T015 [US2] Integration tests, same file: same `clientId` seq 2 then seq 1 → stored stays seq 2's view, 200 returns stored view, outcome `superseded`; many parallel PUTs one `clientId` increasing seq → highest seq wins; different `clientId`s → last committed wins (FR-006, FR-008, SC-007)
- [X] T016 [US2] Integration tests, same file: `view` missing/null/`"schedule"`/`"Table"`/`5`/`{}`; `clientId` missing, malformed or all zeros; `clientSequence` 0, negative, > 2^53 − 1, string, fractional; empty, malformed and > 1024-byte body → 400 with title `The loan payoff timeline view is invalid.`, detail `Choose Burndown or Schedule.`, nothing saved, outcome `invalid` (FR-011)
- [X] T017 [P] [US2] Unit tests: loan payoff timeline counter `clutch.preference.loan_payoff_timeline.save.outcomes` records `success`/`superseded`/`invalid`/`failure` with duration histogram in `tests/Clutch.API.Tests/Unit/Preferences/PreferenceMetricsTests.cs`
- [X] T018 [P] [US2] Client API tests: GET/PUT path and schema parse; query key `['loanPayoffTimelinePreference', userId]` disabled (no request, no timer) until `userId`; 2000 ms abort; `retry: false`; `staleTime: Infinity` and no refetch on window focus, reconnect or remount, so another device's save is never pulled into an open visit (FR-008, US2-5); after a GET error or 2000 ms timeout, unmounting and remounting the query hook sends no second GET and the view stays `Burndown` for the visit (FR-005, edge case "Loading the saved view fails"); save mutation has no `scope`, so three rapid saves start three PUTs at once with the same `clientId` and `clientSequence` 1, 2, 3; every PUT is sent with `keepalive: true`; unmounting and remounting the save hook (leave Mortgages and return) keeps the same `clientId` and the next save continues the sequence (4, not 1) in `src/clutch-web/src/features/preferences/api.test.ts`
- [X] T019 [US2] Page tests: `Loading...` while preference pending; saved `Schedule` → first render shows schedule, never the chart (FR-007, US2-3); error or no response in 2 s (fake timers) → Burndown and late response ignored (FR-005, SC-006); remounting the page with `Schedule` already cached renders the schedule on first render with no `Loading...` and no chart (SC-003 navigation back within a visit); switch writes cache synchronously then PUTs; an older save response arriving last does not change the view; save failure → toast, view kept (FR-010); a PUT that never resolves still switches at once (FR-012) in `src/clutch-web/src/features/mortgages/MortgagesPage.test.tsx`

### Implementation

- [X] T020 [US2] Add `RecordLoanPayoffTimelineSave(outcome, started)` with counter `clutch.preference.loan_payoff_timeline.save.outcomes` and duration histogram (R8) in `src/Clutch.API/Application/Preferences/PreferenceMetrics.cs`
- [X] T021 [US2] Add `LoanPayoffTimelinePreferenceService`: AsNoTracking PK read defaulting `Burndown`; serializable upsert via execution strategy that skips the write when stored `ClientId` matches and `ClientSequence` ≥ request (returns stored view, outcome `superseded`), else writes with `TimeProvider` timestamp; structured log on failure without body, in `src/Clutch.API/Application/Preferences/LoanPayoffTimelinePreferenceService.cs`
- [X] T022 [US2] Register `LoanPayoffTimelinePreferenceService` in `src/Clutch.API/Infrastructure/DependencyInjection.cs`
- [X] T023 [US2] Add `GET`/`PUT /api/preferences/loan-payoff-timeline`: `RequireAuthorization`, user from principal, manual 1024-byte body read, allow-listed `view`, non-zero GUID `clientId`, `clientSequence` 1..2^53 − 1, else contract 400 + `invalid` metric, in `src/Clutch.API/Api/Endpoints/LoanPayoffTimelinePreferenceEndpoints.cs`
- [X] T024 [US2] Map the new endpoints beside the navigation preference endpoints in `src/Clutch.API/Program.cs`
- [X] T025 [US2] Add `getLoanPayoffTimelinePreference`/`saveLoanPayoffTimelinePreference`, `useLoanPayoffTimelinePreference(userId)` (per contract Client behaviour; an errored or timed-out load is not re-requested on remount within the visit, e.g. `retryOnMount: false`) and a save hook that reads one module-level page-load state holding both `clientId` (`crypto.randomUUID()`, created once) and `clientSequence` (incremented per save, never reset while the page is loaded, so remounting the page cannot restart the sequence under the same `clientId`); PUT sent with `keepalive: true` so a save started just before a reload still reaches the server; no mutation scope; responses never write the cache, in `src/clutch-web/src/features/preferences/api.ts`
- [X] T026 [US2] Pass the session `id` as `userId` to `MortgagesPage` in `src/clutch-web/src/App.tsx`; keep the new query key outside the session-query list so the existing sign-out `removeQueries` clears it (SC-004, verified by T029's same-tab second-user journey)
- [X] T027 [US2] In `src/clutch-web/src/features/mortgages/MortgagesPage.tsx`: accept `userId`, start the preference query in parallel with mortgages, keep `Loading...` until both settle (Burndown on error/timeout), replace page state with the cache entry, switch = `setQueryData` then save with per-call `onError` toast (R4, R5)
- [X] T028 [P] [US2] Add `/api/preferences/loan-payoff-timeline` mock returning `Burndown` to the catch-all `/api/*` routes in `src/clutch-web/e2e/style-guide.spec.ts` (R9)
- [X] T029 [US2] Real-API journeys: switch to Schedule, reload → Schedule; sign out and in → Schedule; sign out, then sign in as a second user in the same tab without reloading → Burndown (previous user's cached view not shown); sign out, then sign in as the first user again → Schedule (each user sees their own view); switch back, reload → Burndown; switch three times (Schedule, Burndown, Schedule) and reload at once without waiting for responses → Schedule; navigate away from Mortgages and back → the view last chosen, then switch, reload → the new view, in `src/clutch-web/e2e/mortgages.spec.ts` (US2-1, US2-2, US2-4, US2-6, SC-003, SC-004, SC-007)

**Checkpoint**: story's tests pass; phase gates per test cadence.

---

## Phase 5: Completion Gates

- [X] T030 Browser tests (mocked) in `src/clutch-web/e2e/style-guide.spec.ts`: replace the 016 test "Burndown sits above the schedule at 320 px and to its left on desktop (FR-011)" (it locates the removed "Mortgage Burndown"/"Amortization Schedule" headings) with one asserting the single "Loan Payoff Timeline" group spans the content width at 320 px and 1280 px (FR-001); one group, never both views (SC-001); switch button same size as the trash button, at the group's top right and vertically aligned with the `h2` at 320 px and 1280 px (FR-003); axe WCAG 2.2 AA and screenshots for both views in light and dark; tooltip shown (hover and keyboard focus) with axe WCAG 2.2 AA and a screenshot in light and dark; 320 px no page-level horizontal scroll, button visible; preference delayed 5 s → group shows Burndown no more than 2,000 ms after the preference request starts, timed from the mocked route receiving it (SC-006) (WEB-001); update snapshots in `style-guide.spec.ts-snapshots/`
- [X] T031 Independent query review of `LoanPayoffTimelinePreferenceService` read and sequenced upsert (DOT-002, `clutch-data-access`)
- [X] T032 Migration review of `AddLoanPayoffTimelinePreferences` with drop-table rollback, no backfill (OPS-001, `clutch-data-access`)
- [X] T033 Independent OWASP Top 10 + dependency vulnerability review of the full diff, including the new tooltip primitive, and confirm the save-failure log and 400 ProblemDetails carry no request body (SEC-001, OPS-001; also confirms the plan's SEC-003 N/A rationale, `clutch-security-review`)
- [X] T034 Validate the plan.md UI compliance checklist in both themes with agent-executable checks (lint, T030 screenshots/axe, a `prefers-reduced-motion: reduce` run for the tooltip) and tick items in `specs/019-loan-payoff-timeline/plan.md` (WEB-001, `clutch-ui-style`)
- [X] T035 Add tooltip to the primitives list in the "Source of truth" table of `.claude/skills/clutch-ui-style/SKILL.md` (pointing at `components/ui/tooltip.tsx` and its component tests), then run `.\scripts\sync-agent-config.ps1 -From claude` so `.github/` matches (WEB-001 guidance follows code)
- [X] T036 Run quickstart.md commands (API tests, vulnerable packages, typecheck, lint, test, build, both Playwright configs), record pass/fail counts in `specs/019-loan-payoff-timeline/quickstart.md` and set each Constitution Check row in `plan.md` from PENDING to PASS or FAIL with its evidence (task ID, command or review); report any FAIL or blocked check (ENG-001, DOT-001)
- [X] T037 Run `/speckit-converge` and resolve any appended tasks (Workflow gate)

## Phase 6: Convergence

- [X] T038 Keep the loaded or switched Loan Payoff Timeline view for the whole visit: set `gcTime: Infinity` on `useLoanPayoffTimelinePreference` in `src/clutch-web/src/features/preferences/api.ts` (the app `QueryClient` keeps the 5-minute default, so leaving Mortgages for over 5 minutes drops the unobserved entry and returning re-shows `Loading...`, re-requests the saved view, can pull in another device's save, and after a failed save shows the old saved view instead of the one last chosen), and add tests in `src/clutch-web/src/features/preferences/api.test.ts` that advance fake timers past 5 minutes between unmount and remount for the loaded, errored and switched-then-save-failed cases and assert no second GET and the same view per FR-008, FR-010, SC-003 and edge case "Loading the saved view fails" (partial)

---

## Dependencies & Execution Order

- Setup → Foundational → US1 → US2 → Completion Gates.
- T002 needs T001; T003 needs T002; T004 needs T003. T012 needs T010, T011. T013 needs T012.
- T021 needs T001, T003, T020; T022 and T023 need T021; T024 needs T023. T025 needs T005. T027 needs T013, T025, T026.
- T029 needs T024 and T027. T030 needs T027 and T028. T035 needs T010. US2 frontend tests (T019) build on US1's page tests (T009, same file).

## Parallel Opportunities

- Foundational: T001, T005 (T002 after T001)
- US1: tests T006, T007, T008; T010 alongside T011
- US2: tests T014, T017, T018 (T015, T016 follow T014 in the same file); API work (T020–T024) alongside client work (T025) and T028

## Implementation Strategy

MVP = User Story 1 (single switchable group, page-local view). US2 then makes the view persistent.
Deliver stories incrementally; each must pass its own tests before the next starts.

## Phase 7: Convergence

- [ ] T039 Cover the kept height-filling layout (FR-013): add tests in `src/clutch-web/src/features/mortgages/AmortizationSchedule.test.tsx` and `LoanPayoffTimeline.test.tsx` (already partly updated for page-scroller windowing), update the T030 browser tests and screenshots in `src/clutch-web/e2e/style-guide.spec.ts` for 320 px and 1280 px in both views and themes with axe WCAG 2.2 AA, confirm the schedule is still keyboard reachable now that its own focusable scroll box is gone, and confirm other `ContentPanel` screens (`App.tsx`, `AuthPage.tsx`) look unchanged per FR-013 (WEB-001) (unrequested, now specified)
