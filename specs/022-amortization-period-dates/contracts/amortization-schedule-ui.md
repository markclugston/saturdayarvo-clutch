# Contract change: Amortization Schedule and loan form validation

Amends [020 UI contract](../../020-mortgage-account-balance-column/contracts/mortgage-account-balance-ui.md).

## Schedule, Details complete (saved, or valid in the form)

| Aspect | Before | After |
|---|---|---|
| Rows | Duration + 1 (`aria-rowcount` = Duration + 2) | Duration (`aria-rowcount` = Duration + 1) |
| Date cell, period k | "Not yet calculated" | `formatDisplayDate(finalRepaymentDate(disbursalDate, k, frequency))`, e.g. "29 Dec 2023" |
| Date cell colour | `text-fg-secondary` | default text colour (real data) |
| Bank Schedule | "Not yet calculated" | unchanged |
| Balance cell (account linked) | `balances[k - 1]` | unchanged mapping; values are end of D(k) |

- Applies with and without a linked account: `ScheduleTable` receives `disbursalDate` and `paymentFrequency`
  from every call site (`PlainSchedule` for no account and account not found, and `AccountSchedule`'s
  Details-complete table).
- If `duration` is given but `disbursalDate` or `paymentFrequency` is missing, the Date cell is blank (no
  "Not yet calculated"); rows still number 1 to Duration.
- Dates follow the form's valid values as they change. Date column left aligned, read-only.
- A row whose date would pass 31 Dec 9999 (saved under the old rule) shows a blank Date cell.

## Loan form (`loanDraft.ts`)

- Duration "too late" check and the Effective Date range use the new `finalRepaymentDate` (one interval later);
  messages unchanged, e.g. Disbursal 1 Jan 2000, 360 Monthly → "Choose a date from 1 Jan 2000 to 1 Jan 2030".

## Unchanged

Details incomplete (enter-details message, or monthly fallback with blank Date and Bank Schedule); loading
status, error message, headers, windowing, currency formatting.
