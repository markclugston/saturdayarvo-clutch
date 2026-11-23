# Contract change: mortgage validation and `GET /api/mortgages/period-balances`

Amends [020 contract](../../020-mortgage-account-balance-column/contracts/mortgage-account-balance-api.md) and
016's final repayment date. Auth, parameters, field keys, messages and response shapes are unchanged.

## Final repayment date (FR-007)

`F(d, N, frequency)` = `d` + N intervals (was N − 1). Used by:

| Rule | Endpoint | Field key / message (unchanged) |
|---|---|---|
| `F(disbursalDate, duration)` on or before 31 Dec 9999 | `/api/mortgages` POST/PUT, `period-balances` | `duration`: `The final repayment date would be later than 31 Dec 9999` |
| Effective Date from `disbursalDate` to `F(disbursalDate, duration)` | `/api/mortgages` POST/PUT | `interestRateChanges[i].effectiveDate`: existing range message |

## Changed: `period-balances` mortgage mode

- Periods 1..`duration`; period k's date `D(k)` = `F(disbursalDate, k)`.
- `balances[k - 1]` = oriented balance of the last balance-bearing transaction (date, then Id) with
  `TransactionDate <= D(k)`; `null` when none.
- The first period with `D(k) >=` the latest balance-bearing transaction's date shows that balance; later periods
  are omitted (trailing `null`s removed, as before).
- `periodCount` = `duration` (was `duration + 1`).

```json
{ "currencyCode": "AUD", "periodCount": 360, "balances": ["249500.00", "249010.12"] }
```

## Unchanged

Fallback mode (monthly from the first balance-bearing transaction), sign orientation, minor-unit formatting,
ownership 404, logging of ids only, metrics.
