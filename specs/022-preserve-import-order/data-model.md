# Data Model: Preserve Import Order For Same-Date Transactions

## Transaction (changed)

| Field | Type | Rules |
|---|---|---|
| `Sequence` | `int`, required | ≥ 1. Chronological position among the account's transactions on `TransactionDate` (1 = earliest). Unique per `(AccountId, TransactionDate)`. Gaps allowed. Set only at creation (append after saved rows, R4); never changed afterwards; never by API input. |

- Index: unique `IX_Transactions_AccountId_TransactionDate_Sequence` replaces
  `IX_Transactions_AccountId_TransactionDate`.
- Check: `CK_Transactions_PositiveSequence` (`[Sequence] >= 1`).
- `Transaction.TryCreate` takes `sequence` and rejects values < 1. Relative order of saved rows never changes
  (FR-002); delete leaves a gap (edge case).
- Authoritative order of an account's transactions: `(TransactionDate, Sequence)` ascending (FR-010).

## ImportOrdering (new, domain, not persisted)

Pure functions over import rows in file order (`SourceRowNumber`, date, amount, direction, balance):

- `InferDirection(rows) → NewestFirst | OldestFirst` (research R2).
- `ChronologicalGroups(rows, direction) → per date, rows earliest → latest` (R3).
Reconcile rule (FR-011), used only inside `InferDirection`: `later.Balance == earlier.Balance + (Incoming ?
Amount : −Amount)`; a null balance on either side does not reconcile.

Placement among saved rows is not a domain rule: confirm appends each group after the date's
`max(Sequence)` (R4).

## ImportReviewRow (unchanged)

`SourceRowNumber` is the file position (FR-001) and drives review order (FR-007) and the group order; no
schema change. It is not copied onto `Transaction`: `Sequence` carries the order.

## Migration `TransactionSequence`

- Up: add `Sequence int NOT NULL DEFAULT 0`; backfill `ROW_NUMBER() OVER (PARTITION BY AccountId,
  TransactionDate ORDER BY CreatedAtUtc, Id)`; drop default; add check; create unique index; drop old index.
- Down: create old index; drop unique index, check and column.
- Data loss: none on up; down discards order only.
