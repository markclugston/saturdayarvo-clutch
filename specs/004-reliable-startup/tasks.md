# Tasks: Reliable Startup Loading

**Input**: Design documents from `specs/004-reliable-startup/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/startup-ui.md`, `quickstart.md`

**Tests**: Included because the plan and measurable acceptance criteria require executable component, application, browser, timing, and accessibility checks.

## Phase 1: Setup

**Purpose**: Keep this change within the existing frontend project and tooling.

- [X] T001 [ENG-001] [WEB-001] Confirm the existing test and browser-test scripts in `src/clutch-web/package.json`; verify that the planned checks use those scripts and retain current dependencies, API contracts, and theme behavior.

---

## Phase 2: Foundational

**Purpose**: Establish prerequisites shared by all user stories.

No new foundational infrastructure is required. The feature uses the existing React application, session query, authentication page, API client, and theme provider.

---

## Phase 3: User Story 1 - See a clear startup state (Priority: P1)

**Goal**: Keep the sign-in experience visible under an accessible, full-viewport blocking loading dialog while startup session discovery is in progress.

**Independent Test**: Delay the session response and verify the sign-in page is rendered beneath a dimmed modal; background controls and focus are blocked until a confirmed signed-out result closes the dialog.

### Tests for User Story 1

- [X] T002 [P] [US1] [ENG-001] [WEB-001] Add Dialog component tests for its accessible name, loading announcement, and active-check dismissal behavior in `src/clutch-web/src/features/auth/StartupLoadingDialog.test.tsx`.
- [X] T003 [P] [US1] [ENG-001] [WEB-001] Add app tests proving delayed session discovery keeps the sign-in page behind the Dialog, hides private UI, and unlocks sign-in after HTTP 401 in `src/clutch-web/src/App.test.tsx`.
- [X] T004 [P] [US1] [ENG-001] [WEB-001] Add browser checks for full-viewport dimming, modal focus/background blocking, keyboard behavior, and Axe accessibility at 320x812 and 1280x720 in Light, Dark, and System modes in `src/clutch-web/e2e/startup.spec.ts`.

### Implementation for User Story 1

- [X] T005 [US1] [ENG-001] [WEB-001] Add the project-owned shadcn/ui Dialog primitive through the configured shadcn CLI under `src/clutch-web/src/components/ui/`, then implement a responsive `StartupLoadingDialog` with an accessible loading label/status and no dismissal while checking in `src/clutch-web/src/features/auth/StartupLoadingDialog.tsx`.
- [X] T006 [US1] [ENG-001] [SEC-001] [SEC-003] [WEB-001] Render `AuthPage` behind `StartupLoadingDialog` during initial session discovery and expose signed-in content only after session validation in `src/clutch-web/src/App.tsx`; verify with the delayed-session and signed-out tests.

**Checkpoint**: A delayed session check shows a blocking, accessible loading state over the existing sign-in page; a confirmed signed-out result restores normal sign-in interaction.

---

## Phase 4: User Story 2 - Recover from slow startup automatically (Priority: P1)

**Goal**: Automatically retry only transient session failures during a 30-second recovery window, while bounding requests and the overall startup check.

**Independent Test**: Simulate a transient failure that resolves within 20 seconds and verify automatic arrival at the correct destination; also verify a never-settling request cannot prevent the startup flow from settling within 45 seconds.

### Tests for User Story 2

- [X] T007 [P] [US2] [ENG-001] [WEB-001] Add controlled-timer app tests for transient recovery within 30 seconds, no retry for HTTP 401 or non-transient errors, and the 45-second overall bound in `src/clutch-web/src/App.test.tsx`.
- [X] T008 [P] [US2] [ENG-001] [WEB-001] Add session-client tests for forwarding cancellation and timing out a request after 8 seconds in `src/clutch-web/src/features/auth/api.test.ts`.
- [X] T009 [P] [US2] [ENG-001] [WEB-001] Add a browser startup scenario that recovers from a temporary session failure without manual retry and reaches the correct destination in `src/clutch-web/e2e/startup.spec.ts`.

### Implementation for User Story 2

- [X] T010 [US2] [ENG-001] [SEC-001] [SEC-003] [WEB-001] Update `getSession` to accept the query cancellation signal and combine it with an 8-second request timeout without changing the existing session endpoint or response validation in `src/clutch-web/src/features/auth/api.ts`; verify cancellation and timeout tests.
- [X] T011 [US2] [ENG-001] [SEC-001] [SEC-003] [WEB-001] Pass TanStack Query's cancellation signal to `getSession` and replace the attempt-count retry policy with the specified 30-second transient recovery window and 45-second overall bound in `src/clutch-web/src/App.tsx`; verify controlled-timer outcomes.

**Checkpoint**: Temporary network, timeout, and HTTP 502/503/504 failures recover automatically within the window; cancellation, HTTP 401, and other failures are not retried as transient errors.

---

## Phase 5: User Story 3 - Recover from a persistent startup failure (Priority: P2)

