---

description: "Task list for Sticky List Headers"
---

# Tasks: Sticky List Headers

**Input**: `specs/030-sticky-list-headers/` (plan.md, spec.md, research.md, contracts/pinned-list-ui.md, quickstart.md)

**Revision 2026-11-28**: T001 to T011 built the first design, which the revised spec superseded;
they are kept as history and the files they name may no longer exist. The current work starts at
Phase 5.

**Tests**: REQUIRED. ENG-001 makes every behaviour change an explicit request for tests. Write
tests first and confirm they fail before implementing.

## Format: `- [ ] T### [P?] [US#?] Description with exact file path`

- **[P]**: parallel-safe (different files, no dependency). **[US#]**: user story label.

## Phase 1: Foundational (blocks all stories)

- [X] T001 Unit tests for every rule in contracts/held-header-ui.md "Hook" (scroller skips own region, clamp per FR-003, rAF batching, cleanup, focus R2) in `src/clutch-web/src/lib/useHeldTableHeader.test.ts`
- [X] T002 Implement `useHeldTableHeader` per contracts/held-header-ui.md "Hook" and research.md R1, R2 in `src/clutch-web/src/lib/useHeldTableHeader.ts` (FR-001, FR-002, FR-004, FR-005)

**Checkpoint**: lint, typecheck and T001 pass.

---

## Phase 2: User Story 1 - Transactions Header Stays Visible (Priority: P1) 🎯 MVP

**Goal**: The transactions header row stays at the top of the content panel while scrolling | **Independent Test**: Scroll a long account's transactions; the header stays in view and returns to place on scroll up.

- [X] T003 [P] [US1] Component tests: hook wired per contract "Table markup"; header, region and caption unchanged (FR-004, FR-005) in `src/clutch-web/src/features/accounts/TransactionsTable.test.tsx`
- [X] T004 [US1] Apply the hook per contracts/held-header-ui.md "Table markup" in `src/clutch-web/src/features/accounts/TransactionsTable.tsx` (FR-001, FR-004, FR-005)

**Checkpoint**: T001, T003 pass; lint and typecheck pass.

---

## Phase 3: User Story 2 - Assets Header Stays Visible, Totals Footer Scrolls (Priority: P2)

**Goal**: The assets header row stays in view; the totals `tfoot` keeps scrolling with the table | **Independent Test**: Scroll a long assets list; the header stays in view and totals appear only at the end.

- [X] T005 [P] [US2] Component tests: hook wired per contract "Table markup"; `tfoot` never offset (FR-003); header unchanged (FR-004, FR-005) in `src/clutch-web/src/features/assets/AssetsPage.test.tsx`
- [X] T006 [US2] Apply the hook per contracts/held-header-ui.md "Table markup", `tfoot` unchanged, in `src/clutch-web/src/features/assets/AssetsPage.tsx` (FR-002, FR-003, FR-004, FR-005)

**Checkpoint**: T005 passes; lint and typecheck pass.

---

## Phase 4: Completion Gates

- [X] T007 Held-header states per quickstart.md, both lists and themes, with snapshots (SC-001..SC-004, R2, Perf & Observability) in `src/clutch-web/e2e/style-guide.spec.ts` (WEB-001, ENG-001)
- [X] T008 Re-run existing journeys `src/clutch-web/e2e/assets.spec.ts` and `src/clutch-web/e2e/accounts-transaction-delete.spec.ts` per quickstart.md (FR-005, ENG-001)
- [X] T009 Validate every UI compliance checklist item in both themes, including plan "Style guide sections"; record each result in `specs/030-sticky-list-headers/validation.md` (WEB-001, `clutch-ui-style`)
- [X] T010 Run quickstart.md commands and completion quality gates (lint, typecheck, unit, build, browser); record results in `specs/030-sticky-list-headers/validation.md` (ENG-001, WEB-001, Perf & Observability)
- [X] T011 Run `/speckit-converge` and complete any tasks it appends before declaring the feature done (Workflow and Delivery Gates)

---

## Phase 5: Revision Foundational (blocks both stories)

- [X] T012 Unit tests for every rule in contracts/pinned-list-ui.md "Hook" in `src/clutch-web/src/lib/usePinnedList.test.ts`
- [X] T013 Implement `usePinnedList` per contracts/pinned-list-ui.md "Hook" and research.md R3, R4 in `src/clutch-web/src/lib/usePinnedList.ts` (FR-001, FR-002, FR-003, FR-006, FR-007)

**Checkpoint**: lint, typecheck and T012 pass.

---

## Phase 6: User Story 1 - Transactions Group Stays While Its List Scrolls (Priority: P1) 🎯 MVP

**Goal**: spec.md User Story 1 | **Independent Test**: as in spec.md User Story 1.

- [X] T014 [P] [US1] Component tests: markup per contract "Markup", including Load More and its error (FR-004, FR-005, FR-007) in `src/clutch-web/src/features/accounts/TransactionsTable.test.tsx`
- [X] T015 [US1] Apply contracts/pinned-list-ui.md "Markup" and research.md R5, R6 in `src/clutch-web/src/features/accounts/TransactionsTable.tsx` (FR-001, FR-004, FR-005, FR-007)

**Checkpoint**: T012, T014 pass; lint and typecheck pass.

---

## Phase 7: User Story 2 - Assets Group Stays While Its List Scrolls (Priority: P2)

**Goal**: spec.md User Story 2 | **Independent Test**: as in spec.md User Story 2.

- [X] T016 [P] [US2] Component tests: markup per contract "Markup", `tfoot` unchanged (FR-004, FR-005, FR-007) in `src/clutch-web/src/features/assets/AssetsPage.test.tsx`
- [X] T017 [US2] Apply contracts/pinned-list-ui.md "Markup" in `src/clutch-web/src/features/assets/AssetsPage.tsx` (FR-001, FR-004, FR-005)
- [X] T018 [US2] Remove `src/clutch-web/src/lib/useHeldTableHeader.ts`, its test and its snapshots; update the pointer in `docs/code-map.md`

**Checkpoint**: unit tests, lint and typecheck pass.

---

## Phase 8: Revision Completion Gates

- [X] T019 Replace the held-header states with the pinned-list states of quickstart.md, both lists and themes, with snapshots (SC-001..SC-005) in `src/clutch-web/e2e/style-guide.spec.ts` (WEB-001, ENG-001, Perf & Observability)
- [X] T020 Run every quickstart.md command and the dependency audit; record results in `specs/030-sticky-list-headers/validation.md` (ENG-001, WEB-001)
- [X] T021 Validate every UI compliance checklist item in both themes, including plan "Style guide sections", and record each in `specs/030-sticky-list-headers/validation.md` (WEB-001, `clutch-ui-style`)
- [X] T022 Run `/speckit-converge` and complete any tasks it appends before declaring the feature done (Workflow and Delivery Gates)

---

## Phase 9: User Story 3 - Amortization Schedule Group Stays While Its List Scrolls (Priority: P3)

**Goal**: spec.md User Story 3 | **Independent Test**: as in spec.md User Story 3.

- [X] T023 [P] [US3] Component tests for the list element and row window (research.md R7) in `src/clutch-web/src/features/mortgages/AmortizationSchedule.test.tsx`
- [X] T024 [P] [US3] Component tests for the schedule and chart views (FR-001, FR-008) in `src/clutch-web/src/features/mortgages/LoanPayoffTimeline.test.tsx`
- [X] T025 [US3] Apply the contract's schedule markup in `src/clutch-web/src/features/mortgages/AmortizationSchedule.tsx` (FR-004, FR-006, FR-007)
- [X] T026 [US3] Apply the contract's schedule markup in `src/clutch-web/src/features/mortgages/LoanPayoffTimeline.tsx` (FR-001, FR-002, FR-003, FR-008)

**Checkpoint**: unit tests, lint and typecheck pass.

---

## Phase 10: Extension Completion Gates

- [X] T027 Browser tests for the schedule; update the affected existing ones and baselines (SC-001..SC-005) in `src/clutch-web/e2e/style-guide.spec.ts`
- [X] T028 Run every quickstart.md command and the audit; record in `specs/030-sticky-list-headers/validation.md` (ENG-001, WEB-001, Perf & Observability)
- [X] T029 Revalidate the UI compliance checklist for the schedule in `specs/030-sticky-list-headers/validation.md` (WEB-001)
- [X] T030 Run `/speckit-converge` and complete any tasks it appends (Workflow and Delivery Gates)

---

## Dependencies & Execution Order

- Phase 9 → Phase 10. T025 needs T023; T026 needs T024 and T025.
- Phase 5 → Phase 6 → Phase 7 → Phase 8. T015 and T017 need T013. T018 needs T015 and T017. T019 needs T018. T022 runs last.

## Parallel Opportunities

- T014 and T016 (after T013); T015 and T017.

## Implementation Strategy

MVP = Phase 5 plus User Story 1. Deliver stories incrementally; each must pass its own tests before the next starts.
