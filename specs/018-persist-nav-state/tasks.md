---

description: "Task list for 018 Remember Navigation Expanded State"
---

# Tasks: Remember Navigation Expanded State

**Input**: `specs/018-persist-nav-state/` (plan.md, spec.md, research.md, data-model.md, contracts/navigation-preferences.md, quickstart.md)

**Tests**: REQUIRED. ENG-001 makes every behaviour change an explicit request for tests. Write
tests first and confirm they fail before implementing.

## Format: `- [ ] T### [P?] [US#?] Description with exact file path`

- **[P]**: parallel-safe (different files, no dependency). **[US#]**: user story label.
- Siblings: theme preference (003) for every API, persistence and client file; `MortgageMetrics.cs` for metrics.

## Phase 1: Setup

None. No new packages or config.

## Phase 2: Foundational (blocks all stories)

- [X] T001 [P] Add `NavigationState` enum (`Unpinned`, `Pinned`) per data-model.md in `src/Clutch.API/Domain/Preferences/NavigationState.cs`
- [X] T002 Add `UserNavigationPreference` entity (`UserId`, `State`, `UpdatedAtUtc`) in `src/Clutch.API/Infrastructure/Persistence/Entities/UserNavigationPreference.cs`
- [X] T003 Map table in `src/Clutch.API/Infrastructure/Persistence/AppDbContext.cs`: `UserId` nvarchar(450) PK, FK `AspNetUsers.Id` `ON DELETE CASCADE`; `State` varchar(16) required, enum string, `CK_UserNavigationPreferences_State`: `[State] IN ('Pinned', 'Unpinned')`; `UpdatedAtUtc` datetimeoffset required
- [X] T004 Generate migration `AddNavigationPreferences` (table, PK, FK, check constraint only; `Down` drops table) in `src/Clutch.API/Infrastructure/Persistence/Migrations/`
- [X] T005 [P] Add `NavigationStateSchema` and `NavigationPreferenceSchema` per contract in `src/clutch-web/src/lib/api/schemas.ts`

**Checkpoint**: build + fast tests pass.

---

## Phase 3: User Story 1 - Return to my preferred navigation state (Priority: P1) ðŸŽ¯ MVP

**Goal**: Pinning/unpinning is saved for the user and restored on reload or sign-in without a jump. | **Independent Test**: Pin, reload â†’ starts pinned; unpin, reload â†’ starts compact.

### Tests (write first, confirm failing)

- [X] T006 [P] [US1] Integration tests (SQL Server fixture): no row â†’ `Unpinned`; PUT then GET round-trip; 401 unauthenticated; missing/null/`"pinned"`/`"Expanded"` â†’ 400 with contract title/detail, nothing saved and save outcome `invalid` recorded (`MeterListener`, as in `MortgageMetricsTests`); migration applies, in `tests/Clutch.API.Tests/Integration/Preferences/NavigationPreferenceTests.cs`
- [X] T007 [P] [US1] Unit tests for `MeterName` = `Clutch.API.Preferences`, save outcome counter (`success`/`invalid`/`failure`) and duration histogram in `tests/Clutch.API.Tests/Unit/Preferences/PreferenceMetricsTests.cs`
- [X] T008 [P] [US1] Client API tests: GET/PUT path and schema parse, query disabled (no request, no timer) until a session `id` exists, 2000 ms abort, `retry: false`, mutation scope `navigationPreference:<userId>` serialises one user's saves and does not queue another user's saves behind them in `src/clutch-web/src/features/preferences/api.test.ts`
- [X] T009 [P] [US1] App tests, for both app open/reload with an active session and sign-in from `AuthPage` (session 401 â†’ sign-in â†’ session invalidated â†’ data) (US1-5): startup dialog held while preference pending; first shell render pinned when `Pinned`, with no render of the shell compact first (FR-007); error or >2 s (fake timers) â†’ compact and late response ignored (FR-002a) in `src/clutch-web/src/App.test.tsx`
- [X] T010 [US1] App tests: toggle flips `aria-expanded` synchronously and sends one PUT; hover/focus send none (FR-003, FR-010); save failure â†’ toast, state kept (FR-006); rapid toggles â†’ last PUT has final state; a save still pending at sign-out shows no toast after the sign-in screen appears, in `src/clutch-web/src/App.test.tsx`

### Implementation

- [X] T011 [P] [US1] Add static `PreferenceMetrics` class like `MortgageMetrics` (`MeterName` = `Clutch.API.Preferences`, `Start()`, `RecordNavigationSave(outcome, started)`; `clutch.preference.navigation.save.outcomes` + duration histogram) per research.md R7 in `src/Clutch.API/Application/Preferences/PreferenceMetrics.cs`
- [X] T012 [US1] Add `NavigationPreferenceService` (AsNoTracking PK read defaulting `Unpinned`; serializable upsert via execution strategy, `TimeProvider` timestamp; records `success`/`failure`; structured log on failure without body) in `src/Clutch.API/Application/Preferences/NavigationPreferenceService.cs`
- [X] T013 [US1] Register `NavigationPreferenceService` in `src/Clutch.API/Infrastructure/DependencyInjection.cs` (`PreferenceMetrics` is static, so it is not registered, as with `MortgageMetrics`)
- [X] T014 [US1] Add `GET`/`PUT /api/preferences/navigation` with `RequireAuthorization`, user from principal, allow-listed `state` â†’ 400 ProblemDetails per contract and `PreferenceMetrics.RecordNavigationSave("invalid", â€¦)` in `src/Clutch.API/Api/Endpoints/NavigationPreferenceEndpoints.cs`
- [X] T015 [US1] Map endpoints and add `Clutch.API.Preferences` meter beside existing meters in `src/Clutch.API/Program.cs`
- [X] T016 [US1] Add `getNavigationPreference`/`saveNavigationPreference`, `useNavigationPreference(userId)` (`userId` = session `id` from `SessionSchema`; key `['navigationPreference', userId]`, `enabled` only when `userId` is defined so the 2 s limit starts when the session has loaded (FR-002a), signal + `AbortSignal.timeout(2000)`, `retry: false`, `staleTime: Infinity`, no refetch on focus/reconnect) and save mutation scoped `` { id: `navigationPreference:${userId}` } `` in `src/clutch-web/src/features/preferences/api.ts`
- [X] T017 [US1] In `src/clutch-web/src/App.tsx`: keep `StartupLoadingDialog` while preference pending. `useNavigationExpansion` is currently created in `AppContent` before the session loads, so a `useState` initial value cannot seed it. Move it into a signed-in shell component that renders `AppShell`, is mounted only once the preference query has settled, is keyed by the session `id`, and calls `useNavigationExpansion(initialPinned)` (`useState(initialPinned)`; `Unpinned` on error/timeout). Never set the state compact first and correct it in an effect. Remove `navigation.reset()` from sign-out, because the shell unmounts. Replace the hook's "Nothing is persisted." doc comment.
- [X] T018 [US1] In the signed-in shell in `src/clutch-web/src/App.tsx`: `toggle()` updates state then fires the save. Show the existing toast from the per-call `mutate(â€¦, { onError })` callback per research.md R5, so it never fires after the shell unmounts on sign-out. Hover/focus never save.
- [X] T019 [P] [US1] Add `/api/preferences/navigation` mock returning `Unpinned` to catch-all `/api/*` routes in `src/clutch-web/e2e/style-guide.spec.ts` and `src/clutch-web/e2e/import-settings.spec.ts` (R8)
- [X] T020 [US1] Playwright journeys in `src/clutch-web/e2e/navigation.spec.ts`: add preference mock; saved `Pinned` â†’ pinned first paint, no geometry change at 1280 px and 767 px; `Unpinned` â†’ compact, hover/focus expand; route delayed 5 s â†’ shell visible and compact within 2,500 ms of the session response (2 s cap plus render tolerance)

**Checkpoint**: story's tests pass; phase gates per test cadence.

---

## Phase 4: User Story 2 - Same preference across devices and users (Priority: P2)

**Goal**: Preference follows the account, last save wins, never leaks between users. | **Independent Test**: Pin on device A, open on device B as same user â†’ pinned; sign in as another user on A â†’ their own state.

- [X] T021 [P] [US2] Integration tests: second client of same user reads `Pinned` (US2-1); two sequential saves from two clients of the same user â†’ later returned by both (FR-005, US2-2); user B never sees user A's row (SC-003); user delete cascades row, in `tests/Clutch.API.Tests/Integration/Preferences/NavigationPreferenceTests.cs`
- [X] T022 [P] [US2] App test: sign out then sign in as another user shows that user's state, not the previous one (query and signed-in shell keyed by user ID, so the shell remounts); a save failure from the previous user's session shows nothing to the new user, in `src/clutch-web/src/App.test.tsx`
- [X] T023 [US2] Fix any failures from T021/T022 in `NavigationPreferenceService.cs` or `src/clutch-web/src/App.tsx` (cache key per user, no cross-user seeding)

**Checkpoint**: story's tests pass; phase gates per test cadence.

---

## Phase 5: Completion Gates

- [X] T024 Run axe (WCAG 2.2 AA) in both themes with pinned start and confirm existing 011/015 journeys pass in `src/clutch-web/e2e/navigation.spec.ts` (WEB-001, FR-009)
- [X] T025 Independent query review of `NavigationPreferenceService` read/upsert (DOT-002, `clutch-data-access`)
- [X] T026 Migration review of `AddNavigationPreferences` with drop-table rollback, no backfill (OPS-001, `clutch-data-access`)
- [X] T027 Independent OWASP Top 10 + dependency vulnerability review of the full diff (SEC-001, `clutch-security-review`)
- [X] T028 Validate plan.md UI compliance checklist with agent-executable checks: Playwright screenshots of the pinned start in both themes, and a `prefers-reduced-motion: reduce` run confirming the pinned start applies with no transition, both in `src/clutch-web/e2e/navigation.spec.ts` (WEB-001, ENG-001, `clutch-ui-style`)
- [X] T029 Run quickstart.md commands (API tests, typecheck, lint, test, build, e2e) and record results (ENG-001, DOT-001)
- [X] T030 Run `/speckit-converge` and resolve any appended tasks (Workflow gate)

---

## Dependencies & Execution Order

- Setup â†’ Foundational â†’ US1 â†’ US2 â†’ Completion Gates.
- T004 needs T003; T003 needs T002; T002 needs T001 (`State` is a `NavigationState`). T012 needs T001, T003, T011. T013 and T014 need T012. T015 needs T011 and T014. T017 needs T016, which needs T005; T018 needs T017 (same file).
- T020 needs T017â€“T019. US2 tests (T021, T022) need US1 implementation to run green.

## Parallel Opportunities

- Foundational: T001, T005 (then T002 after T001)
- US1: tests T006, T007, T008, T009/T010 (same file, one author); T011 alongside T016; T019 alongside API work
- US2: T021, T022

## Implementation Strategy

MVP = User Story 1. Deliver stories incrementally; each must pass its own tests before the next starts.

## Phase 6: Convergence

- [X] T031 Make `PUT /api/preferences/navigation` return the contract 400 (title `The navigation state is invalid.`, detail `Choose Pinned or Unpinned.`) and record save outcome `invalid` for every non-string or unbindable `state`, such as `{"state":5}`, `{"state":true}`, `{"state":{}}`, an empty body and malformed JSON. Today these fail at the framework's request-body binding before the endpoint runs, so the response is a generic 400 with no metric. Add these cases to the invalid-state theory in `tests/Clutch.API.Tests/Integration/Preferences/NavigationPreferenceTests.cs`. Fix in `src/Clutch.API/Api/Endpoints/NavigationPreferenceEndpoints.cs` per contracts/navigation-preferences.md and FR-008 (partial)
- [X] T032 Record the evidence for T028 and T029: tick the validated items in the plan.md UI compliance checklist (marking the N/A rows), move the Constitution Check rows from PENDING to their outcomes, and write the quickstart.md command results (pass/fail counts per command) into `specs/018-persist-nav-state/quickstart.md`, per plan: UI compliance checklist and T029 (partial)

## Phase 7: Convergence

- [X] T033 CRITICAL: Get `npx playwright test --config playwright.style-guide.config.ts` (10 failures: `nav-expanded`, `categories` and `surface lightness` at 1024 and 1440 px) and `--config playwright.ownership.config.ts` (the `categories journey`) passing. These are stale tests; commit `c7db67b` on branch `claude/hopeful-poincare-f513a2` already updates `src/clutch-web/e2e/style-guide.spec.ts` and `src/clutch-web/e2e/categories-groups.spec.ts`. Merging it needs the uncommitted 016/017 edits to `style-guide.spec.ts` in the working tree committed or reconciled first (ask the user). Rerun both configs per Constitution ENG-001 (partial)
- [X] T034 Investigate and fix or justify the failing `trash icons and focus indicators meet 3:1 non-text contrast in light mode` test (focus indicator ratio 1, needs 3) in `src/clutch-web/e2e/accounts-transaction-delete.spec.ts`; a baseline run at `3ee7739` could not start, so it is unknown whether 018 or earlier styling caused it. Rerun `npx playwright test --config playwright.transaction-delete.config.ts` per Constitution ENG-001 and WEB-001 (partial)
- [X] T035 Add a Vitest test in `src/clutch-web/src/App.test.tsx` where the navigation `PUT` never resolves: the hamburger flips `aria-expanded` at once, a second click flips it back, and no toast appears, proving feedback does not depend on how long saving takes per FR-010 and SC-005 (partial)
- [X] T036 Reconcile the hover-below-768px change (`src/clutch-web/src/lib/useMediaQuery.ts`, `src/clutch-web/src/App.tsx`, its Vitest and Playwright tests) with 018: it is traced to 011 FR-014 (2026-11-22), not to a 018 requirement, and 018 FR-009 says existing behaviour is unchanged. Add that trace to 018 `spec.md` FR-009 and `plan.md`, or move the change out of this feature, per plan: scope (ARC-001 do not add unrequested features) (unrequested)
- [X] T037 Stabilise three e2e tests that each failed once in a combined run and passed on rerun, in `src/clutch-web/e2e/startup.spec.ts` (`recovers automatically from a temporary session failure`), `src/clutch-web/e2e/accounts-transaction-delete.spec.ts` (`keyboard Tab, Enter, Space, and Shift+Tab…`) and `src/clutch-web/e2e/active-import.spec.ts` (`ended preview requires actor acknowledgement after reconnect…`), and make `src/clutch-web/e2e/import-settings.spec.ts` use the configured `baseURL` instead of a hardcoded `http://127.0.0.1:5173`, per Constitution ENG-001 (partial)
