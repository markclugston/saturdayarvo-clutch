# Implementation Plan: Preserve Import Order For Same-Date Transactions

**Branch**: `022-preserve-import-order` | **Date**: 2026-11-23 | **Spec**: [spec.md](spec.md)

## Summary

Each transaction gets a required `Sequence` (int): its chronological position among the account's
transactions on the same date, 1 = earliest, unique per `(AccountId, TransactionDate)`. On confirm, a pure
domain orderer infers the file direction (balances, then dates, then newest first), turns each date's rows
into a chronological group, and appends the group after that date's saved transactions (balances are used
only for direction, never to place rows among saved ones). The Transactions list and its cursor, and the
period-balance lookup, order by `(TransactionDate, Sequence)` instead of `(TransactionDate, Id)` (research R1–R6).

## Technical Context

**Baseline**: The existing stack and settled decisions in the code (see `docs/code-map.md`).

**Feature-specific changes**:

- Schema: `Transactions.Sequence int NOT NULL` with check `Sequence >= 1`; the `(AccountId, TransactionDate)`
  index becomes unique `(AccountId, TransactionDate, Sequence)`. One migration. See [data-model.md](data-model.md).
- Domain: new `Domain/Imports/ImportOrdering.cs` (pure: direction inference, chronological groups);
  `Transaction` gains `Sequence`, set at creation.
- Confirm: `ConfirmImportService` orders review rows by `SourceRowNumber`, widens the existing same-range
  query to also project `Sequence` (one query serves duplicate detection and `max(Sequence)` per date),
  assigns each date group `max + 1 ..` (or `1 ..`), then inserts. Saved rows are never updated.
- List: `TransactionService` orders by date desc, `Sequence` desc; cursor becomes `date|sequence`; an invalid
  cursor's 400 gains a field-level `errors.cursor` entry and an invalid page size's 400 a field-level
  `errors.pageSize` entry (SEC-004).
- Period balances: `PeriodBalanceService` orders by date, `Sequence`.
- Review: `ImportReviewService.ToResponse` orders rows by `SourceRowNumber`.
- Endpoints: no new endpoints; response shapes unchanged; the list cursor's opaque content changes. See
  [contracts/transaction-order.md](contracts/transaction-order.md).
- Metrics: none new (existing import and transaction meters cover the paths). No new packages.

**Performance Goals**: Constitution defaults. Confirm adds no extra round trip for reads (the duplicate
query is widened) and no extra writes beyond the inserts; list paging stays an index seek on the new unique
index.

**Constraints**: Ordering never changes dates, descriptions, amounts, directions, balances or duplicate
detection (FR-009). No row content is logged (SEC-003). No UI change.

**Scale/Scope**: One column, one domain class, four service edits, one migration.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| ID | Applies | How the plan complies | Gate / evidence | Status |
|----|---------|-----------------------|-----------------|--------|
| ARC-001 | Yes | Ordering rules in `Domain/Imports/ImportOrdering.cs` with no EF/HTTP types; services only load, apply and save. Only spec'd behaviour; no UI. | Review | PASS |
| DOT-001 | Yes | .NET 10, async with `CancellationToken`; confirm stays inside the existing execution strategy and transaction. | Build, tests | PASS |
| DOT-002 | Yes | EF Core only; widened `AsNoTracking` projection; append-only sequence assignment (no update of saved rows); unique index backs ordering and cursor. SQL Server integration tests for confirm ordering and append after saved rows, paging across a same-date page boundary, period balances, delete, migration. | Independent query review, provider-backed integration tests | PENDING |
| AUD-001 | Yes (unchanged) | Existing `ImportConfirmed` audit row unchanged; no audit update or delete; sequences not written to audit text. | Audit append-only check | PASS |
| ENG-001 | Yes | Unit tests for `ImportOrdering` (all FR-012 branches, chronological groups, duplicates); integration tests per story; existing import, transaction and period-balance suites updated. | Test tasks, quality gates | PENDING |
| OPS-001 | Yes | Migration reviewed: additive column with a deterministic backfill for any existing rows so the unique index can be created; rollback restores the old index and drops the unique index, the check and the column. No new logs; existing health check covers the table. | Logging, health checks, migration review | PENDING |
| SEC-001 | Yes | No new endpoints; ownership checks unchanged. Cursor remains server-validated (length, base64url, exactly two `|` parts, `yyyy-MM-dd`, positive int with no sign, spaces or extra characters); invalid cursors return 400 with a field-level `cursor` error (SEC-004). | Independent security review | PENDING |
| SEC-002 | No | No configuration or secrets. | N/A | N/A |
| SEC-003 | Yes | Balances used for ordering are never logged or put in errors or audit text; cursor exposes only a date and a per-day position. | Security review | PENDING |
| SEC-004 | Yes | No new user-entered fields. The list cursor is the only changed input; it is validated completely on the server at decode (length, base64url, exactly two `|` parts, exact date, integer ≥ 1 with no sign, spaces or extra characters; see contracts/transaction-order.md). Failure returns 400 with field-level `errors` naming `cursor` and why ("The page cursor is not valid. Request the first page without a cursor."), disclosing no format, types or internals. The same endpoint's existing `pageSize` 400 (outside 1..maximum) gains a field-level `errors.pageSize` entry (title and detail unchanged), so every input of the changed endpoint meets SEC-004. No UI input changes (the UI never builds cursors). | Integration tests (T013, T027), security review | PENDING |
| WEB-001 | No | No clutch-web changes: the UI renders rows in server order (spec Assumptions). | N/A | N/A |
| Perf & Observability | Yes (unchanged) | No new user action; confirm and list keep their existing metrics and feedback. | 500 ms feedback, OpenTelemetry metrics | PASS |

