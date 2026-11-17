---

description: "Implementation tasks for expandable left navigation"
---

# Tasks: Expandable Left Navigation

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [navigation-ui.md](contracts/navigation-ui.md), and [quickstart.md](quickstart.md)

**Tests**: The specification requires independent executable checks, and the constitution requires component and browser tests. Write each story's tests first and verify they expose the missing behavior before implementation.

**Format**: `[ID] [P?] [Story?] Description` where `[P]` indicates a task that can run concurrently with other marked tasks in the same phase without file conflicts or unmet dependencies.

## Phase 1: Setup

**Purpose**: Verify the existing frontend test environment without introducing unnecessary tooling.

- [X] T001 Check the existing commands and browser setup in `src/clutch-web/package.json` and `src/clutch-web/playwright.config.ts`; run `npm test -- src/App.test.tsx` from `src/clutch-web`, record baseline failures, and install dependencies only if the chosen validation fails because they are missing (ENG-001, WEB-001; pass when the baseline is recorded and prerequisites are usable).

## Phase 2: Foundational

**Purpose**: Establish a stable signed-in shell for all three stories without changing existing navigation.

- [X] T002 Refactor `src/clutch-web/src/App.tsx` only as needed to provide a signed-in shell that stays mounted across signed-in screen changes and recoverable session refresh errors but unmounts on initial loading, sign-out, or a 401; preserve page state, session errors, authorization, header actions, and existing navigation behavior, then rerun the `src/clutch-web/src/App.test.tsx` baseline (ARC-001, ENG-001, SEC-001, WEB-001; pass when existing tests pass and behavior is unchanged).

**Checkpoint**: The signed-in shell provides a stable boundary for pane state without changing the existing user journeys.

## Phase 3: User Story 1 - Navigate from any signed-in screen (Priority: P1)

**Goal**: Move Accounts and Categories into a left pane visible throughout the signed-in application.

**Independent Test**: Navigate from Accounts overview, account detail, import, Categories, and administrator settings using both pane controls; verify destination behavior, current markers, and absence of the pane while signed out or loading.

### Tests and implementation for User Story 1

- [X] T003 [US1] First extend `src/clutch-web/src/App.test.tsx` with role-based tests for pane visibility on signed-in screens and absence during loading, sign-out, and 401; verify Accounts clears account/import selection, Categories preserves existing state behavior, administrator access remains role-restricted, current markers are correct, and header actions and errors remain unchanged. Create `src/clutch-web/e2e/navigation.spec.ts` with controlled session and page responses, following `src/clutch-web/e2e/startup.spec.ts`, to exercise both destination buttons from each signed-in screen and verify pane absence during loading and signed-out states without external credentials. Confirm tests expose missing pane behavior, then move the existing Accounts and Categories buttons from the header into a left primary navigation pane in `src/clutch-web/src/App.tsx`, preserving their handlers, `aria-current` behavior, header controls, roles, and session handling; use existing Lucide icons and accessible named buttons without anchors. Rerun both tests (ARC-001, ENG-001, SEC-001, WEB-001; pass when both destinations and all visibility/current-state scenarios pass).

**Checkpoint**: Accounts and Categories remain usable from every signed-in screen in the initial pane state.

## Phase 4: User Story 2 - Expand and collapse navigation (Priority: P1)

**Goal**: Toggle between compact icon-only and expanded icon-and-label views without losing the choice during navigation.

**Independent Test**: Toggle in each direction and navigate to both destinations in each state; verify matching icons, labels, accessible names, and state lifecycle.

### Tests and implementation for User Story 2

- [X] T004 [US2] First extend `src/clutch-web/src/App.test.tsx` to assert compact initial state, toggle `aria-expanded`, label visibility, state retention across destinations and transient refresh errors, reset after sign-out or 401 and re-authentication, and unchanged sign-out/session error feedback. Extend `src/clutch-web/e2e/navigation.spec.ts` to toggle in both directions, verify the same destination icons in both states, labels only when expanded, both destinations in both states, and state retention across navigation. Confirm tests expose missing toggle/lifecycle behavior, then add a named hamburger toggle and transient compact/expanded state to the signed-in shell in `src/clutch-web/src/App.tsx`, preserving accessible names and icons in both states and using `aria-expanded`; ensure shell unmount resets state while screen navigation and recoverable refreshes do not. Rerun both tests (ARC-001, ENG-001, SEC-001, WEB-001; pass when all state transitions and both destinations work as specified).

**Checkpoint**: Both pane states are independently operable, remain selected across screens, and reset for a new signed-in session.

## Phase 5: User Story 3 - Use navigation across devices and input methods (Priority: P2)

**Goal**: Keep pane controls and page content accessible and usable on narrow and wide screens in all theme modes.

**Independent Test**: Exercise both pane states with keyboard and accessible names at 320-by-812 and 1280-by-720, verify side-by-side geometry and usable content on signed-in screens, and run theme and accessibility assertions.

### Tests and implementation for User Story 3

