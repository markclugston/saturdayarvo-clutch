# Tasks: Exclude Pending Authorisations From Imports

**Input**: `specs/032-exclude-pending-authorisations/` (plan.md, spec.md, research.md, data-model.md, contracts/import-review.md)

**Tests**: REQUIRED (ENG-001). Write tests first and confirm they fail before implementing.

## Format: `- [ ] T### [P?] [US#?] Description with exact file path`

API paths are under `src/Clutch.API/`, API test paths under `tests/Clutch.API.Tests/`, web paths under `src/clutch-web/`.

## Phase 2: Foundational (blocks all stories)

- [X] T001 [P] Tests for `ImportReviewRow.IsExcluded` invariants and `ImportReview` duplicate rules in `Unit/Imports/ImportStateTests.cs` per data-model.md (FR-006)
- [X] T002 Add `IsExcluded` to `Domain/Imports/ImportReviewRow.cs` and narrow duplicate rules in `Domain/Imports/ImportReview.cs` per data-model.md (FR-006)
- [X] T003 Map `IsExcluded` in `Infrastructure/Persistence/AppDbContext.cs`; add migration `<ts>_ExcludePendingAuthorisations` and snapshot per data-model.md Migration
- [X] T004 Add `importRowCount` and `rows[].isExcluded` to the review response in `Application/Imports/ImportReviewService.cs` per contracts/import-review.md (FR-007, FR-008)

**Checkpoint**: build and unit tests pass.

---

## Phase 3: User Story 1 - Skip Authorisations In A File With Balances (Priority: P1) 🎯 MVP

**Goal**: FR-001, FR-003, FR-004 | **Independent Test**: confirm a file with balances containing a repeated-balance row; that row is not saved, others are.

- [X] T005 [P] [US1] Balance-rule tests in new `Unit/Imports/ImportExclusionsTests.cs`: US1 scenarios, every spec Edge Case, both file directions and single-date files per research.md R1 (FR-001, FR-003)
- [X] T006 [P] [US1] Integration tests in `Integration/Imports/ImportWorkflowTests.cs` per quickstart.md expectations (FR-004, FR-006, SC-001)
- [X] T007 [US1] Create pure rule `Domain/Imports/ImportExclusions.cs` (balance rule and direction choice) per data-model.md and research.md R1 (FR-001, FR-003)
- [X] T008 [US1] Mark exclusions at review creation and run duplicate detection on non-excluded rows only in `Application/Imports/ImportReviewService.cs` (FR-001, FR-006, FR-007)
- [X] T009 [US1] Skip excluded rows, order the rest by the `ImportExclusions` direction and allow zero imported in `Application/Imports/ConfirmImportService.cs` per data-model.md (FR-004, FR-006)

**Checkpoint**: US1 unit and integration tests pass.

---

## Phase 4: User Story 2 - Skip Authorisations In A File Without Balances (Priority: P1)

**Goal**: FR-002, FR-003 | **Independent Test**: confirm a file without balances containing a row that matches an authorisation pattern; it is not saved.

- [X] T010 [P] [US2] Description-rule tests in `Unit/Imports/ImportExclusionsTests.cs`: US2 scenarios, every FR-002 pattern, letter case, part-word non-matches, and US1 scenario 2 (rule not applied with balances) (FR-002, FR-003)
- [X] T011 [P] [US2] Integration test for a no-balance file in `Integration/Imports/ImportWorkflowTests.cs` (FR-002, FR-004, SC-001)
- [X] T012 [US2] Add the description rule to `Domain/Imports/ImportExclusions.cs` per data-model.md (FR-002, FR-003)

**Checkpoint**: US2 unit and integration tests pass.

---

## Phase 5: User Story 3 - See Excluded Rows On The Preview (Priority: P1)

**Goal**: FR-005, FR-008 | **Independent Test**: load a preview with excluded rows; each is shown in place and marked, and the count excludes them.

