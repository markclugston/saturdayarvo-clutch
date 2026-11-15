# Implementation Plan: Unify Audit Events

**Branch**: `010-unify-audit-events` | **Date**: 2026-11-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/010-unify-audit-events/spec.md`

## Summary

Replace the separate transaction-deletion and import audit stores with an immutable,
append-only `Audit` store. Preserve import event values, backfill deletion events as
`TransactionDelete` records with a non-ID description, and remove transaction, review, and
account identifiers. New deletion descriptions include the transaction date, description,
amount, and direction (the fields in the import duplicate fingerprint) when available.
Store deletion event time in `OccurredAtUtc`; do not include review
outcomes or review dates in deletion descriptions. Include human-readable account context
inside Description rather than adding an account-description column, and enforce immutability
in application behavior and at the SQL Server boundary. This feature creates the canonical
`Audit` table required by the constitution; "existing Audit table" refers to that table after
this feature establishes it, not to a pre-feature table in the current schema.

## Technical Context

**Language/Version**: C# on .NET 10

**Primary Dependencies**: ASP.NET Core; Entity Framework Core 10; SQL Server provider

**Storage**: SQL Server

**Testing**: xUnit, NSubstitute, ASP.NET Core `WebApplicationFactory`, Testcontainers for SQL Server

**Target Platform**: ASP.NET Core API service

**Project Type**: Backend web service; internal audit persistence, no new external interface

**Performance Goals**: No feature-specific throughput target. Preserve existing user-action response
requirements and verify the one-time audit backfill completes without losing source records.

**Constraints**: All database access uses EF Core. Audit rows are append-only and cannot be updated
or deleted or dropped by application operations, background work, or migrations. The consolidation
migration must be all-or-nothing and forward-only after commit. No transaction, review, or account
identifier or foreign key may be retained. EventCode and Description must be nonblank and required;
Descriptions must not contain IDs and must include the related account's nonblank human-readable
description. The existing account model enforces that every account has a nonblank description.
Append Audit records within existing import/deletion persistence operations without adding avoidable
read round trips, preserving existing user-action response requirements.

**Scale/Scope**: One-time consolidation of all existing rows in `ImportAuditEvents` and
`TransactionDeletionAudits`, plus future import and transaction-deletion events.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Requirement | Gate |
|---|---|
| Principle I / ARC-001 | PASS — Keep the change within existing domain, application, and EF Core persistence boundaries; no UI or unrequested interface is introduced. |
| Principle II / DOT-001 | PASS — Use the existing .NET 10 project conventions, asynchronous database operations, nullable reference types, and warnings-as-errors build. |
| Principle III / DOT-002 | PASS — Use EF Core for database access, preserve SQL Server query/migration conventions, and obtain the required independent review of generated SQL and migration statements. |
| Principle III / AUD-001 | PASS — This feature creates the canonical `Audit` table, after which all audit data is stored there. Writes are insert-only; reject updates and deletes in the database, and do not create migrations that alter or remove rows already in `Audit`. Store account context in Description without an account relationship. |
| Principle IV / ENG-001 | PASS — Add automated unit and SQL Server integration coverage for mapping, migration/backfill, transaction deletion, and immutability. |
| Principle V / SEC-001, SEC-003 | PASS — Keep the existing authorization boundary; descriptions contain only allowed human-readable context and no IDs or sensitive diagnostic data. Perform the required OWASP Top 10 review. |
| Principle VII | CONDITIONAL — Add no new user-facing actions or interfaces; write Audit records within existing import/deletion persistence operations and have the independent SQL review assess query shape and avoidable round trips. Do not mark this gate PASS until T012's warmed API/SQL Server integration checks measure at least five import-confirmation and five transaction-deletion requests, each under 500 ms; resolve failures before acceptance. |
| Principle VIII | PASS — Preserve the existing OpenTelemetry import-success count and transactions-per-minute instruments in `ImportMetrics`; T013 runs their focused unit test alongside the audit and API tests. |
| Engineering Requirements / OPS-001 | PASS — Review the migration for data loss, verify copied-row counts and mappings, run the backfill atomically, and provide a forward-recovery strategy because immutable audit data cannot be deleted to roll back. |

Constitution alignment is planned. Principle VII remains conditional until the automated
response-time checks in T012 pass.

## Project Structure

### Documentation (this feature)

```text
specs/010-unify-audit-events/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── spec.md
```

### Source Code

```text
src/Clutch.API/
├── Application/Imports/ConfirmImportService.cs
├── Application/Transactions/TransactionService.cs
├── Domain/Imports/
├── Domain/Transactions/
├── Infrastructure/Imports/ImportAuditWriter.cs
└── Infrastructure/Persistence/
    ├── AppDbContext.cs
    └── Migrations/

tests/Clutch.API.Tests/
├── Unit/Transactions/
└── Integration/
    ├── Imports/
    ├── Persistence/
    └── Transactions/
```

**Structure Decision**: Extend the existing `Clutch.API` domain/application/persistence
layers and `Clutch.API.Tests` project. Audit history is internal to the service, so no
new public API contract or frontend work is in scope.
