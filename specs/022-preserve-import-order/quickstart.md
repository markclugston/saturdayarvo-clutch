# Quickstart: Validation

Prerequisites: Docker (SQL Server integration fixture), .NET 10 SDK.

```powershell
dotnet build
dotnet test --filter "FullyQualifiedName~ImportOrdering|FullyQualifiedName~ImportOrder|FullyQualifiedName~TransactionOrder|FullyQualifiedName~PeriodBalances|FullyQualifiedName~TransactionSequenceMigration"
dotnet test
```

Expected:

- Unit (`ImportOrderingTests`): balances pick newest-first and oldest-first; balances reconcile both ways
  (single row) or neither → dates decide; all same date and balances undecided → newest first; non-monotonic
  dates use first vs last; any missing balance → dates decide; newest-first files reverse each date's rows,
  oldest-first files keep them.
- Integration, SQL Server (`ImportOrderTests`): newest-first and oldest-first files with ≥ 3 same-date rows
  list in FR-004 order (SC-001); consecutive same-date rows from one import reconcile (SC-004); review lists
  rows in file order (US3); a later import on a date with saved rows is stored after them in its own order,
  whatever the balances (FR-002, scenario 4); saved rows' sequences are unchanged; possible duplicates keep
  their own positions; saved fields and duplicate flags are unchanged (FR-009).
- Integration (`TransactionOrderTests`): same order on reload; page size smaller than a same-date group pages
  without repeats or gaps (SC-002); deleting a middle row keeps the rest in order; old-format or malformed
  cursor → 400 with `errors.cursor` and no internal details (SEC-004).
- Integration (`PeriodBalancesTests`): period ending on a day with balances 1,000, 900, 800 shows 800 (SC-003),
  both from seeded sequences and from a newest-first file confirmed through the import path (US2).
- Migration (`TransactionSequenceMigrationTests`): up on a database with same-date rows backfills unique
  sequences; the check rejects 0; down restores the old index.
- Full suite passes.
