# Data Model: Delete Imported Transactions

**Feature**: 009-delete-transactions | **Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

## Existing entity: Transaction (unchanged schema)

Source: [Transaction.cs](../../src/Clutch.API/Domain/Transactions/Transaction.cs), mapped in [AppDbContext.cs](../../src/Clutch.API/Infrastructure/Persistence/AppDbContext.cs) at lines ~202-235.

| Field | Notes |
|-------|-------|
| Id | Primary key (guid) |
| AccountId | FK to Account, `DeleteBehavior.Restrict` |
| TransactionDate, Description, Amount, Balance, Direction | Imported values. Never modified by this feature. |

Deletion is a hard delete of one row. No soft-delete column is added (FR-008).

## New entity: TransactionDeletionAudit

Table: `TransactionDeletionAudits`

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| Id | guid | PK | Generated on creation |
| ActingUserId | string(256) | Required | Signed-in user from `ClaimTypes.NameIdentifier` |
| AccountId | guid | Required | Account the transaction belonged to. No FK, so the audit row outlives the account reference if needed. |
| TransactionId | guid | Required | Identifier of the deleted transaction. No FK, because the row is removed. |
| DeletedAtUtc | datetime2 | Required | Set by the server at the time of deletion |

**Indexes**: Index on `(ActingUserId, DeletedAtUtc)` for later review queries. Index is optional and not used by this feature; add it only if the migration review asks for it.

**Forbidden fields** (SEC-003): description, amount, balance, date, direction, category, import review id, and any free text.

**Lifecycle**: Insert-only. Rows are written in the same `SaveChangesAsync` as the transaction delete. Never updated or deleted by the application. Not exposed by any endpoint or UI (FR-015).

**Immutability**: A trigger on `TransactionDeletionAudits` rejects UPDATE and DELETE statements. Retention is indefinite, so no purge process exists.

**Migration**: One additive migration creating the table and the immutability trigger. No data backfill. Rollback is roll-forward only. The EF `Down` method drops the trigger and table, so it must not be run in any environment that already holds audit rows, because that would destroy the audit trail. To back out, revert the endpoint and leave the table in place. See OPS-001 review in [plan.md](./plan.md).

## Relationships

```text
Account 1 ── * Transaction
Transaction ─ ─ ─ (deleted) ─ ─ ─ TransactionDeletionAudit (AccountId, TransactionId, no FK)
```

## State transitions

```text
Transaction: Present ──(confirmed delete)──> Absent
TransactionDeletionAudit: (none) ──(same save as delete)──> Recorded
```

A transaction can be absent again only through a fresh import, which creates a new row with a new `Id`. The audit row for the old id stays unchanged.

## Validation rules

- `transactionId` and `accountId` must be non-empty guids (enforced by route constraints `:guid`).
- The transaction must belong to the account in the path, and the account must be owned by the signed-in user. Otherwise the result is 404 (FR-013).
- Delete is permitted for every transaction shown in the account list (FR-010). No other filter applies.