- [X] T005 [US3] First extend `src/clutch-web/src/App.test.tsx` with keyboard activation, accessible names, focus behavior, expanded-state reporting, active-destination semantics, and preserved theme/header controls in both pane states. Extend `src/clutch-web/e2e/navigation.spec.ts` to measure non-overlapping pane/content bounds at 320-by-812 and 1280-by-720 for both states on all signed-in screens; check usable content and controls, no page-level horizontal overflow, keyboard focus, pointer cursor, Light/Dark/System including both OS schemes, tagged axe checks plus executable contrast/layout assertions, and visible toggle/navigation response within 500 ms or a busy state with measurable progress when applicable. Run the tests and confirm any missing behavior is exposed before changes. Update `src/clutch-web/src/App.tsx` to keep the pane beside rather than over resizable content with semantic theme tokens, visible focus, pointer cursors, keyboard-accessible controls, and preserved theme behavior. Adjust only layout constraints proven to obstruct content beside the expanded pane in `src/clutch-web/src/features/accounts/AccountsPage.tsx`, `src/clutch-web/src/features/accounts/AccountDetails.tsx`, `src/clutch-web/src/features/imports/ImportPage.tsx`, `src/clutch-web/src/features/categories/CategoriesPage.tsx`, or `src/clutch-web/src/features/admin/ImportLimitsPage.tsx` and their directly affected child components, preserving existing actions and results. Rerun both tests (ENG-001, WEB-001, Principle VII; pass when all signed-in screens and pane controls remain reachable and usable without overlay at the required widths and all checks pass).

**Checkpoint**: Keyboard, accessible naming, side-by-side reflow, theme, timing, and automated accessibility checks pass for both pane states.

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate the complete feature and resolve review findings before completion.

- [X] T006 Run the focused component and browser commands in `specs/011-expand-navigation/quickstart.md` from `src/clutch-web`, including `npm test -- src/App.test.tsx` and `npm run test:e2e -- e2e/navigation.spec.ts --project=chromium`; fix failures and rerun affected checks (ENG-001, WEB-001; pass when all focused checks execute and pass without external credentials).
- [X] T007 Run relevant existing navigation, account/import, category, administrator, startup, and theme regression tests from `src/clutch-web/e2e/` using `src/clutch-web/playwright.config.ts` or the appropriate existing configuration; provide disposable services and protected state where needed, and do not treat skips or unavailable prerequisites as passes for required behavior (ENG-001, SEC-001, WEB-001; pass when relevant journeys execute successfully or equivalent executable coverage verifies each requirement).
- [X] T008 Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` in `src/clutch-web` as specified in `specs/011-expand-navigation/quickstart.md`; fix failures and rerun affected commands (ENG-001, WEB-001; pass when all four commands pass with zero lint warnings).
- [X] T009 Run `npm audit` for `src/clutch-web/package.json` and `src/clutch-web/package-lock.json`; remediate findings or report unresolved vulnerabilities as blockers, then rerun the audit and affected quality checks (ENG-001, SEC-001, WEB-001; pass when the required dependency check succeeds with no unresolved blocking findings).
- [X] T010 Obtain an independent OWASP Top 10 security review of all changed code under `src/clutch-web/src/` and `src/clutch-web/e2e/`, covering session boundaries, role restrictions, data exposure, and any changed dependencies; fix every finding and rerun relevant tests and review checks (ENG-001, SEC-001, WEB-001; pass when the independent review is complete and no findings remain unresolved).
- [X] T011 Update `specs/011-expand-navigation/quickstart.md` only if actual test paths or commands differ, and verify all scenarios and checks are executable without manual confirmation; report any unavailable required checks as blockers (ENG-001, WEB-001; pass when the guide matches runnable commands and all required outcomes have executable coverage).

## Dependencies & Execution Order

### Phase and story dependencies

```text
T001 → T002 → US1 (T003) → US2 (T004) → US3 (T005)
                    → cross-cutting validation and review (T006–T011)
