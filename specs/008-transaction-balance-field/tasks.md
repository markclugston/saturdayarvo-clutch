# Tasks: Optional Transaction Balance Field

**Input**: Design documents from `/specs/007-transaction-balance-field/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-changes.md, quickstart.md

**Tests**: Required by the constitution (ENG-001) for all added behavior; all checks are agent-executable.

**Format**: `- [ ] [TaskID] [P?] [Story?] Description with file path` — `[P]` = parallelizable (different files, no incomplete dependencies).

Backend root: `src/Clutch.API/`; backend tests: `tests/Clutch.API.Tests/`; frontend root: `src/clutch-web/`.

## Phase 1: Setup

- [X] T001 Confirm a clean baseline by running `dotnet test` from the repository root and, in `src/clutch-web`, `npx tsc --noEmit` and `npm test -- --run`; record any pre-existing failures.

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: Domain/persistence support for an optional balance, required by every story.

- [X] T002 [P] Add an optional `decimal? Balance` property (private setter, nullable, may be negative or zero, must satisfy `decimal.Round(balance, currency.MinorUnits) == balance` when present) to `Transaction` and thread it through the private constructor and `TryCreate` (new optional parameter, existing callers unchanged) in `src/Clutch.API/Domain/Transactions/Transaction.cs`.
- [X] T003 [P] Add an optional `decimal? Balance` property and constructor parameter (nullable; no non-negative check) to `ImportReviewRow` in `src/Clutch.API/Domain/Imports/ImportReviewRow.cs`.
- [X] T004 Configure `Balance` on `Transaction` and `ImportReviewRow` in `src/Clutch.API/Infrastructure/Persistence/AppDbContext.cs` as nullable with the same precision/scale as `Amount` and no check constraint and no index.
- [X] T005 Add an EF Core migration (name `TransactionBalance`) under `src/Clutch.API/Infrastructure/Persistence/Migrations/` that adds nullable decimal `Balance` columns to `Transactions` and `ImportReviewRows`, with a `Down` that drops them; update `AppDbContextModelSnapshot.cs`. Review for data loss (additive; rollback loses only balance data).
- [X] T006 [P] Add unit tests in `tests/Clutch.API.Tests/Unit/` for `Transaction.TryCreate` with null, negative, zero, and over-precise balances.

**Checkpoint**: Solution builds with `dotnet build`; the migration applies cleanly.

---

## Phase 3: User Story 1 - Import running balance from a CSV (Priority: P1) 🎯 MVP

**Goal**: An optional balance column mapping; the bank-supplied balance is parsed and stored on each imported transaction.

**Independent Test**: Import a CSV with the balance column mapped; confirm each stored transaction has the row's balance; an unmapped import is unchanged.

### Tests for User Story 1

- [X] T007 [P] [US1] Add parser tests in `tests/Clutch.API.Tests/Unit/Imports/CsvImportParserTests.cs`: valid balance, negative balance, currency-formatted/grouped balance using the selected number format, empty balance cell → null with row accepted, non-numeric balance → invalid-amount error with `rowNumber` and field exactly `Balance` (and amount errors still report their original field), balance unmapped → null.
- [X] T008 [P] [US1] Add mapping validation tests (new file `tests/Clutch.API.Tests/Unit/Imports/ImportMappingValidatorTests.cs`): balance column null valid, in range valid, out of range → `InvalidMapping` field `Columns`, same column as another mapped column → `InvalidMapping` field `Columns`.
- [X] T009 [P] [US1] Add an integration test in `tests/Clutch.API.Tests/Integration/Imports/ImportWorkflowTests.cs`: review then confirm an import with a balance mapping persists each balance on the transactions; an import without a mapping persists null balances; the transactions list endpoint returns `balance` (string or null); duplicate detection ignores balance.

### Implementation for User Story 1

- [X] T010 [US1] Add optional `int? BalanceColumn = null` to `ImportMapping` and `decimal? Balance = null` to `ParsedImportRow` in `src/Clutch.API/Application/Imports/ImportMapping.cs`.
- [X] T011 [US1] In `src/Clutch.API/Application/Imports/ImportMappingValidator.cs`, when `BalanceColumn` is set add it to the `columns` list so the existing range check (`column < 0 || column >= columnCount`) and distinctness check apply.
- [X] T012 [US1] In `src/Clutch.API/Infrastructure/Imports/CsvImportParser.cs`, read the balance field when `BalanceColumn` is set: empty → null; otherwise parse with the existing `ParseDecimal` (sign preserved, same number format and currency rules) and on failure throw the invalid-amount `ImportValidationException` with field `Balance` (extend the `InvalidAmount` helper with an optional field name and label, defaulting to "Amount"/"A transaction amount is invalid.", and pass them through `ParseDecimal` and `RemoveCurrencyCode` so invalid-value and currency-mismatch errors for the balance column name the balance — "A transaction balance is invalid." — while existing amount errors are unchanged); populate `ParsedImportRow.Balance`.
- [X] T013 [US1] In `src/Clutch.API/Application/Imports/ImportReviewService.cs` (`CreateReviewRows`), pass `row.Balance` into `ImportReviewRow`; leave `TransactionFingerprint`, `DuplicateDetector`, and the review response unchanged.
- [X] T014 [US1] In `src/Clutch.API/Application/Imports/ConfirmImportService.cs`, copy `row.Balance` into `Transaction.TryCreate` when creating transactions (the single `Transaction.TryCreate` call near line 184; the other `row.Amount` uses build duplicate-check records and stay unchanged).
- [X] T015 [US1] In `src/Clutch.API/Application/Transactions/TransactionService.cs`, add `Balance` to `TransactionProjection`, select it in the query, and add `string? Balance` to `TransactionListItem` formatted with `ToString("0.############################", CultureInfo.InvariantCulture)` (null when absent).
- [X] T016 [P] [US1] Update `src/clutch-web/src/lib/api/schemas.ts`: add `balanceColumn: z.number().int().nonnegative().nullable().optional()` to the import mapping schema and `balance: z.string().regex(/^-?[0-9]+(\.[0-9]+)?$/).nullable()` to the transaction list item schema (nullable, not optional; the API always returns the property); add cases to `src/clutch-web/src/lib/api/schemas.test.ts`.
- [X] T017 [US1] Add an optional "Balance column" select (with a "None" choice, mirroring the existing column selects, no hyperlinks, accessible name) to `src/clutch-web/src/features/imports/ImportMappingForm.tsx`, excluding columns already chosen for other fields, and include `balanceColumn` in the submitted mapping in `src/clutch-web/src/features/imports/ImportPage.tsx` / `src/clutch-web/src/features/imports/api.ts` (omit or null when "None").
- [X] T018 [US1] Add component tests in `src/clutch-web/src/features/imports/ImportPage.test.tsx` and `src/clutch-web/src/features/imports/api.test.ts`: the balance select is optional, selecting a column sends `balanceColumn`, "None" sends none.

**Checkpoint**: US1 works end to end through the API; balance stored and returned.

---

## Phase 4: User Story 2 - Balance mapping saved with import settings (Priority: P1)

**Goal**: The balance mapping is saved, restored, editable and clearable with the other settings; legacy settings still load.

**Independent Test**: Import successfully with a balance mapping; start another import and see the mapping applied and shown; load settings saved before this feature.

### Tests for User Story 2

- [X] T019 [P] [US2] Add serializer/service tests in `tests/Clutch.API.Tests/Unit/Imports/AccountImportSettingsServiceTests.cs`: a mapping with `BalanceColumn` round-trips through `ImportMappingSettingsSerializer`; legacy JSON without `balanceColumn` deserializes with null and passes validation.
- [X] T020 [P] [US2] Add integration tests in `tests/Clutch.API.Tests/Integration/Imports/AccountImportSettingsTests.cs`: successful import saves the balance mapping and `GET` settings returns it; a later successful import with it cleared replaces it with none; a failed/cancelled import leaves saved settings unchanged; saved settings whose `balanceColumn` is beyond a later file's column count yield the existing "settings need attention" error and import nothing.
- [X] T021 [P] [US2] Add a component test in `src/clutch-web/src/features/imports/ImportPage.test.tsx`: with saved settings containing `balanceColumn`, opening settings shows it selected and it can be changed to "None"; legacy settings without it show "None"; the "settings need attention" message and open-settings action appear when the server reports an invalid saved balance column.

### Implementation for User Story 2

- [X] T022 [US2] Verify `src/Clutch.API/Application/Imports/ImportMappingSettingsSerializer.cs` and `src/Clutch.API/Application/Imports/AccountImportSettingsService.cs` persist and return `BalanceColumn` unchanged without a schema version bump (`CurrentSchemaVersion` stays 1); fix any place that rebuilds `ImportMapping` field by field and would drop the new property (also check `ConfirmImportService.cs` snapshot handling around line 218 and `ImportReviewService.cs` around line 132).
- [X] T023 [US2] Ensure the mapping form in `src/clutch-web/src/features/imports/ImportMappingForm.tsx` initializes the balance select from saved settings and that `src/clutch-web/src/features/imports/api.ts` parses and sends `balanceColumn` for the saved-settings read/write.

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 - See balance in the transaction list (Priority: P2)

**Goal**: Show a Balance column right of Amount as the right-most column, only when at least one listed transaction has a balance.

**Independent Test**: Render lists with/without balances and verify column presence, order, blank cells, formatting.

### Tests for User Story 3

- [X] T024 [P] [US3] Add tests in `src/clutch-web/src/features/accounts/TransactionsTable.test.tsx`: Balance header is the last column header directly after Amount when any item has a balance; rows without a balance have an empty balance cell; no Balance header or cells when no item has a balance; negative balances keep their sign; balance is right-aligned like Amount.

### Implementation for User Story 3

- [X] T025 [US3] In `src/clutch-web/src/features/accounts/TransactionsTable.tsx`, compute during render (no effect) whether any item has a non-null `balance`; when true add a `Balance` `<th scope="col">` after Amount and a cell per row formatted with `formatCurrencyAmount` (handle the leading `-`; check `src/clutch-web/src/lib/formatCurrencyAmount.ts` and extend it with a test in `formatCurrencyAmount.test.ts` if it cannot format negatives), using the same Tailwind classes/`cn()` and theme tokens as Amount, blank when null.
- [X] T026 [US3] Ensure `src/clutch-web/src/features/accounts/useTransactions.ts` and `src/clutch-web/src/features/accounts/api.ts` pass `balance` through validated by the updated schema; update `AccountDetails.test.tsx` fixtures if they now require `balance`.

**Checkpoint**: All three stories work.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T027 Add a Playwright scenario in `src/clutch-web/e2e/import-settings.spec.ts` (fixtures in `src/clutch-web/e2e/fixtures.ts`): import a CSV with a balance column mapped, verify Balance is the right-most column after Amount, start a second import and verify the mapping is preselected; import without a mapping into another account and verify no Balance column.
- [X] T028 Run the full checks: `dotnet test`; in `src/clutch-web` `npx tsc --noEmit`, `npm run lint` (zero warnings), `npm test -- --run`, `npm run build`, and the Playwright suite; fix failures.
- [X] T029 Run an independent agent review of the migration and the SQL/EF queries touched (transaction list projection, review row creation, confirm insert) for query shape, indexing, and round trips (constitution DOT-002); address findings and rerun checks.
- [X] T030 Run an independent OWASP-focused review of the changed code (input validation of the balance cell, no balance values in logs, error responses not disclosing data) per constitution V; address findings and rerun checks.
- [X] T031 Run the quickstart validation in `specs/007-transaction-balance-field/quickstart.md` and confirm each scenario passes.

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 (blocks all stories) → US1 → US2 → US3 → Polish.
- **US1** depends on Phase 2. **US2** depends on US1 (mapping property and form field). **US3** depends on T015 and T016 from US1 for data; its table work (T024–T025) can proceed in parallel with US1 backend tasks using fixtures.
- Within a story: tests first (expected to fail), then models/parsing, services, then UI.
- T004 → T005. T010 → T011, T012. T012 → T013 → T014. T015 depends on T002/T004.

## Parallel Opportunities

- Phase 2: T002, T003, T006 together; then T004, T005.
- US1: T007, T008, T009, T016 in parallel; frontend T016–T018 parallel with backend T010–T015.
- US2: T019, T020, T021 in parallel.
- US3: T024 in parallel with US1/US2 backend work.

## Implementation Strategy

- **MVP**: Phases 1–3 (US1) — balance can be mapped, imported, stored and returned by the API. Add US2 so the mapping persists, then US3 for display.
- Deliver incrementally; validate each checkpoint with the quickstart commands before moving on.

## Phase 7: Convergence

- [X] T032 Resolve the Balance column placement in `src/clutch-web/src/features/accounts/TransactionsTable.tsx`: the Direction column currently sits between Amount and Balance, so Balance is right-most but not "directly right of Amount"; either reorder so Direction precedes Amount (and update `TransactionsTable.test.tsx` and the e2e check) or confirm with the spec owner and amend the spec wording, per FR-007 / SC-004 / US3/AC1 (partial)

## Phase 8: Display follow-up

- [X] T033 Return `balance` (string or null) on review rows in `ImportReviewService.cs` and add `balance` to `ImportReviewRowSchema` in `schemas.ts`; assert it in `ImportWorkflowTests.cs`.
- [X] T034 Show a Balance column last (after Amount) in `ImportReviewTable.tsx` when any row has a balance; right-align Amount and Balance in `ImportReviewTable.tsx` and `TransactionsTable.tsx`; add `ImportReviewTable.test.tsx` coverage.
- [X] T035 Use `currencyDisplay: 'narrowSymbol'` in `formatCurrencyAmount.ts` so amounts render as `$35.00`, not `A$35.00`; add a test.