**Post-design re-check (Phase 1)**: No violations. Every PENDING gate maps to a `/speckit-tasks` task:
tests (ENG-001, DOT-002), query review and migration review (DOT-002, OPS-001), security review (SEC-001,
SEC-003, SEC-004). The migration backfill is a safety measure for the unique index, not the legacy ordering
FR-008 rules out (research R6).

## Project Structure

### Documentation (this feature)

```text
specs/022-preserve-import-order/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── transaction-order.md
└── tasks.md             # /speckit-tasks output
```

### Source Code (files this feature touches)

```text
src/Clutch.API/
├── Domain/Transactions/Transaction.cs                   # changed: Sequence; TryCreate takes it
├── Domain/Imports/ImportOrdering.cs                     # new: direction, chronological groups
├── Application/Imports/ConfirmImportService.cs          # changed: order rows, append groups after saved rows
├── Application/Imports/ImportReviewService.cs           # changed: ToResponse orders by SourceRowNumber
├── Application/Transactions/TransactionService.cs       # changed: order and cursor by Sequence
├── Application/Mortgages/PeriodBalanceService.cs        # changed: ThenBy Sequence
├── Domain/Mortgages/PeriodBalances.cs                   # changed: Lookup ordering comment
├── Infrastructure/Persistence/AppDbContext.cs           # changed: Sequence, check, unique index
└── Infrastructure/Persistence/Migrations/*_TransactionSequence.cs   # new

tests/Clutch.API.Tests/
├── Unit/Imports/ImportOrderingTests.cs                  # new
├── Unit/TransactionBalanceTests.cs                      # changed: TryCreate signature
├── Integration/Accounts/FamilyAccountAuthorizationTests.cs        # changed: TryCreate helper sequences
├── Integration/Imports/DuplicateAndConcurrencyTests.cs           # changed: TryCreate helper sequences
├── Integration/Mortgages/MortgageTestSupport.cs                  # changed: TryCreate helper sequences
├── Integration/Persistence/ImportCoordinationMigrationTests.cs   # changed: TryCreate helper sequences
├── Integration/Transactions/TransactionServiceDeleteTests.cs     # changed: TryCreate helper sequences
├── Integration/Transactions/TransactionDeleteEndpointTests.cs    # changed: TryCreate helper sequences
├── Integration/Imports/ImportOrderTests.cs              # new: US1, US3, FR-002 append, SC-004
├── Integration/Transactions/TransactionOrderTests.cs    # new: list order, paging boundary, delete, cursor
├── Integration/Mortgages/PeriodBalancesTests.cs         # changed: TryCreate helper sequences; US2 same-day period end
└── Integration/Persistence/TransactionSequenceMigrationTests.cs   # new: up/down, backfill, unique index
```

**Structure Decision**: Existing layout, following sibling files. `ImportOrdering` sits beside
`ImportReview`/`ImportReviewRow` in `Domain/Imports` because it orders import rows; services keep the
persistence steps.

## Complexity Tracking

No constitution violations to justify.
