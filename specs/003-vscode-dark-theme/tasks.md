---
description: "Implementation tasks for the VS Code-inspired dark theme"
---

# Tasks: VS Code-Inspired Dark Theme

**Input**: Design documents from `specs/003-vscode-dark-theme/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/theme-ui.md`

**Tests**: Included because the specification requires measurable contrast, accessibility, theme-preservation, and visual-hierarchy validation.

**Organization**: Tasks are grouped by user story so each increment can be implemented and verified against its independent test criteria.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Tasks that can run in parallel because they touch different files and have no incomplete-task dependencies.
- **[Story]**: The user story addressed by the task.
- Every task names the file or files to change or validate.

## Phase 1: Setup

**Purpose**: Project initialization

No project initialization is needed. The existing `src/clutch-web` app, semantic theme tokens, Vitest, Playwright, and axe-core are already in place.

---

## Phase 2: Foundational

**Purpose**: Blocking prerequisites for all user stories

No new shared infrastructure is required; the existing theme-token layer and browser test tooling support the planned work.

---

## Phase 3: User Story 1 - Use a cohesive dark appearance (Priority: P1)

**Goal**: Provide a coordinated VS Code-inspired dark palette throughout the existing application while preserving the light theme.

**Independent Test**: With system dark mode enabled, representative authentication, family/account, import, and admin screens use coordinated charcoal surfaces, readable text, and a restrained blue accent; dark-mode axe checks pass. With light mode enabled, the existing light appearance remains unchanged.

### Tests for User Story 1

- [ ] T001 [P] [US1] Extend dark-mode palette and WCAG 2.2 axe checks, and confirm light-theme preservation, across authentication, family, account, and import journeys in `src/clutch-web/e2e/family-accounts-import.spec.ts` (ENG-001, WEB-001).
- [ ] T002 [P] [US1] Add dark-mode palette and WCAG 2.2 axe checks, and confirm light-theme preservation, for the administrator import-limits screen in `src/clutch-web/e2e/admin-import-limits.spec.ts` (ENG-001, WEB-001).

### Implementation for User Story 1

- [ ] T003 [US1] Replace only the `.dark` semantic token values in `src/clutch-web/src/index.css` with the researched VS Code-inspired OKLCH palette; check normal text at 4.5:1, large text at 3:1, and meaningful non-text indicators at 3:1 after alpha compositing, while leaving every `:root` light token unchanged (WEB-001).

**Checkpoint**: Dark and light appearance checks pass for the independently testable application journeys.

---

## Phase 4: User Story 2 - Distinguish interface sections (Priority: P2)

**Goal**: Make navigation, primary content, and adjacent panels distinct through coordinated surfaces, spacing, and subtle separators.

**Independent Test**: In dark mode, the application header/navigation and main content have distinguishable surfaces, and multi-section account/import views show clear hierarchy without bright dividers.

### Tests for User Story 2

- [ ] T004 [P] [US2] Add browser assertions for navigation/content surface distinction and section hierarchy in the dark-mode family, account, and import journey; record each adjacent section pair's distinct semantic surface tokens or separating spacing treatment in `src/clutch-web/e2e/family-accounts-import.spec.ts` (ENG-001, WEB-001).
- [ ] T005 [P] [US2] Add browser assertions for distinct header, form, and panel surfaces on the dark-mode administrator screen; record each adjacent section pair's distinct semantic surface tokens or separating spacing treatment in `src/clutch-web/e2e/admin-import-limits.spec.ts` (ENG-001, WEB-001).

### Implementation for User Story 2

- [ ] T006 [US2] Apply semantic surface tokens and appropriate spacing/separators to the shared header and main content in `src/clutch-web/src/App.tsx` and to section and panel boundaries in `src/clutch-web/src/features/auth/AuthPage.tsx`, `src/clutch-web/src/features/families/FamilyPage.tsx`, `src/clutch-web/src/features/accounts/AccountsPage.tsx`, `src/clutch-web/src/features/accounts/AccountDetails.tsx`, `src/clutch-web/src/features/accounts/TransactionsTable.tsx`, `src/clutch-web/src/features/imports/ImportPage.tsx`, `src/clutch-web/src/features/imports/ImportMappingForm.tsx`, `src/clutch-web/src/features/imports/ImportReviewTable.tsx`, and `src/clutch-web/src/features/admin/ImportLimitsPage.tsx`; keep layout mobile-first and avoid changing light-mode styling (WEB-001).

**Checkpoint**: Dark-mode navigation and adjacent content regions are independently distinguishable at desktop and narrow viewport widths.

---

## Phase 5: User Story 3 - Keep theme preferences and interactions usable (Priority: P3)

**Goal**: Preserve system-preference theme behavior and keep interactive, focus, selected, disabled, status, and error states perceivable.

**Independent Test**: Changing the emulated system color scheme updates the root `.dark` class and remains unchanged across supported navigation/reload behavior. Keyboard focus and representative hover, selected, and disabled states remain visible and readable; status/error meaning is not conveyed by color alone.

### Tests for User Story 3

