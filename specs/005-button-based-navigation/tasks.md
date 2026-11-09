---
description: "Implementation tasks for button-based navigation and actions"
---

# Tasks: Button-Based Navigation and Actions

**Input**: Design documents from `/specs/005-button-based-navigation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-navigation.md

**Tests**: Automated component and browser tests are required by the plan and constitution; implement the regression tests before the corresponding behavior changes.

**Organization**: Tasks are grouped by user story so each story can be implemented and verified as an incremental delivery.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because the task edits different files and has no incomplete-task dependency.
- **[Story]**: User story served by the task (US1, US2).
- Every task names its target file or directory and applicable acceptance criteria.

## Phase 1: Setup

**Purpose**: Establish the control inventory and preserve the existing navigation/action contract.

- [X] T001 Update the control-to-callback inventory in `specs/005-button-based-navigation/contracts/ui-navigation.md`, covering conditional and permission-gated controls across `src/clutch-web/src/` and recording each existing destination, outcome, and pending/error behavior (FR-001, FR-002; ARC-001, WEB-001).

---

## Phase 2: Foundational

**Purpose**: Establish button styling shared by all user stories.

- [X] T002 Add consistent hand-pointer hover styling for shared and native buttons in `src/clutch-web/src/components/ui/button.tsx` and `src/clutch-web/src/index.css`, retaining visible focus, disabled behavior, theme tokens, and non-link button presentation (FR-004; WEB-001).

**Checkpoint**: Shared button styling is ready before story-specific control changes.

---

## Phase 3: User Story 1 - Navigate and take actions with buttons (Priority: P1) 🎯 MVP

**Goal**: Preserve all existing destinations, actions, permissions, and feedback using named native buttons instead of hyperlink controls.

**Independent Test**: Run the component and browser tests for each user-facing flow; verify button roles and names, expected destinations/action outcomes, preserved authorization and pending/error behavior, and no navigation/action control rendered as an anchor (FR-001, FR-002, FR-007; ENG-001, WEB-001).

### Tests for User Story 1

- [X] T003 [P] [US1] First add and run failing accessible-role/name and existing-outcome regression tests for session actions and family/account flows in `src/clutch-web/src/App.test.tsx`, `src/clutch-web/src/features/auth/AuthPage.test.tsx`, `src/clutch-web/src/features/families/FamilyPage.test.tsx`, `src/clutch-web/src/features/accounts/AccountsPage.test.tsx`, and `src/clutch-web/src/features/accounts/AccountDetails.test.tsx` (FR-001, FR-002; ENG-001, WEB-001).
- [X] T004 [P] [US1] First add and run failing accessible-role/name and preserved action/pending/error regression tests for transaction, import, and administrator controls in `src/clutch-web/src/features/accounts/TransactionsTable.test.tsx`, `src/clutch-web/src/features/imports/ImportPage.test.tsx`, and `src/clutch-web/src/features/admin/ImportLimitsPage.test.tsx`, including the `ImportMappingForm` flow in `src/clutch-web/src/features/imports/ImportMappingForm.tsx` (FR-001, FR-002; ENG-001, WEB-001).
- [X] T005 [P] [US1] First extend and run failing end-to-end assertions for existing family/account/import and administrator journeys by button role/name and no navigation/action anchors in `src/clutch-web/e2e/family-accounts-import.spec.ts` and `src/clutch-web/e2e/admin-import-limits.spec.ts` (FR-001, FR-002, FR-007; ENG-001, WEB-001).

### Implementation for User Story 1

- [X] T006 [P] [US1] Ensure session retry, administrator entry, sign-out, and sign-in/register controls in `src/clutch-web/src/App.tsx` and `src/clutch-web/src/features/auth/AuthPage.tsx` are named native buttons and preserve role checks, existing outcomes, and pending/error feedback (FR-001, FR-002; SEC-001, WEB-001).
- [X] T007 [P] [US1] Ensure family creation, account selection/back/import, and transaction actions in `src/clutch-web/src/features/families/FamilyPage.tsx`, `src/clutch-web/src/features/accounts/AccountsPage.tsx`, `src/clutch-web/src/features/accounts/AccountDetails.tsx`, and `src/clutch-web/src/features/accounts/TransactionsTable.tsx` are named native buttons with existing callbacks and outcomes (FR-001, FR-002; SEC-001, WEB-001).
- [X] T008 [P] [US1] Ensure import navigation, file-selection/action controls, and administrator settings controls in `src/clutch-web/src/features/imports/ImportPage.tsx`, `src/clutch-web/src/features/imports/ImportMappingForm.tsx`, and `src/clutch-web/src/features/admin/ImportLimitsPage.tsx` are presented as buttons and retain account association, authorization, pending states, results, and errors (FR-001, FR-002; SEC-001, WEB-001).

**Checkpoint**: User Story 1 is independently testable through its component and browser journeys.

---

## Phase 4: User Story 2 - Use controls accessibly across devices (Priority: P2)

**Goal**: Keep navigation and actions identifiable and operable by keyboard across responsive layouts and all theme modes.

**Independent Test**: Use automated keyboard-only browser tests to activate controls and verify destination-heading focus; check hover cursor, visible focus, 320×812 and 1280×720 viewports, Light/Dark/System behavior, axe-core WCAG 2.2 AA results, and response/busy-state timing (FR-003 through FR-006, FR-008; ENG-001, WEB-001).

### Tests for User Story 2

- [X] T009 [US2] First add and run failing browser assertions for keyboard activation, focus handoff to destination headings, visible focus, pointer cursor, responsive layouts, Light/Dark/System behavior, axe-core WCAG 2.2 AA, and 500 ms response or busy/progress feedback in `src/clutch-web/e2e/startup.spec.ts`, `src/clutch-web/e2e/family-accounts-import.spec.ts`, `src/clutch-web/e2e/admin-import-limits.spec.ts`, and `src/clutch-web/e2e/theme-selector.spec.ts` (FR-003 through FR-006, FR-008; ENG-001, WEB-001).

### Implementation for User Story 2

- [X] T010 [US2] Move focus to the primary heading after each in-app view transition, and ensure the destination headings expose a programmatic focus target in `src/clutch-web/src/App.tsx`, `src/clutch-web/src/features/families/FamilyPage.tsx`, `src/clutch-web/src/features/accounts/AccountsPage.tsx`, `src/clutch-web/src/features/accounts/AccountDetails.tsx`, `src/clutch-web/src/features/imports/ImportPage.tsx`, and `src/clutch-web/src/features/admin/ImportLimitsPage.tsx`; preserve native keyboard behavior, visible focus, and existing theme and async-action behavior (FR-003, FR-005, FR-006, FR-008; ENG-001, WEB-001).

**Checkpoint**: User Story 2 is independently verified with keyboard, responsive, theme, accessibility, and feedback-timing browser checks.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Update the execution guide, complete security review, and pass frontend quality gates.

- [X] T011 [P] Update `specs/005-button-based-navigation/quickstart.md` with the production-build command and the executable component, browser, accessibility, and authenticated-journey prerequisites used to validate this feature; keep manual testing optional (ENG-001, WEB-001).
- [X] T012 Obtain an independent OWASP Top 10 review of changed controls in `src/clutch-web/src/`, remediate every finding, and identify any unresolved blocking risk (SEC-001).
- [X] T013 Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm run test:e2e` from `src/clutch-web/package.json`; resolve failures and verify the feature's no-anchor, keyboard, accessibility, theme, and timing assertions pass (ENG-001, WEB-001).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 records the contract inventory before implementation.
- **Foundational (Phase 2)**: T002 establishes shared button styling before user-story changes.
- **User Story 1 (Phase 3)**: T003-T005 add regression tests before T006-T008 implement the corresponding flows.
- **User Story 2 (Phase 4)**: Depends on User Story 1's button-based controls; T009 adds accessibility/browser tests before T010 implements focus handoff and any gaps they expose.
- **Polish (Phase 5)**: T011-T013 follow both stories; complete the independent security review and remediation before final quality gates.

