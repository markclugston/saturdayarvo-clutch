# Quickstart: Unify Audit Events

## Prerequisites

- .NET 10 SDK
- Docker available to run the SQL Server Testcontainers used by integration tests
- Repository dependencies restored

## Validate Audit behavior

From the repository root, run the focused audit tests:

```powershell
dotnet test .\tests\Clutch.API.Tests\Clutch.API.Tests.csproj --filter "FullyQualifiedName~Audit"
```

The tests should pass for unit-level event mapping and SQL Server integration scenarios.
Integration coverage must verify both source-table backfills, preserved import values,
deletion event code and occurrence timestamp mapping, the transaction date/description/amount/direction
in new deletion descriptions, generic wording when historical transaction context is unavailable,
required nonblank account context in Description without AccountId,
all-or-nothing retry behavior, preservation of Audit rows after account deletion, and
rejection of Audit update/delete operations with each row unchanged afterward.

Run the import metrics unit test to verify the successful transaction count and
transactions-per-minute instruments remain available:

```powershell
dotnet test .\tests\Clutch.API.Tests\Clutch.API.Tests.csproj --filter "FullyQualifiedName~ImportMetricsTests"
```

The import workflow and transaction deletion integration tests must also measure
client-observed response time after application/database startup and one unmeasured
warm-up request per action. At least five requests per action must each complete in
under 500 milliseconds in an otherwise idle SQL Server Testcontainers fixture.

## Validate the full API test suite

```powershell
dotnet test .\tests\Clutch.API.Tests\Clutch.API.Tests.csproj
```

The suite should pass with the unified table while preserving transaction deletion
atomicity, import behavior, and existing migration behavior.

## Review before release

- Confirm source import and deletion row counts match the rows copied into Audit.
- Obtain an independent agent review of generated SQL and migration statements for query shape, indexing,
  round trips, and data loss.
- Confirm no Audit mutation paths or foreign keys to account, transaction, or review
  data remain, and that every Audit Description includes the account's nonblank description
  without IDs.
- Confirm a pre-deployment backup and forward-recovery approach are documented. The
  consolidation migration's `Down` operation must be unsupported; do not use a rollback
  that deletes or alters persisted Audit rows or drops the Audit table.