- [X] T013 [P] [US3] Schema tests for `importRowCount` and `isExcluded` in `src/lib/api/schemas.test.ts` per contracts/import-review.md (FR-007)
- [X] T014 [P] [US3] Component tests in `src/features/imports/ImportReviewTable.test.tsx` for every US3 scenario (FR-005, FR-008, SC-002, SC-003)
- [X] T015 [P] [US3] Tests in `src/features/imports/ImportPage.test.tsx`: count sentence and confirm with excluded rows, including all excluded (FR-004, FR-008)
- [X] T016 [US3] Add `importRowCount` and `isExcluded` to `src/lib/api/schemas.ts` per contracts/import-review.md (FR-007)
- [X] T017 [US3] Show the "Will Not Be Imported" `StatusChip` in the Warning column and use `importRowCount` in the sentence in `src/features/imports/ImportReviewTable.tsx` (FR-005, FR-008, SC-003)

**Checkpoint**: lint, typecheck and web unit tests pass.

---

## Phase 6: Completion Gates

- [X] T018 Add the excluded-row import review state to `e2e/style-guide.spec.ts`, both themes (WEB-001, `clutch-ui-style` §12, SC-002)
- [X] T019 Update the import journey with an excluded row in `e2e/accounts-import.spec.ts` (WEB-001, SC-001)
- [X] T020 Independent query review of review-create and confirm queries (DOT-002, `clutch-data-access`)
- [X] T021 Migration review with rollback and no-backfill plan (OPS-001, `clutch-data-access`)
- [X] T022 Independent security review of the full diff (SEC-001, SEC-003, SEC-004, `clutch-security-review`)
- [X] T023 Validate every UI compliance checklist item in both themes; record each result in `specs/032-exclude-pending-authorisations/validation.md` (WEB-001, `clutch-ui-style`)
- [X] T024 Run the commands in `specs/032-exclude-pending-authorisations/quickstart.md`; record results in `validation.md` (ENG-001, DOT-001, ARC-001, Perf & Observability)

---

## Dependencies & Execution Order

- Foundational → US1 → US2 → US3 → Completion Gates.
- T007 creates the file T012 extends. T008 and T009 need T002 and T007. T017 needs T016. US3 relies on T004 for the server response.
- T018 and T019 need every story.

## Parallel Opportunities

- US1: T005, T006
- US2: T010, T011
- US3: T013, T014, T015

## Implementation Strategy

MVP = Foundational plus User Story 1. Each story passes its own tests before the next starts.

## Phase 7: Convergence

- [X] T025 Reword the duplicate banner in `src/features/imports/ImportReviewTable.tsx` and the duplicate confirmation checkbox in `src/features/imports/ImportPage.tsx` so neither says excluded rows will be imported; update the affected component tests, browser assertions and `import-review` screenshots per FR-005, SC-003 (partial)
- [X] T026 Restore the space after `balance:` in `ImportReviewRowSchema` in `src/lib/api/schemas.ts` per T016 (partial)

## Phase 8: Convergence

- [X] T027 CRITICAL: Run the integration journeys `e2e/mortgages.spec.ts` and `e2e/accounts-transaction-delete.spec.ts`, which review and confirm imports (`playwright.integration.config.ts`), fix any failure, and record the results in `specs/032-exclude-pending-authorisations/validation.md` per ENG-001 (partial)

## Phase 9: Correction From User Testing

- [X] T028 Failing test in `Unit/Imports/ImportExclusionsTests.cs`: an authorisation dated earlier than the rows around it is excluded in both file directions (FR-001)
- [X] T029 Compare each row with the prior row in the file's running order, not date order, in `Domain/Imports/ImportExclusions.cs` per research.md R1 (FR-001)
- [X] T030 Run the .NET quality gates and record the results in `validation.md` (ENG-001, DOT-001)

## Phase 10: Convergence

- [X] T031 CRITICAL: Rerun the integration journeys that confirm a file with balances against the real API, `e2e/mortgages.spec.ts` and `e2e/import-settings.spec.ts` (`playwright.integration.config.ts`), which last ran before the T029 change; fix any failure, and record the results and this convergence run in `specs/032-exclude-pending-authorisations/validation.md` per ENG-001 (partial)
