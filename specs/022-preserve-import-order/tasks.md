---

description: "Task list for 022-preserve-import-order"
---

# Tasks: Preserve Import Order For Same-Date Transactions

**Input**: `specs/022-preserve-import-order/` (plan.md, spec.md, research.md, data-model.md, contracts/transaction-order.md, quickstart.md)

**Tests**: REQUIRED. ENG-001 makes every behaviour change an explicit request for tests. Write
tests first and confirm they fail before implementing.

## Format: `- [ ] T### [P?] [US#?] Description with exact file path`

- **[P]**: parallel-safe (different files, no dependency). **[US#]**: user story label.
- Paths and patterns follow the nearest existing sibling file (`docs/code-map.md`).

## Phase 1: Setup

None: no new projects, packages or configuration (plan.md).

---

## Phase 2: Foundational (blocks all stories)

- [X] T001 Write failing unit tests: `Sequence < 1` rejection and valid-sequence cases, and pass a sequence in the `TryCreate` helper, in `tests/Clutch.API.Tests/Unit/TransactionBalanceTests.cs`
- [X] T002 Add required `Sequence` to `Transaction`; `TryCreate` takes `sequence` and rejects values < 1 ("≥ 1", data-model.md) in `src/Clutch.API/Domain/Transactions/Transaction.cs`
- [X] T003 Map `Sequence` (required), check `CK_Transactions_PositiveSequence` (`[Sequence] >= 1`), unique `IX_Transactions_AccountId_TransactionDate_Sequence` replacing the old index in `src/Clutch.API/Infrastructure/Persistence/AppDbContext.cs`
- [X] T004 Write failing migration test (SQL Server): up backfills unique per-date sequences on same-date rows, check rejects 0, down restores the old index and removes the unique index, check and `Sequence` column, in `tests/Clutch.API.Tests/Integration/Persistence/TransactionSequenceMigrationTests.cs`
- [X] T005 Generate `TransactionSequence` migration and hand-edit per data-model.md (default 0 → `ROW_NUMBER()` backfill by `CreatedAtUtc, Id` → drop default → check → unique index → drop old; Down reverses) in `src/Clutch.API/Infrastructure/Persistence/Migrations/`
- [X] T006 [P] Pass distinct per-date sequences in `Transaction.TryCreate` helpers in `tests/Clutch.API.Tests/Integration/Accounts/FamilyAccountAuthorizationTests.cs` and `Integration/Imports/DuplicateAndConcurrencyTests.cs`
- [X] T007 [P] Pass distinct per-date sequences in `TryCreate` helpers in `tests/Clutch.API.Tests/Integration/Mortgages/MortgageTestSupport.cs` and `Integration/Mortgages/PeriodBalancesTests.cs`
- [X] T008 [P] Pass distinct per-date sequences in `TryCreate` helpers in `tests/Clutch.API.Tests/Integration/Persistence/ImportCoordinationMigrationTests.cs`, `Integration/Transactions/TransactionServiceDeleteTests.cs` and `Integration/Transactions/TransactionDeleteEndpointTests.cs`
- [X] T009 Widen the existing same-range duplicate query to also project `Sequence` and assign append sequences (`max(Sequence)+1 ..` per date from those rows, `1 ..` for a date with none; saved rows never updated, FR-002) in `src/Clutch.API/Application/Imports/ConfirmImportService.cs`; rows use their current order until T015 applies the chronological groups

**Checkpoint**: `dotnet build` + fast tests pass; T004 passes.

---

## Phase 3: User Story 1 - Same-Date Transactions Keep Their File Order (Priority: P1) 🎯 MVP

**Goal**: Confirmed same-date rows are stored in true chronological order and listed latest-first, stable across reloads and paging. | **Independent Test**: Import a file with ≥ 3 same-date reconciling rows, list them, reload and page with a small page size.

- [X] T010 [US1] Unit tests for `InferDirection` (balances newest/oldest first; both/neither/single row/no balances → dates; equal dates → newest first; non-monotonic → first vs last; any missing balance → neither → dates; opposite sign convention (balance falls on incoming) → neither → dates, per FR-011) per research R2 in `tests/Clutch.API.Tests/Unit/Imports/ImportOrderingTests.cs`
- [X] T011 [US1] Unit tests for `ChronologicalGroups` (newest-first reverses each date, oldest-first keeps, duplicates keep own position; non-monotonic dates group per date) per R3 in same file as T010
- [X] T012 [P] [US1] Integration tests (SQL Server): newest-first, oldest-first and all-same-date files list in FR-004 order (SC-001); consecutive same-date rows from one import reconcile in stored order (SC-004); scenario 4: a later import on a date with saved rows X, Y is stored after them in its own order (X, Y, P, Q) even when its balances would reconcile before them, and X, Y keep their sequences (FR-002); an older statement confirmed after a newer one still appends its shared-date rows after the saved rows (edge case); possible duplicates keep positions; saved dates, descriptions, amounts, directions and balances equal the file's and duplicate flags match the review (FR-009), in `tests/Clutch.API.Tests/Integration/Imports/ImportOrderTests.cs`
- [X] T013 [P] [US1] Integration tests (SQL Server): same order on reload; page size smaller than a same-date group pages without repeats or gaps (FR-005, SC-002); deleting a middle row keeps order; old-format (`date|guid`), extra-part, signed/padded-integer and other malformed cursors → 400 with `errors.cursor` naming the field and why, and no format or internal details (SEC-004), in `tests/Clutch.API.Tests/Integration/Transactions/TransactionOrderTests.cs`
- [X] T014 [US1] Implement pure `ImportOrdering` (`InferDirection`, `ChronologicalGroups`; reconcile rule FR-011 used only for direction, null balance never reconciles; no EF/HTTP types, ARC-001) in `src/Clutch.API/Domain/Imports/ImportOrdering.cs`
- [X] T015 [US1] Confirm: order rows by `SourceRowNumber`, infer direction and build `ChronologicalGroups`, then assign each date group's sequences after that date's saved `max(Sequence)` using T009's widened query (R4–R5; no update of saved rows), in `src/Clutch.API/Application/Imports/ConfirmImportService.cs`
- [X] T016 [US1] Order list by `TransactionDate` desc, `Sequence` desc; cursor `yyyy-MM-dd|<sequence>` validated (≤ 128 chars, base64url, exactly two `|`-separated parts, exact date, int ≥ 1 with no sign, spaces or extra characters; else 400 via `ApiProblemException` keeping its title and detail and adding `errors` `{ "cursor": [...] }` per contract, SEC-004) in `src/Clutch.API/Application/Transactions/TransactionService.cs`
- [x] T027 [US1] Invalid page size (0, maximum + 1) 400 keeps its title and detail and adds `errors` `{ "pageSize": [...] }` per contract (SEC-004): test `Invalid_transaction_page_size_returns_field_level_error` in `tests/Clutch.API.Tests/Integration/Imports/ImportWorkflowTests.cs`, fix in `src/Clutch.API/Application/Transactions/TransactionService.cs`

**Checkpoint**: T010–T013 pass; existing import and transaction suites pass.

---

## Phase 4: User Story 2 - The Day's Closing Balance Is The Chronologically Last Transaction (Priority: P2)

**Goal**: Period-end balances use the chronologically last transaction of a date (FR-006). | **Independent Test**: Period ending on a day with balances 1,000, 900, 800 (chronological) shows 800.

- [X] T017 [US2] Integration test (SQL Server): period ending on a day with sequences giving balances 1,000, 900, 800 shows 800 (SC-003), with Ids chosen so `Id` order would differ; plus one case that confirms a newest-first import (rows 800, 900, 1,000 top to bottom on the period-end date) through the confirm path and checks the period shows 800 (US2 Independent Test), in `tests/Clutch.API.Tests/Integration/Mortgages/PeriodBalancesTests.cs`
- [X] T018 [US2] Replace `ThenBy(Id)` with `ThenBy(Sequence)` in `src/Clutch.API/Application/Mortgages/PeriodBalanceService.cs` and update the lookup ordering comment in `src/Clutch.API/Domain/Mortgages/PeriodBalances.cs`

**Checkpoint**: PeriodBalances suite passes.

---

## Phase 5: User Story 3 - The Review Screen Matches The File (Priority: P3)

**Goal**: Import review lists rows in file order (FR-007). | **Independent Test**: Upload a file with same-date rows and possible duplicates; review rows are in `sourceRowNumber` order.

- [X] T019 [US3] Integration test: review response rows ordered by `sourceRowNumber` ascending, including possible duplicates, in `tests/Clutch.API.Tests/Integration/Imports/ImportOrderTests.cs`
- [X] T020 [US3] Order rows by `SourceRowNumber` in `ToResponse` in `src/Clutch.API/Application/Imports/ImportReviewService.cs`

**Checkpoint**: Imports suite passes.

---

## Phase 6: Completion Gates

- [X] T021 Independent query review of the widened confirm projection, append sequence assignment, list order/cursor and period-balance query (DOT-002, `clutch-data-access`)
- [X] T022 Migration review of `TransactionSequence` incl. backfill and rollback (OPS-001, `clutch-data-access`)
- [X] T023 Independent OWASP Top 10 security review of the full diff: cursor and page size validation complete with field-level, non-disclosing errors, no balances/row content in logs, errors or audit text, dependency vulnerability scan (SEC-001, SEC-003, SEC-004, `clutch-security-review`)
- [X] T024 Confirm existing `ImportConfirmed` audit row unchanged and append-only (AUD-001)
- [X] T025 Run quickstart.md commands and full `dotnet test`; record results (ENG-001, `clutch-dotnet-service`)
- [ ] T026 Run `/speckit-converge` and complete any tasks it appends before declaring the feature done (Workflow and Delivery Gates)

---

## Dependencies & Execution Order

- Setup (none) → Foundational → US1 → US2 → US3 → Completion Gates.
- T002 follows its failing test T001; T003 needs T002; T005 needs T003; T006–T008 need T002; T009 needs T002 and T003 (it projects the mapped `Sequence`). T015 needs T014 and builds on T009's append.
- Tests first (ENG-001): T014 follows failing T010–T011; T015 follows failing T012; T016 follows failing T013; T018 follows failing T017; T020 follows failing T019.
- US2 and US3 only need Foundational; they can run alongside US1 but are checked after it. T019 adds to `ImportOrderTests.cs`, which T012 creates: write T019 after T012 (or create the file in whichever runs first).

## Parallel Opportunities

- Foundational: T006, T007, T008
- US1: T010 + T011 as one unit (same file, one author), T012, T013
- US2 and US3 phases are independent of each other.

## Implementation Strategy

MVP = User Story 1. Deliver stories incrementally in priority order; each story must pass its own tests before it is checked off. US2 and US3 may be worked alongside US1 (see Dependencies) but are checked after it.

## Completion Results

Reviews T021-T024 were done by the implementing agent in the same session, not by an independent reviewer.

- T021 Query review: the confirm projection is `AsNoTracking` over `(AccountId, TransactionDate range)` and reads two columns from the new unique index; list and cursor seek on `(AccountId, TransactionDate, Sequence)` with `Take(size + 1)`; period balances order by the same index columns; no N+1 or client evaluation.
- T022 Migration review: no data loss on up (nullable add, `ROW_NUMBER()` backfill, then required, so no default constraint is left); down restores the old index and drops the unique index, check and column; both directions covered by `TransactionSequenceMigrationTests`. `MortgageAccountLinkMigrationTests` and `ImportCoordinationMigrationTests` now stop at their own migration or insert old-schema rows with SQL.
- T023 Security review: the cursor is validated for length, base64url alphabet, strict UTF-8, exactly two parts, exact date, digits-only integer >= 1, and must re-encode to the same text; the 400 carries `errors.cursor` and discloses no format. `pageSize` 400 carries `errors.pageSize`. No logging added. `dotnet list package --vulnerable --include-transitive`: none.
- T024 Audit: `ImportAuditWriter` and the `ImportConfirmed` row are untouched; no audit update or delete.
- T025 Results: `dotnet build` 0 warnings, 0 errors; full `dotnet test`: 423 passed, 1 failed on the first run (`MortgageAccountLinkMigrationTests` compared Transactions columns after migrating to latest); fixed by migrating only to its own migration, and that test then passed. The full suite was rerun after that fix: 424 passed, 0 failed.

## Phase 7: Convergence

- [ ] T028 Have a reviewer other than the implementing agent perform the independent query review, migration review and OWASP security review recorded under Completion Results, and record their outcome there per Constitution (DOT-002, OPS-001, SEC-001) (partial)