**Goal**: Show an accessible error and a retry action when startup fails, without presenting unresolved authentication as signed out or exposing private content.

**Independent Test**: Keep the service unavailable through the recovery window and verify a visible retryable error; restore service, select retry, and verify loading feedback appears within 500 milliseconds and startup completes without navigation.

### Tests for User Story 3

- [X] T012 [P] [US3] [ENG-001] [WEB-001] Add app tests for persistent transient and non-transient errors, private-content gating, and retry transitioning back to the loading state within 500 milliseconds, using controlled timers, in `src/clutch-web/src/App.test.tsx`.
- [X] T013 [P] [US3] [ENG-001] [WEB-001] Add browser checks for accessible error announcement, retry without page reload, the successful post-retry destination, and Axe accessibility at 320x812 and 1280x720 in Light, Dark, and System modes in `src/clutch-web/e2e/startup.spec.ts`.

### Implementation for User Story 3

- [X] T014 [US3] [ENG-001] [SEC-001] [SEC-003] [WEB-001] Present a responsive, accessible startup error and retry action after a non-transient failure or bounded recovery; restart the blocking loading state on retry and keep private content hidden until session confirmation in `src/clutch-web/src/App.tsx`; verify with app and browser tests.

**Checkpoint**: Every unresolved startup failure ends in a clear retryable error, and retry starts a fresh bounded check without reloading the application.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verify the full startup flow against the feature's accessibility, responsiveness, theme, and quality requirements.

- [X] T015 [ENG-001] [WEB-001] Run the focused component tests, browser startup tests at 320x812 and 1280x720 in Light, Dark, and System modes, typecheck, lint, build, and `npm audit` commands from `specs/004-reliable-startup/quickstart.md`; resolve relevant failures and report any unresolved pre-existing dependency findings.
- [X] T016 [SEC-001] Complete the required independent OWASP Top 10 review of the changed startup flow in `src/clutch-web/src/App.tsx`, `src/clutch-web/src/features/auth/api.ts`, `src/clutch-web/src/features/auth/StartupLoadingDialog.tsx`, and `src/clutch-web/src/components/ui/dialog.tsx`; resolve and verify any findings.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: No new tasks; existing application infrastructure is already in place.
- **User Story 1 (Phase 3)**: Starts after setup; establishes the shared loading presentation.
- **User Story 2 (Phase 4)**: Depends on User Story 1 because automatic recovery must preserve its blocking loading state.
- **User Story 3 (Phase 5)**: Depends on User Story 2 because its terminal error and retry behavior follows the bounded automatic recovery flow.
- **Polish (Phase 6)**: Depends on all three user stories.

### User Story Dependencies

- **US1 (P1)**: No story dependency; implement and validate first.
- **US2 (P1)**: Depends on US1's loading presentation.
- **US3 (P2)**: Depends on US2's bounded recovery outcome.

### Parallel Opportunities

- T002, T003, and T004 work in separate test files and can be prepared in parallel.
- T007, T008, and T009 work in separate test files and can be prepared in parallel after US1.
- T012 and T013 work in separate test files and can be prepared in parallel after US2.
- Within each story, complete its tests before the corresponding implementation tasks. T010 must precede T011 because the query integration calls the updated session client.
- User stories are sequential in this feature because they share the startup states and application integration.

### Parallel Example: User Story 1

```text
Task: T002 dialog component tests in src/clutch-web/src/features/auth/StartupLoadingDialog.test.tsx
Task: T003 startup integration tests in src/clutch-web/src/App.test.tsx
Task: T004 browser modal tests in src/clutch-web/e2e/startup.spec.ts
```

### Parallel Example: User Story 2

```text
Task: T007 controlled retry and timing tests in src/clutch-web/src/App.test.tsx
Task: T008 session request timeout tests in src/clutch-web/src/features/auth/api.test.ts
Task: T009 automatic-recovery browser test in src/clutch-web/e2e/startup.spec.ts
```

### Parallel Example: User Story 3

```text
Task: T012 error and retry integration tests in src/clutch-web/src/App.test.tsx
Task: T013 error and retry browser test in src/clutch-web/e2e/startup.spec.ts
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete T001, then T002-T006.
2. Validate the loading dialog and signed-out state independently.
3. Add automatic recovery (US2), then bounded error and retry behavior (US3).
4. Run all quickstart checks and complete the independent security review.

### Incremental Delivery

- Deliver US1 to replace the blank startup screen with an accessible, blocking loading experience.
- Deliver US2 to recover automatically from temporary service startup failures.
- Deliver US3 to ensure persistent or non-temporary failures have a safe, actionable retry path.

## Phase 7: Convergence

- [X] T017 CRITICAL: Complete and record an independent OWASP Top 10 review of the startup flow in `src/clutch-web/src/App.tsx`, `src/clutch-web/src/features/auth/api.ts`, `src/clutch-web/src/features/auth/StartupLoadingDialog.tsx`, and `src/clutch-web/src/components/ui/dialog.tsx` per Constitution V (missing); review completed with no vulnerabilities found.
