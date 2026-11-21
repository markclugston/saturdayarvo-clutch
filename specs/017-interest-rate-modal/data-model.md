# Data Model: Change Interest Rate Modal

No stored data, API or schema changes. Interest rate changes keep 016's model
(`specs/016-mortgage-tracking/data-model.md`) and client draft (`LoanDraft.rows: RateRowDraft[]` in
`src/clutch-web/src/features/mortgages/loanDraft.ts`).

## Current interest rate (derived, client only)

| Field | Rule |
|---|---|
| Input | `LoanDraft.rows` (unsaved values) and `localToday()` |
| Value | `rate` of the row whose `date` is a valid date `<= today` and is the latest such date; rows with an unparseable rate or date are ignored |
| None found | `null`, displayed as "Not set" |
| Display | `formatPercent`, always 2 decimal places (e.g. `5.25%`, `6.00%`) |

## Add inputs (modal-local state, not part of the draft)

| Field | Rule |
|---|---|
| `rate`, `date` | Strings, empty each time the modal opens; discarded on close |
| Add allowed | `headerIsValid(draft, today)`, `rows.length < 60` (`MAX_RATE_CHANGES`) and not saving |
| On Add | `validateNewRateChange(draft, rate, date, today)` → `{ newInterestRate?, effectiveDate? }` using 016's messages (range 0–100, up to 2 dp, valid date, date within first–final repayment date, unique date). No errors → append `newRow(rate, date)` to `draft.rows` and clear the inputs |

## Listed rows (in the modal)

- Sorted by `date` ascending for display only; `draft.rows` order is not rewritten.
- Row with `date === draft.drawdownDate` is marked "Opening Rate".
- Dates display as `formatDisplayDate(date)` → `1 Jan 2025` (`en-AU`, `day: 'numeric', month: 'short', year: 'numeric'`, parsed as a local date, not UTC). New pure helper in `loanDraft.ts`.
- Remove → `draft.rows` without that row's `key`; errors keyed to that row are no longer shown.
- Errors: `errors["{row.key}.newInterestRate" | "{row.key}.effectiveDate"]` per row and `errors.interestRateChanges` above the list, from `validateDraft` or `mapServerErrors` as in 016.
