# Research: Unify Audit Events

## Decision: Use the existing EF Core and SQL Server persistence stack

**Rationale**: `Clutch.API` targets .NET 10 and references Entity Framework Core 10 with
the SQL Server provider. `AppDbContext` is the established persistence boundary, and
integration tests already use disposable SQL Server containers.

**Alternatives considered**: Adding a second persistence mechanism or database provider
would violate repository policy and is unnecessary for this internal data change.

**Evidence**: `src/Clutch.API/Clutch.API.csproj`,
`src/Clutch.API/Infrastructure/DependencyInjection.cs`,
`tests/Clutch.API.Tests/Clutch.API.Tests.csproj`.

## Decision: Create the canonical Audit table and backfill both source tables

**Rationale**: The existing import table includes a review reference and has no
Description; the deletion table holds a transaction reference and has no Description.
This feature creates the canonical `Audit` table required by the constitution; its
"existing Audit table" requirement refers to the table established by this feature,
not a table that predates the feature. The table follows the import audit fields while
excluding both obsolete references and adding deletion context. Generate a new Audit
row key rather than reusing source transaction or review identifiers.

Map import actor, occurrence time, and event code without changing their values. Resolve
the account's required, nonblank `Description` while the source `AccountId` is available
and include that human-readable context in Audit `Description`, without retaining the ID or creating an
Audit-to-Account relationship. Map deletion actor directly, `DeletedAtUtc` to
`OccurredAtUtc`, set `EventCode` to `TransactionDelete`, and use generic
review-and-deletion wording for historical descriptions because the old deletion rows
contain no transaction details. Always include the account's nonblank description in
Description. For new deletion events, capture transaction and account descriptions before deletion;
store event time in `OccurredAtUtc` and do not include review outcomes or review dates.
Every Audit EventCode and Description is required and nonblank. Since every account has
a nonblank description, no missing-account-description fallback is permitted. If a
historical source account row cannot be resolved, or an import EventCode is blank, fail
consolidation atomically and leave the source rows intact. Copy all rows atomically
before retiring the source tables and verify row counts and mapped values.

**Alternatives considered**: Joining historical deletion rows to transaction or review
records is unreliable because those records may already be gone. Retaining transaction
or review IDs would contradict the specification. Requiring a pre-feature Audit table
would contradict the clarified scope.

**Evidence**: `src/Clutch.API/Domain/Imports/ImportAuditEvent.cs`,
`src/Clutch.API/Domain/Transactions/TransactionDeletionAudit.cs`,
`src/Clutch.API/Domain/Accounts/Account.cs`,
`src/Clutch.API/Infrastructure/Persistence/AppDbContext.cs`,
`src/Clutch.API/Infrastructure/Persistence/Migrations/20261114205105_AddTransactionDeletionAudit.cs`.

## Decision: Capture deletion context before removing the transaction

**Rationale**: Future deletion descriptions must remain useful after the transaction is
removed. The deletion flow must capture the transaction description and account description
before deleting source data and always include the nonblank account description in
Audit `Description`; include the transaction description when available. The
event date/time is recorded in `OccurredAtUtc`; deletion descriptions do not include
review outcomes or review dates. Description must not contain transaction, review,
acting-user, or account IDs. Where historical context is unavailable, use generic
review-and-deletion wording rather than inventing details.

**Alternatives considered**: Constructing descriptions after deletion or resolving them
later would rely on data that may no longer exist.

**Evidence**: `src/Clutch.API/Application/Transactions/TransactionService.cs`,
`specs/010-unify-audit-events/spec.md`.

**Review disposition**: An independent security review noted that repeated transaction
descriptions cannot uniquely identify the deleted source transaction. The specification
prohibits retaining `TransactionId`, so new deletion descriptions include the exact
duplicate-detection fingerprint used by imports: transaction date, description, amount,
and direction. Historical deletion rows lack those details and retain generic wording.
Do not add a hidden identifier or infer transaction identity from description text.

## Decision: Enforce immutability in the application and SQL Server

**Rationale**: Application insertion-only patterns alone do not prevent persistence
updates or deletes. Keep audit operations insert-only and add a SQL Server database
guard that rejects updates and deletes for every Audit row. Do not retain foreign keys
to accounts, transactions, or import reviews, and do not cascade-delete audit rows.
Test rejected mutations against the production database provider and verify the row
remains unchanged after each rejected operation. Deleting an account must also leave its
Audit descriptions, including their account context, intact.

**Alternatives considered**: Relying only on private setters or code conventions does
not enforce database immutability. A guard limited to the old deletion table does not
protect unified import and deletion history.

**Evidence**: Existing deletion immutability trigger in
`src/Clutch.API/Infrastructure/Persistence/Migrations/20261114205105_AddTransactionDeletionAudit.cs`;
constitution requirement `AUD-001`.

## Decision: Treat migration recovery as forward-only after consolidation

**Rationale**: A down migration that removes copied Audit rows would violate
immutability, as would dropping the Audit table. Make the consolidation migration
forward-only after commit. Deploy the schema and backfill transactionally, verify the
complete copy before retiring source tables, retain the pre-deployment database backup,
and recover from post-deployment issues with a forward migration that preserves Audit
rows. The migration's `Down` operation must be unsupported rather than delete or alter
Audit records or remove the table. Deleted transaction identifiers cannot be
reconstructed from the new data model.

**Alternatives considered**: A destructive rollback would violate `AUD-001` and risk
permanent audit data loss. Reconstructing source tables cannot restore transaction or
review references that the feature intentionally removes.

**Evidence**: Constitution requirements `AUD-001` and `OPS-001`; feature requirements
`FR-006` through `FR-009`.

## Decision: No external contract artifact

**Rationale**: The feature changes internal persistence and event-writing behavior.
The specification does not add or change an API endpoint or other external interface.

**Alternatives considered**: Adding an API contract would expand scope without a
specified consumer or behavior.
