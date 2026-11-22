# Contract: Mortgages API

All routes: `RequireAuthorization`, owner-scoped, JSON (web casing), CSRF header on writes (existing
client). Errors are RFC 9457 ProblemDetails. Another user's mortgage behaves as not found (404).

## Schemas

```text
InterestRateChange   { newInterestRate: number, effectiveDate: "yyyy-MM-dd" }
MortgageInput        { name: string, openingBalance: number, duration: number,
                       disbursalDate: "yyyy-MM-dd",
                       paymentFrequency: "Weekly" | "Fortnightly" | "Monthly",
                       interestRateChanges: InterestRateChange[] }       // ≤ 60 items
MortgageResponse     MortgageInput & { id: uuid, version: number }       // changes sorted by effectiveDate
```

## Endpoints

| Method / path | Body | Success | Errors |
|---|---|---|---|
| `GET /api/mortgages` | — | 200 `MortgageResponse[]` in creation order | 401 |
| `POST /api/mortgages` | `MortgageInput` | 201 `MortgageResponse`, `Location` | 400, 401, 413 |
| `PUT /api/mortgages/{id}` | `MortgageInput & { version }` | 200 `MortgageResponse` (version + 1) | 400, 401, 404, 409, 413 |
| `DELETE /api/mortgages/{id}?version={n}` | — | 204 | 400 (missing version), 401, 404, 409 |

## Error cases

- **400 validation**: `title` "The mortgage is invalid.", `errors` keyed by field path (research R7).
  The request DTO reads values loosely so badly shaped values still return field errors, never a
  generic JSON error: `openingBalance`, `duration` and `newInterestRate` as raw JSON
  (`JsonElement?`), converted in the endpoint to `decimal?` (a JSON number that fits `decimal` keeps
  its value; a number too large for `decimal` becomes `decimal.MaxValue`, or `decimal.MinValue` if
  negative, so it fails the upper or lower bound; a string, boolean, array or object becomes null,
  i.e. unreadable); `disbursalDate`, `effectiveDate` and `paymentFrequency` as `string?`,
  parsed by the validator (dates exactly `yyyy-MM-dd` with the invariant culture, so "2000-13-45"
  is unreadable; frequency exactly `Weekly`, `Fortnightly` or `Monthly`). The validator receives
  only `decimal?` and `string?` values, no JSON types (ARC-001). Malformed JSON, or a body whose
  shape is wrong (e.g. `interestRateChanges` not an array), still gets the existing generic 400.
  Each key gets one message: the first row below that applies, in table order.
  The screen shows the same messages for the checks it makes before sending (FR-007, FR-008).

  | Key | Condition | Message |
  |---|---|---|
  | `name` | Missing, empty or only spaces | Enter a name |
  | `name` | Over 100 characters after trimming | Enter a name of up to 100 characters |
  | `name` | Same as another of the user's mortgages after trimming, ignoring case | A mortgage with this name already exists |
  | `openingBalance` | Missing, unreadable, 0 or less | Enter a opening balance greater than 0 |
  | `openingBalance` | Above 999,999,999,999.99 | Enter a opening balance up to 999,999,999,999.99 |
  | `openingBalance` | More than 2 decimal places | Enter a opening balance with up to 2 decimal places |
  | `duration` | Missing, unreadable, fractional, 0 or negative | Enter a whole number of 1 or more |
  | `duration` | Final repayment date after 31 Dec 9999 (including any value above `int.MaxValue`) | The final repayment date would be later than 31 Dec 9999 |
  | `disbursalDate` | Missing, unreadable or not a storable date | Enter a valid date |
  | `disbursalDate` | Later than today (R5) | Enter a date that is not in the future |
  | `paymentFrequency` | Missing or not `Weekly`, `Fortnightly` or `Monthly` | Choose Weekly, Fortnightly or Monthly |
  | `interestRateChanges[i].newInterestRate` | Missing or unreadable | Enter an interest rate |
  | `interestRateChanges[i].newInterestRate` | Below 0 or above 100 | Enter an interest rate from 0 to 100 |
  | `interestRateChanges[i].newInterestRate` | More than 2 decimal places | Enter an interest rate with up to 2 decimal places |
  | `interestRateChanges[i].effectiveDate` | Missing, unreadable or not a storable date | Enter a valid date |
  | `interestRateChanges[i].effectiveDate` | Same date as another row (every such row) | This effective date is already used |
  | `interestRateChanges[i].effectiveDate` | Before the Disbursal date or after the final repayment date | Choose a date from {first} to {final} (e.g. "Choose a date from 1 Jan 2000 to 1 Dec 2029") |
  | `interestRateChanges` | More than 60 rows | A mortgage can have up to 60 interest rate changes |
  | `interestRateChanges` | No row effective on the Disbursal date (including no rows) | Add the opening interest rate, effective on the disbursal date |
  | `mortgages` | Create when the user already has 20 | You can save up to 20 mortgages |

  Dates in messages use `d MMM yyyy` with the invariant culture, so years below 1000 keep four
  digits ("1 Jan 0001"). While `disbursalDate`, `duration` or `paymentFrequency` has
  an error, rows are not range-checked and the opening-rate rule is not applied; only those
  fields are flagged (FR-005). Completely empty rows are dropped by the client before sending, and
  a row with both fields null that still reaches the server is ignored the same way (not counted,
  not stored, not flagged). Partly filled rows are flagged under their missing field.
- **409** `type` `…/mortgage-changed`, `detail` "This mortgage was changed elsewhere; reload to see the latest".
- **404** mortgage not found for this owner (deleted elsewhere or not theirs). On PUT or DELETE the
  client removes the tab, selects the first tab and shows "This mortgage was deleted elsewhere"
  (spec FR-021).
- **413** request body over 32 KB on POST or PUT (`RequestSizeLimit`); rejected before the body is read.
- **500** existing generic ProblemDetails; no details.

No error or log contains balances or rates.