- [ ] T007 [P] [US3] Add component tests for initial `prefers-color-scheme` application, the light `:root` fallback when dark does not match, media-query change handling, and listener cleanup in `src/clutch-web/src/components/theme/ThemeProvider.test.tsx`; assert no application-level selector or persistence is introduced (ENG-001, WEB-001).
- [ ] T008 [P] [US3] Extend the dark-mode keyboard, selected-checkbox, disabled-confirmation, and status/error accessibility checks in `src/clutch-web/e2e/family-accounts-import.spec.ts` (ENG-001, WEB-001).

### Implementation for User Story 3

- [ ] T009 [US3] Adjust only failing dark-mode focus, hover, selected, disabled, and validation-state treatments in `src/clutch-web/src/components/ui/button.tsx`, `src/clutch-web/src/features/auth/AuthPage.tsx`, `src/clutch-web/src/features/accounts/AccountsPage.tsx`, `src/clutch-web/src/features/imports/ImportMappingForm.tsx`, `src/clutch-web/src/features/imports/ImportReviewTable.tsx`, and `src/clutch-web/src/features/admin/ImportLimitsPage.tsx`; preserve control behavior and ensure labels or other non-color cues identify status and error states (WEB-001).

**Checkpoint**: Theme preference behavior is unchanged and representative interactive states are perceivable in dark mode.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Confirm full acceptance, quality gates, and governance requirements.

- [ ] T010 Run the browser, contrast, responsive, keyboard, and light-theme review in `specs/003-vscode-dark-theme/quickstart.md` across every existing screen and shared UI area; record the screen/area coverage and, for every adjacent section pair, its distinct semantic surface tokens or measured separating spacing; verify every applicable text item, interactive control, focus indicator, and meaningful non-text boundary; resolve acceptance gaps in the corresponding source or test files (ENG-001, WEB-001).
- [ ] T011 Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm run test:e2e` from `src/clutch-web/` as defined in `src/clutch-web/package.json`; resolve failures and rerun the affected checks (ENG-001).
- [ ] T012 Complete the independent OWASP Top 10 review required by SEC-001 for the changed frontend files identified in `specs/003-vscode-dark-theme/plan.md`; address and verify any findings before completion.
- [ ] T013 Run `npm audit` from `src/clutch-web/` to check existing frontend dependencies for known vulnerabilities; remediate findings before completion (SEC-001).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No tasks; the project and frontend test infrastructure already exist.
- **Foundational (Phase 2)**: No tasks; existing theme tokens and test tooling are sufficient.
- **User Stories (Phase 3+)**: Execute in priority order because later visual-state and hierarchy checks depend on the dark palette established by User Story 1.
- **Polish (Phase 6)**: Depends on completion of all desired user stories.

### User Story Dependencies

- **User Story 1 (P1)**: No story dependency; establishes the global dark palette and preserves light tokens.
- **User Story 2 (P2)**: Depends on User Story 1's palette so surface hierarchy uses the final semantic colors.
- **User Story 3 (P3)**: Depends on User Story 1's palette and User Story 2's shared surface treatment so state contrast is verified against final surfaces. Theme selection itself remains system-preference-driven.

### Within Each User Story

- Write or extend that story's tests before its implementation and verify the assertions against the current behavior.
- Complete the story's implementation before proceeding to the next priority.
- The [P] tasks use different files and may run concurrently.

### Parallel Opportunities

- T001 and T002 can be completed in parallel because they modify separate e2e spec files.
- T004 and T005 can be completed in parallel because they modify separate e2e spec files.
- T007 and T008 can be completed in parallel because they modify separate test files.
- After User Story 1, the US2 hierarchy test and US3 theme-provider tests can be prepared independently if their implementations are deferred until their story's turn.
- The SEC-001 review (T012) is a final independent review after implementation; it must not be used to replace required tests or quality checks.

## Parallel Example: User Story 1

```text
Task: T001 - Extend dark-mode checks in src/clutch-web/e2e/family-accounts-import.spec.ts
Task: T002 - Add dark-mode checks in src/clutch-web/e2e/admin-import-limits.spec.ts
```

## Parallel Example: User Story 2

```text
Task: T004 - Add section hierarchy checks in src/clutch-web/e2e/family-accounts-import.spec.ts
Task: T005 - Add panel hierarchy checks in src/clutch-web/e2e/admin-import-limits.spec.ts
```

## Parallel Example: User Story 3

```text
Task: T007 - Add ThemeProvider system-preference regression tests in src/clutch-web/src/components/theme/ThemeProvider.test.tsx
Task: T008 - Extend dark-mode interaction checks in src/clutch-web/e2e/family-accounts-import.spec.ts
```

## Implementation Strategy

- **MVP**: Complete User Story 1 only: update the dark semantic palette, prove contrast/accessibility across representative screens, and confirm the light theme is unchanged.
- **Incremental delivery**: Add section hierarchy in User Story 2, then validate and refine interaction states and existing system-preference behavior in User Story 3.
- **Completion gate**: Run all quickstart checks, frontend quality scripts, the dependency vulnerability check, and the independent SEC-001 review after the selected stories are implemented.
