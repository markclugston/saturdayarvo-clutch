# Data Model: Unify Audit Events

## Audit

One immutable record for an import event or transaction deletion event.

| Field | Meaning and constraints |
|---|---|
| `Id` | Database-generated primary key for the Audit row. It is not a transaction ID or review ID. |
| `ActingUserId` | Required actor value preserved from either source record. |
| `OccurredAtUtc` | Event time. Import value is preserved; deletion `DeletedAtUtc` maps to this field. |
| `EventCode` | Required, nonblank string; preserves the original import event code or is `TransactionDelete` for a deletion. |
| `Description` | Required nonblank human-readable event description. Include the account's nonblank description; new transaction deletion descriptions include transaction date, description, amount, and direction when available. Never include IDs or review outcomes/dates. `OccurredAtUtc` stores the event date/time. |

### Relationships

- Audit has no foreign-key relationship to Accounts, transactions, or import reviews.
- Account context is a value snapshot inside Description, so account deletion does not change or remove Audit rows.

### Lifecycle and immutability

- New import and transaction-deletion events create Audit records.
- After persistence, an Audit record cannot be updated or deleted by application operations, background work, or migrations; migrations cannot drop the Audit table.
- Corrections and subsequent information are represented by additional Audit records.
- A database-level SQL Server guard rejects update and delete operations on Audit rows.
- SQL Server integration tests verify rejected update/delete attempts leave Audit rows unchanged and account deletion does not change or remove account context in Description.
- The consolidation migration is forward-only after commit; post-deployment recovery must preserve Audit rows.
- The consolidation migration's `Down` operation is unsupported; recovery proceeds only through forward migrations that preserve Audit records and the table.

## Source-to-Audit mapping

| TransactionDeletionAudits | ImportAuditEvents | Audit |
|---|---|---|
| `ActingUserId` | `ActingUserId` | `ActingUserId` |
| `AccountId` | `AccountId` | Required account description included in `Description` |
| `TransactionId` | — | Not retained |
| `DeletedAtUtc` | `OccurredAtUtc` | `OccurredAtUtc` |
| — | `ReviewId` | Not retained |
| — | `EventCode` | `EventCode` |
| — | — | `Description` |
| Source row key | Source row key | New database-generated Audit key |

For new deletion events, set nonblank `EventCode` to `TransactionDelete` and include the
transaction's duplicate-detection fingerprint—date, description, amount, and direction—
when available, along with the account's nonblank description in `Description`. Store the
event date/time in `OccurredAtUtc`; do not include a review outcome or review date. Existing
deletion rows have no recoverable transaction details in their source record, so use generic
wording while always including the required account description. For both source types, resolve the
account description while the source account identifier is available and include it in
the human-readable `Description`, but do not retain the identifier. For import rows,
preserve the nonblank event code and include event/account context in a required
`Description`. Every account has a nonblank description. If a source event's account row
cannot be resolved, fail consolidation atomically and retain source rows.

## Validation rules

- Every row from both source tables is represented exactly once after consolidation.
- `TransactionId`, `ReviewId`, and `AccountId` are absent from the Audit schema and row data.
- Every account has a nonblank description, preserved in `Description` without an account relationship.
- `EventCode` and `Description` are nonblank and required for every Audit record.
- The database rejects Audit rows with a blank EventCode or Description.
- Existing import field values and event codes are preserved.
- Every deletion uses `TransactionDelete`, maps its timestamp, and has a non-ID Description.
- Audit updates and deletes are rejected by the database.
