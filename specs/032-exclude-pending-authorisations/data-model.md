# Data Model: Exclude Pending Authorisations From Imports

## ImportReviewRow (changed)

| Field | Type | Constraints |
|---|---|---|
| `IsExcluded` | `bool`, column `bit NOT NULL DEFAULT 0` on `ImportReviewRows` (default set by the migration only; a model default would split the batched insert) | Set once at construction from `ImportExclusions` (spec FR-001..FR-003, research R1). |

Invariants:

- An excluded row is never a possible duplicate: the constructor rejects `isExcluded && isPossibleDuplicate`, and `MarkPossibleDuplicate` leaves an excluded row unchanged (FR-006).

## ImportReview (changed behaviour, no new fields)

- `DuplicateConfirmationRequired` is true only when a non-excluded row is a possible duplicate.
- Duplicate detection at review creation and confirm considers only non-excluded rows.
- A review may consist entirely of excluded rows; confirming it saves no transactions and completes as a normal confirm (settings saved, lease released, `ImportConfirmed` audited, `ImportedCount` 0).

## ImportExclusions (new, pure domain)

- Input: rows (`ImportOrderRow` plus description) and whether the mapping has a balance column (`ImportMapping.BalanceColumn` not null).
- Output: chosen `ImportDirection` and the set of excluded source row numbers.
- Description rule: description matches any pattern in spec FR-002, held as one source-generated regular expression with `IgnoreCase` and `CultureInvariant`. The patterns have no nested or unbounded repetition, and descriptions are length limited.

## Migration

- `<timestamp>_ExcludePendingAuthorisations`: add `IsExcluded bit NOT NULL DEFAULT 0` to `ImportReviewRows`.
- Rollback: drop the column. Backfill: none; existing review rows default to included, matching prior behaviour, and expire within 5 minutes.
