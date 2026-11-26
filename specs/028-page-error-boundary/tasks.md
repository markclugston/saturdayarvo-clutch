# Tasks: Page Error Boundary

**Input**: `specs/028-page-error-boundary/` (plan.md, spec.md, quickstart.md)

**Tests**: REQUIRED. Write tests first and confirm they fail before implementing. Paths below are
relative to `src/clutch-web/`.

## Phase 3: User Story 1 - Keep Using the App When a Page Fails (Priority: P1) 🎯 MVP

**Goal**: A failing page leaves the app usable. | **Independent Test**: Force a page to fail, navigate and retry.

- [X] T001 [P] [US1] Component tests for the boundary and root error options (FR-002–FR-004, FR-007, FR-008) in `src/components/error-boundary/PageErrorBoundary.test.tsx`
- [X] T002 [P] [US1] App tests: shell kept, navigation clears error, add form isolated, unsaved flag cleared (FR-001, FR-005, FR-006) in `src/App.errorBoundary.test.tsx`
- [X] T003 [US1] Confirm T001 and T002 fail for the expected reason
- [X] T004 [US1] Boundary component in `src/components/error-boundary/PageErrorBoundary.tsx`
- [X] T005 [P] [US1] Caught and recoverable error handlers in `src/components/error-boundary/rootErrorOptions.ts`, passed to `createRoot` in `src/main.tsx`
- [X] T006 [US1] Wrap page content (keyed by destination) and the add form in `src/App.tsx`
- [X] T007 [P] [US1] Add the boundary pointer to `../../docs/code-map.md`

**Checkpoint**: story tests, typecheck and lint pass.

## Phase 4: User Story 2 - Recover When the App Itself Fails (Priority: P2)

**Goal**: No blank window. | **Independent Test**: Force the header or sign-in screen to fail, then retry.

- [X] T012 [P] [US2] Tests for the app-level boundary and uncaught handler (FR-008–FR-010) in `src/components/error-boundary/PageErrorBoundary.test.tsx`
- [X] T013 [P] [US2] App tests: header and sign-in failures, retry reloads the session (FR-009, FR-010) in `src/App.errorBoundary.test.tsx`
- [X] T014 [US2] Confirm T012 and T013 fail for the expected reason
- [X] T015 [US2] `AppErrorBoundary` in `src/components/error-boundary/PageErrorBoundary.tsx` and the uncaught handler in `rootErrorOptions.ts`
- [X] T016 [US2] Wrap the app tree in `src/App.tsx`
- [X] T017 [US2] Browser cases for app-level failures in both themes in `e2e/error-boundary.spec.ts` (WEB-001)
- [X] T018 [US2] Security review, UI checklist, quality gates and converge over the amended feature

**Checkpoint**: story's tests pass; then all completion gates.

## Completion Gates

- [X] T008 Browser test in both themes (axe, focus ring, retry, navigation, console, screenshots) in `e2e/error-boundary.spec.ts` (WEB-001)
- [X] T009 Independent security review of this feature's diff (SEC-001, SEC-003, `clutch-security-review`)
- [X] T010 Validate the UI compliance checklist in both themes (`clutch-ui-style`)
- [X] T011 Run completion quality gates and record results (test cadence in `clutch-frontend`)

## Dependencies & Execution Order

- T001–T003 before T004–T006; T006 needs T004; gates last.

## Parallel Opportunities

- US1: T001, T002.

## Implementation Strategy

Single story; deliver whole.

## Results after Phase 4 (2026-11-26, final)

- **T014**: the 4 new tests failed (blank app, missing export, silent uncaught handler).
- **Found by the browser test**: the repeat-failure message never appeared when retried content showed a
  loading step first. FR-004 and FR-010 now say "failed to display again"; its 3 tests failed before the fix.
- **Unit and component**: 802/802 at the default timeout.
- **Lint, typecheck, build, `npm audit --omit=dev`**: pass; 0 vulnerabilities. Lint and build failed once
  on test files another session was part-way through editing, and passed once it finished.
- **Browser**: `error-boundary.spec.ts` 8/8; `navigation.spec.ts` and `startup.spec.ts` 42/42.
- **Not run**: `style-guide.spec.ts` and the integration journeys.
- **UI checklist**: as below, plus the app-level message checked in both themes.
- **Security review** (separate pass by the implementing session): no findings. The low item recorded after
  Phase 3 is closed. A failure in the theme or query providers themselves shows no message but prints only
  the fixed notice.
- **Converge**: no remaining work.

## Results after Phase 3 (superseded where they differ)

Run in a checkout shared with other sessions, which were editing files and running tests at the same time.

- **T003**: 4 App tests failed with the shell blanked; the component suite failed on the missing module.
- **Unit and component**: 798/798 with `--testTimeout=30000` on the command line. At the default 5 s, 8
  tests timed out or failed under load in the first full run; none of the test files cover the new code
  except `App.test.tsx`, which passed on rerun.
- **Lint, typecheck, build, `npm audit --omit=dev`**: pass; 0 vulnerabilities.
- **Browser**: `error-boundary.spec.ts` 4/4. With `navigation.spec.ts` and `startup.spec.ts`: 44/46; the two
  failures (a 2.5 s timing limit at 2.53 s, a session attempt count) passed twice each on rerun with one worker.
- **Not run**: `style-guide.spec.ts` (a healthy page renders no new elements) and the integration journeys
  (need Docker and the real API).
- **UI checklist**: lint (tokens, alignment), axe WCAG 2.2 AA, focus outline and screenshots in both themes.
- **Security review** (separate pass by the implementing session, not a second reviewer): OWASP Top 10,
  secrets, sensitive data, dependencies. No findings in this diff. Pre-existing, low, not changed: a render
  error outside the boundaries (header, navigation, sign-in screen) still blanks the app and React prints
  the raw error to the console.
- **Converge**: no remaining work.