```

US2 depends on the pane introduced by US1; US3 validates and adapts both pane states introduced by US1 and US2. This dependency is inherent in the shared UI; each story's checkpoint still supplies an independently testable increment. T005 may require no page-specific source change if its browser tests prove existing pages already reflow; it still verifies all listed screens.

### Within each story

- Each story task includes test writing, implementation, and validation; write tests first, confirm they expose any intended missing behavior, implement, then rerun them.
- Do not mark a story task complete if its required automated checks fail or cannot run.
- Finish implementation before final regression, quality, dependency, and independent security gates; address review findings and repeat affected checks.

### Parallel opportunities

- Within each story task, component tests in `App.test.tsx` and browser tests in `navigation.spec.ts` can be authored concurrently; the combined task remains open until implementation and all relevant tests pass.
- Do not run tasks that edit the same file concurrently. Final checks may run concurrently only when their processes and shared browser/server resources do not conflict; security review follows completed code.

## Implementation Strategy

### MVP first

Complete setup, the signed-in shell, and US1; execute its component and browser tests before proceeding. This delivers the requested destinations in the left pane, but US2 is also P1 and is required before the full expandable-navigation feature is complete.

### Incremental delivery

1. Establish the stable authenticated shell without changing existing behavior.
2. Deliver US1 and validate destination availability and existing navigation semantics.
3. Deliver US2 and validate toggling and session-scoped state.
4. Deliver US3 and validate responsive, keyboard, accessibility, theme, and timing requirements.
5. Execute cross-cutting quality gates and independent security review; do not declare completion with blockers.

## Phase 7: Convergence

- [X] T012 CRITICAL: Make the focused and current destination indicators in `src/clutch-web/src/App.tsx` meet WCAG 2.2 AA non-text contrast requirements against adjacent colors in Light and Dark modes, including both pane states; add executable contrast and focus/current-state checks in `src/clutch-web/e2e/navigation.spec.ts`, and run the relevant browser and component tests per Constitution VI, FR-006, FR-009 and FR-010 (contradicts).
- [X] T013 Remove the signed-in pane immediately after a successful sign-out in `src/clutch-web/src/App.tsx` even if the following session check fails with a non-401 error; preserve existing sign-out failure feedback and session handling, and add regression tests in `src/clutch-web/src/App.test.tsx` for successful logout followed by a failed session check and subsequent re-authentication per FR-008 and US1/AC4 (contradicts).
- [X] T014 Extend `src/clutch-web/e2e/navigation.spec.ts` to verify both pane states, Light/Dark/System themes and both System color schemes across all signed-in screens at 320-by-812 and 1280-by-720, with executable checks that representative page controls are visible, reachable and usable rather than only measuring container bounds; include relevant populated or interactive page states and run the browser checks per T005, FR-010, FR-011 and SC-005 (partial).

## Phase 8: Convergence

- [X] T015 CRITICAL: Make deeply nested categories and their Rename, Delete and inline editing controls remain reachable and usable without page-level horizontal overflow beside both pane states at 320-by-812 in `src/clutch-web/src/features/categories/CategoriesPage.tsx`, preserving category hierarchy and existing actions; add a browser regression using a valid hierarchy of at least six levels in `src/clutch-web/e2e/navigation.spec.ts`, verify the affected controls and absence of page-level horizontal overflow at both supported viewports, and run the relevant browser and component tests per Constitution VI, FR-010, SC-005 and T005 (contradicts).

## Phase 9: Hover Navigation

This phase supersedes earlier toggle, persistent expansion and side-by-side layout requirements where they conflict with the updated specification.

- [X] T016 Replace the hamburger control with mouse-hover expansion over page content, keyboard-focus expansion and direct touch navigation in `src/clutch-web/src/App.tsx`; preserve destination, session, accessibility and theme behavior, update component and browser tests and feature documentation, and verify overlay geometry and no content resizing at supported viewports per FR-003, FR-007, FR-009 and FR-010.

## Phase 10: Convergence

- [X] T017 CRITICAL: Make the hover- or keyboard-focus-expanded navigation in `src/clutch-web/src/App.tsx` dismissible with Escape without moving the pointer or focus, as required when additional content obscures page content; keep it dismissed until an appropriate new hover or focus interaction and preserve destination, touch and keyboard behavior. Add component and browser regressions for dismissal while hovered and while keyboard-focused, including focus and pointer remaining in place, per Constitution VI, WCAG 2.2 SC 1.4.13 and FR-010 (contradicts).
- [X] T018 Ensure the expanded navigation actually overlays the main page content at both 320-by-812 and 1280-by-720 without resizing or shifting the content in `src/clutch-web/src/App.tsx`; extend `src/clutch-web/e2e/navigation.spec.ts` to assert intersecting expanded pane and main content bounds and unchanged content geometry at both supported widths, while preserving compact navigation and page usability per FR-010, US2/AC1 and T016 (partial).

## Phase 11: Convergence

The user's clarification supersedes T018's requirement to force overlap at 1280px and the original T019 requirement to force it at 1920px. The pane overlays content only when their existing positions intersect.

- [X] T019 Preserve centered page content and avoid widening the pane merely to force overlap. Update `src/clutch-web/src/App.tsx` and `src/clutch-web/e2e/navigation.spec.ts` to verify unchanged content geometry at 320-by-812, 1280-by-720 and 1920-by-1080 and overlay only where content shares the pane's space, preserving compact navigation and page usability per US2/AC1 and FR-010.

## Phase 12: Convergence

- [X] T020 CRITICAL: Ensure keyboard focus remains visibly identifiable when the pointer keeps the expanded navigation hovered over page controls at 320-by-812, including the Categories inline rename Save button. Preserve the requested hover overlay, unchanged content geometry, Escape dismissal and page actions. Add an executable browser regression that keeps the pointer over the pane while tabbing into and operating the affected page control, and verifies that the focused control's indicator is not entirely obscured, per Constitution VI, WCAG 2.2 SC 2.4.7, FR-010 and SC-005 (contradicts).