### User Story Dependencies

- **User Story 1 (P1)**: Starts after the foundational styling; no dependency on another user story.
- **User Story 2 (P2)**: Depends on User Story 1's implemented controls so keyboard, focus, responsive, theme, and accessibility behavior can be verified on the completed button-based journeys.

### Within Each User Story

- Write and run regression tests before implementing the corresponding behavior.
- Preserve native button semantics, current callbacks and permissions, pending states, results, and error feedback.
- Keep each story independently testable using its stated browser and component criteria.

### Parallel Opportunities

- After T002, T003, T004, and T005 can be authored in parallel because they modify distinct component-test and browser-test files.
- After those tests are in place, T006, T007, and T008 can be implemented in parallel because they cover separate application/auth, family/account, and import/administrator source files.
- T009 and T010 remain sequential because the accessibility browser assertions should be added before the focus behavior they verify.
- T011 can proceed in parallel with T012 once the implementation stories are complete.

### Parallel Example: User Story 1

```text
After T002, author T003, T004, and T005 in parallel.
After those tests are in place, implement T006, T007, and T008 in parallel.
```

### Implementation Strategy

1. Complete setup and foundational button styling.
2. Deliver **MVP: User Story 1** with behavior tests first, then verify every existing navigation/action flow and its preserved outcome.
3. Add User Story 2 focus, keyboard, responsive, theme, accessibility, and timing coverage.
4. Complete independent security review and remediation, then run all frontend checks and browser tests.

## Phase 6: Convergence

- [X] T014 Add agent-executable axe-core coverage for every rendered web-client view and key state in Light, Dark, and System modes at supported narrow and desktop viewports per SC-006 (partial)
- [X] T015 Make authenticated account, import, and administrator browser journeys executable with agent-usable fixtures, then verify they run rather than skip per T013 / ENG-001 (partial)
- [X] T016 Obtain and record the independent OWASP Top 10 review of changed controls and resolve its findings per SEC-001 (missing)
