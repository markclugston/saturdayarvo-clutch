# Contract: Mortgage Account Balance API

Auth: existing cookie session, `RequireAuthorization`. Errors use existing ProblemDetails.

## Changed: `/api/mortgages` request and response

- Request (POST, PUT) and response gain `accountId`: GUID string or `null`.
- 400 field key `accountId`: `Choose one of your accounts` (not a GUID, or not owned by the caller).
- Existing 409, 404, 413 behaviour unchanged.

## New: `GET /api/mortgages/period-balances`

Query:

| Name | Rules |
|---|---|
| `accountId` | Required GUID; the caller's account, else 404 `Account not found.` |
| `disbursalDate`, `frequency`, `duration` | All three or none. `yyyy-MM-dd`; `Weekly`/`Fortnightly`/`Monthly`; whole number ≥ 1. Any other mix or value: 400 with field keys `disbursalDate`, `frequency`, `duration` |

Mode:

- With the three: periods 1..duration + 1 (period 1 starts on `disbursalDate`; it ends one payment interval
  later; period k starts k - 1 intervals after it; the last period is the single day the last interval ends).
- Without: monthly fallback (research R6).

200:

```json
{
  "currencyCode": "AUD",
  "periodCount": 361,
  "balances": ["250000.00", null, "249120.55"]
}
```

- `balances[i]` is period i + 1: end-of-period balance as a decimal string in minor units, or `null`.
- Trailing `null`s are omitted (FR-005a); a missing index is blank. `balances.length` ≤ `periodCount`.
- `periodCount`: `duration + 1`, or the fallback month count (0 when the account has no transactions).
- No account data other than `currencyCode` and balances is returned; nothing is logged beyond ids.
