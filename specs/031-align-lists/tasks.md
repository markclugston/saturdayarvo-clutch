# Tasks: Align Existing Lists

**Input**: `specs/031-align-lists/` (plan.md, spec.md, contracts/list-ui.md)

**Tests**: REQUIRED (ENG-001). Write tests first and confirm they fail before implementing.

## Format: `- [ ] T### [P?] [US#?] Description with exact file path`

Paths without a prefix are under `src/clutch-web/src/`.

## Phase 2: Foundational (blocks all stories)

- [X] T001 [P] Tests for the primitives in `components/ui/list.test.tsx` and `components/ui/delete-dialog.test.tsx` per contracts/list-ui.md (FR-001)
- [X] T002 [P] Tests for list cells without `numeric` in `src/clutch-web/eslint-rules/clutch-numeric-align.test.js` per contracts Lint (FR-001)
- [X] T003 Create `components/ui/list.tsx` and `components/ui/delete-dialog.tsx` per contracts/list-ui.md (FR-001)
- [X] T004 Extend `src/clutch-web/eslint-rules/clutch-numeric-align.js` per contracts Lint (FR-001)
- [X] T005 Move `features/assets/AssetsPage.tsx` and `features/assets/DeleteAssetDialog.tsx` onto the primitives; existing asset tests pass unchanged (FR-002, SC-003)

**Checkpoint**: typecheck, lint and unit tests pass.

## Phase 3: User Story 1 - Transactions (Priority: P1) 🎯 MVP

**Goal**: FR-004 to FR-007 | **Independent Test**: view each list state and delete a transaction.

- [X] T006 [US1] Tests in `features/accounts/TransactionsTable.test.tsx` and `features/accounts/DeleteTransactionDialog.test.tsx` (FR-003, FR-004, FR-005, FR-006, FR-007)
- [X] T007 [US1] Rebuild `features/accounts/TransactionsTable.tsx` on the primitives (FR-003, FR-004, FR-005, FR-006)
- [X] T008 [US1] Rebuild `features/accounts/DeleteTransactionDialog.tsx` on `DeleteDialog` with the success toast (FR-007)

## Phase 4: User Story 2 - Valuations (Priority: P2)

**Goal**: FR-008 | **Independent Test**: scroll a long valuations list and remove a row.

- [X] T009 [US2] Tests in `features/assets/AssetPage.test.tsx` for the valuations list (FR-003, FR-008)
- [X] T010 [US2] Rebuild the valuations list in `features/assets/AssetForm.tsx` on the primitives (FR-003, FR-008)

## Phase 5: User Story 3 - Import Review (Priority: P3)

**Goal**: FR-009 | **Independent Test**: review a long import with and without duplicates.

- [X] T011 [US3] Tests in `features/imports/ImportReviewTable.test.tsx` (FR-003, FR-009)
- [X] T012 [US3] Rebuild `features/imports/ImportReviewTable.tsx` on the primitives (FR-003, FR-009)

## Phase 6: User Story 4 - Schedule (Priority: P4)

**Goal**: FR-010, FR-011 | **Independent Test**: load, fail and retry balances on a long schedule.

- [X] T013 [US4] Tests in `features/mortgages/AmortizationSchedule.test.tsx` and `AmortizationScheduleAccount.test.tsx` (FR-010, FR-011)
- [X] T014 [US4] Expose a retry from `useActualBalances` in `features/mortgages/actualBalances.ts` (FR-011)
- [X] T015 [US4] Rebuild `features/mortgages/AmortizationSchedule.tsx` as a windowed table on the primitives, 40 px row pitch (FR-003, FR-010, FR-011)

## Phase 7: User Story 5 - Rate Changes (Priority: P5)

**Goal**: FR-012, FR-013 | **Independent Test**: scroll, edit the opening rate and remove a change.

- [X] T016 [US5] Tests in `features/mortgages/InterestRateChangesDialog.test.tsx`; update `listedRates` in `features/mortgages/testSupport.tsx` (FR-012, FR-013)
- [X] T017 [US5] Rebuild the list in `features/mortgages/InterestRateChangesDialog.tsx` on the primitives (FR-003, FR-012, FR-013)

## Phase 8: Completion Gates

- [X] T018 Point `.claude/skills/clutch-ui-style/references/lists.md`, `SKILL.md` and `docs/code-map.md` at the primitives; record differences from plan.md; run the sync script (FR-014, SC-001)
- [ ] T019 Browser tests in `src/clutch-web/e2e/style-guide.spec.ts`: new lists in `pinnedLists` and states, schedule row pitch, both themes (SC-002, SC-004, WEB-001)
- [ ] T020 Update affected journeys in `src/clutch-web/e2e/accounts-transaction-delete.spec.ts`, `assets.spec.ts`, `mortgages.spec.ts` and `accounts-import.spec.ts` (WEB-001)
- [ ] T021 Independent security review of the full diff and `npm audit --omit=dev` (SEC-001, SEC-003, `clutch-security-review`)
- [ ] T022 Validate every UI compliance checklist item in both themes; record each result in `specs/031-align-lists/validation.md` (WEB-001)
- [ ] T023 Run the commands in `specs/031-align-lists/quickstart.md`; record results in `validation.md` (ENG-001, WEB-001, Perf & Observability)

## Dependencies & Execution Order

- Foundational → stories in priority order → Completion Gates. Stories do not depend on each other.
- T015 needs T014. T019 and T020 need every story.

## Parallel Opportunities

- Foundational tests: T001, T002.

## Implementation Strategy

MVP = Foundational plus User Story 1. Each story passes its own tests before the next starts.
