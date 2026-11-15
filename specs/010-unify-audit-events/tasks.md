# Tasks: Unify Audit Events

**Input**: Design documents from `specs/010-unify-audit-events/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `quickstart.md`

**Tests**: Included because the specification, plan, constitution, and quickstart require automated unit and SQL Server integration coverage.

## Phase 1: Setup

**Purpose**: Project initialization and basic structure

The .NET API, EF Core persistence, and SQL Server Testcontainers test infrastructure already exist. No setup changes are required.

---

## Phase 2: Foundational

**Purpose**: Establish the shared Audit model and persistence mapping required by both user stories.

- [X] T001 Create the `Audit` entity with its own generated key, actor, occurrence time, required nonblank EventCode, and required nonblank Description in `src\Clutch.API\Domain\Audit\Audit.cs`; include the account's nonblank human-readable description in Description and do not add `AccountDescription`, `AccountId`, `TransactionId`, or `ReviewId` fields.
- [X] T002 Add the `Audits` DbSet and EF Core mapping in `src\Clutch.API\Infrastructure\Persistence\AppDbContext.cs`; make EventCode and Description required and enforce both as nonblank, and use no account/transaction/review foreign keys.

**Checkpoint**: Both user stories can target the canonical Audit table introduced by this feature.

---

## Phase 3: User Story 1 - Review unified audit history (Priority: P1)

**Goal**: Preserve import audit behavior in the unified Audit collection.

**Independent Test**: Confirm an import through the existing API workflow and verify that an Audit record preserves its actor and occurrence time, has a nonblank EventCode, includes its account's nonblank human-readable description in Description, and does not store AccountId or ReviewId.

### Tests for User Story 1

- [X] T003 [P] [US1] Extend SQL Server import workflow coverage in `tests\Clutch.API.Tests\Integration\Imports\ImportWorkflowTests.cs` to assert import events are written to Audit with required nonblank EventCode and Description, actor, occurrence time, and the account's nonblank description in Description, without `AccountId` or `ReviewId`.

### Implementation for User Story 1

- [X] T004 [US1] Update `ImportAuditWriter` and its calls in `src\Clutch.API\Infrastructure\Imports\ImportAuditWriter.cs` and `src\Clutch.API\Application\Imports\ConfirmImportService.cs` to append Audit records with nonblank event code and Description containing the account's nonblank description while preserving import actor, timestamp, and event code values without storing review or account identifiers.

**Checkpoint**: New import audit events use the canonical Audit table and are independently verifiable.

---

## Phase 4: User Story 2 - Understand a deleted transaction event (Priority: P1)

**Goal**: Record a useful TransactionDelete event as part of deleting a transaction, without retaining its identifiers.

**Independent Test**: Delete a transaction through the service and inspect Audit after the transaction is unavailable; verify the actor, event code, timestamp, human-readable context, and absence of transaction/review/account identifiers.

### Tests for User Story 2

- [X] T005 [P] [US2] Extend SQL Server deletion coverage in `tests\Clutch.API.Tests\Integration\Transactions\TransactionServiceDeleteTests.cs` to assert a successful delete appends a `TransactionDelete` Audit record atomically with the deletion; verify the actor and occurrence time, nonblank EventCode and Description, review/deletion wording, account description, duplicate-fingerprint details (date, description, amount, direction), and absence of transaction, review, and account identifiers.

### Implementation for User Story 2

- [X] T006 [US2] Update `TransactionService.DeleteAsync` in `src\Clutch.API\Application\Transactions\TransactionService.cs` to capture transaction date, description, amount, direction, and account description before deletion; append a `TransactionDelete` Audit record atomically, store event time in `OccurredAtUtc`, use generic transaction wording when details are unavailable, and never put IDs, review outcomes, or review dates in Description.

**Checkpoint**: Transaction deletion writes its audit record in the same persistence operation and does not depend on deleted records afterward.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Consolidate historical data, retire source stores, enforce immutability, and verify migration and behavior.

- [X] T007 [P] Add SQL Server migration integration tests in `tests\Clutch.API.Tests\Integration\Persistence\AuditMigrationTests.cs` for exactly-once import and deletion backfill, required nonblank account context in Description, historical transaction fallback descriptions, atomic migration failure when a source account cannot be resolved or an import EventCode is blank and safe retry, account deletion retaining Audit rows, required nonblank EventCode/Description constraints, and database rejection of Audit `UPDATE` and `DELETE` with the row remaining unchanged.
- [X] T008 Remove the old audit DbSets and EF mappings from `src\Clutch.API\Infrastructure\Persistence\AppDbContext.cs` and remove the obsolete entity files `src\Clutch.API\Domain\Imports\ImportAuditEvent.cs` and `src\Clutch.API\Domain\Transactions\TransactionDeletionAudit.cs` after both writers use Audit.
- [X] T009 Add the EF Core consolidation migration under `src\Clutch.API\Infrastructure\Persistence\Migrations\` and update `src\Clutch.API\Infrastructure\Persistence\Migrations\AppDbContextModelSnapshot.cs`; create the canonical Audit table with nonblank EventCode and Description, copy both sources transactionally with each related account description in Description, use `TransactionDelete` and generic historical transaction wording for deletion rows, and verify copied counts before commit. If any source account row cannot be resolved or an import EventCode is blank, fail atomically with sources intact. Enforce SQL Server rejection of Audit updates/deletes; implement `Down` as unsupported and recover forward without altering or dropping Audit rows or the table.
- [X] T010 Generate the consolidation SQL and obtain the constitution-required independent agent review of SQL queries/statements generated for the import and deletion writers in `src\Clutch.API\Infrastructure\Imports\ImportAuditWriter.cs`, `src\Clutch.API\Application\Imports\ConfirmImportService.cs`, and `src\Clutch.API\Application\Transactions\TransactionService.cs`, as well as the EF operations and migration in `src\Clutch.API\Infrastructure\Persistence\AppDbContext.cs` and `src\Clutch.API\Infrastructure\Persistence\Migrations\`; assess query shape, indexing, avoidable round trips, and migration data loss, and resolve findings.
- [X] T011 Obtain an independent OWASP Top 10 review of the changed import, deletion, and persistence paths in `src\Clutch.API\Application\Transactions\TransactionService.cs`, `src\Clutch.API\Infrastructure\Imports\ImportAuditWriter.cs`, `src\Clutch.API\Application\Imports\ConfirmImportService.cs`, and `src\Clutch.API\Infrastructure\Persistence\Migrations\`; resolve and verify any findings.
- [X] T012 Add SQL Server integration response-time coverage to `tests\Clutch.API.Tests\Integration\Imports\ImportWorkflowTests.cs` and `tests\Clutch.API.Tests\Integration\Transactions\TransactionDeleteEndpointTests.cs`; after application/database startup and one unmeasured warm-up request per action, measure at least five import-confirmation and five transaction-deletion requests individually with a client-side elapsed-time measurement, and assert every measured response completes in under 500 ms in an otherwise idle fixture.
- [X] T013 Run the focused audit tests, the import metrics unit test `tests\Clutch.API.Tests\Unit\Imports\ImportMetricsTests.cs`, the response-time coverage from T012, and the full API test project in `tests\Clutch.API.Tests\Clutch.API.Tests.csproj` after resolving review findings; verify import metrics and the 500 ms response-time criterion pass.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No changes; existing project and test infrastructure are used.
- **Foundational (Phase 2)**: T001 precedes T002; both must complete before user-story work.
- **User Stories (Phases 3-4)**: Both depend on Phase 2 and can be implemented in parallel. Within each story, complete its tests before its implementation task.
- **Polish (Phase 5)**: T007 can be authored after the foundation and before T009. T008 depends on T004 and T006. T009 depends on T007 and T008. T010 and T011 depend on T009; T012 depends on T004, T006, and T009; T013 follows T010, T011, T012, and any required fixes.

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Phase 2; no dependency on User Story 2 for its import writer and workflow test.
- **User Story 2 (P1)**: Starts after Phase 2; no dependency on User Story 1 for its deletion writer and test.
- The historical consolidation migration is cross-cutting and runs only after both writers use Audit; it is not a prerequisite for either story's independent live-writer test.

### Parallel Opportunities

- T003 and T005 can be authored in parallel after Phase 2 because they affect separate test files.
- After their respective tests are authored, T004 and T006 can proceed in parallel because they update separate event-writing paths.
- T007 migration tests can be authored independently of the live-writer changes; T008 must wait for both writers, and T009 must wait for both T007 and T008.
- T010 and T011 are separate independent reviews and can proceed in parallel after T009.
- T012 response-time tests require both live writers and the consolidated persistence schema; T013 runs them after implementation and reviews are complete.

## Parallel Example: User Story 1 and User Story 2

```text
# After T001-T002:
Task: T003 - Extend import workflow integration coverage in tests\Clutch.API.Tests\Integration\Imports\ImportWorkflowTests.cs
Task: T005 - Extend transaction deletion integration coverage in tests\Clutch.API.Tests\Integration\Transactions\TransactionServiceDeleteTests.cs

# After each story's test is authored:
Task: T004 - Switch import audit writing to Audit
Task: T006 - Switch transaction deletion audit writing to Audit
```

## Implementation Strategy

### MVP

The two P1 stories share the Audit model and must both switch their writers before the source tables can be retired safely. Deliver the smallest complete increment as Phase 2, both user stories, and the consolidation migration in T007-T009; this produces one usable Audit history without leaving a live writer pointed at a retired table.

### Incremental Delivery

1. Complete Phase 2 and validate the shared Audit model and mapping.
2. Implement and independently test the import path and transaction-deletion path; these can proceed in parallel.
3. Add migration tests, retire the old entity mappings after both writers switch, and apply the all-or-nothing consolidation migration.
4. Complete independent SQL and security reviews, resolve findings, and run T012.
