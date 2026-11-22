# Data Model: Mortgage Account Balance Column

## Mortgage (`Mortgages` table), changed

| Field | Type | Rules |
|---|---|---|
| AccountId | `uniqueidentifier` NULL, FK → `Accounts` (`SetNull`) | Optional; must be an account owned by `OwnerUserId` when set |

- Index `IX_Mortgages_AccountId`.
- `Mortgage.Create` / `Update` take `Guid? accountId`; `Update` still bumps `Version` always.
- `MortgageCandidate` gains `string? AccountId` (blank/null = none; not a GUID = field error
  `accountId`: "Choose one of your accounts"). `MortgageService` adds the same error when the account
  is not the caller's.
- Request and response gain `accountId` (string GUID or null).

## Account / Transaction

Unchanged (FR-001). Read only: `Transaction.TransactionDate`, `Balance`, `Id`.

## Period balance (derived, not stored)

`PeriodBalances` (Domain): inputs = ordered `(date, balance)` points of balance-bearing transactions and
a sequence of period start dates; output = per-period end-of-period balance or none.

- Period end = next start - 1 day; period 1 starts on the disbursal date and ends one payment interval later; the last row is the single day that interval ends after the final repayment (FR-006).
- Balance = last point on or before the end; none when end < first point (FR-007) or start > last point
  date (FR-005a).

## Migration

`*_MortgageAccountLink`: adds nullable column, index and FK. Existing rows get NULL; nothing backfilled.
Rollback: `Down` drops FK, index, column (loses only the links).
