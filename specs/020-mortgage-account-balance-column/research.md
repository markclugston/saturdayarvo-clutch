# Research: Mortgage Account Balance Column

Only decisions the spec left open. Settled behaviour (auth cookies, CSRF, ownership, ProblemDetails,
OpenTelemetry) is reused from the code (`docs/code-map.md`).

## R1: When does the "incomplete Details" fallback apply?

- **Finding**: `MortgageValidator` rejects a mortgage unless every schedule field is valid, so a
  *saved* mortgage is never incomplete. The schedule shows `ENTER_DETAILS_MESSAGE` only for a new,
  unsaved mortgage (`duration === undefined`).
- **Decision**: The schedule follows the Details drop-down **live** (the form's current selection, saved or
  not). A new mortgage with an account picked and incomplete Details shows the monthly fallback; once saved
  it switches to the mortgage's own periods (US3 scenario 2). No change to save validation.
- **Alternative rejected**: letting incomplete mortgages be saved: reverses a 016 rule, out of scope.

## R2: Where are period balances computed?

- **Decision**: Server-side, new `GET /api/mortgages/period-balances`. Period 1 starts on the disbursal
  date and runs one payment interval; period k starts on `RepaymentDates.FinalRepaymentDate(disbursal, k, frequency)`
  (k = 1 is the disbursal date), so the end of period k is the start of period k + 1 minus one day, and the
  last period (duration + 1) starts and ends on `FinalRepaymentDate(disbursal, duration + 1, ...)`, one interval
  after the last repayment. Weekly,
  fortnightly and month-end-clamped monthly rules stay in one place (ARC-001).
- **Rationale**: Transactions are cursor-paged, so a client computation would page the whole history.
  The server returns at most one value per period.
- **Alternatives rejected**: mortgage-id keyed endpoint (fails for unsaved mortgages, R1); client
  paging all transactions (slow, SC-004).

## R3: Response size and cost

- **Decision**: One query projecting `(TransactionDate, Balance)` for the owner's account, ordered by
  `TransactionDate, Id` (the transaction list's order, reversed), filtered to `Balance != null`, plus
  `Min`/`Max` of `TransactionDate` over all rows. Folded in memory against period starts. Period
  iteration stops once a period starts after the latest balance-bearing date (FR-005a), so the response
  is bounded by the history span, not by Duration (which can be huge).
- **Alternative rejected**: per-period SQL lookups (up to 361+ round trips).
- Uses existing index `(AccountId, TransactionDate)`; no new transaction index.

## R4: Same-day order

- **Decision**: Last row by `TransactionDate`, then `Id`, matching the Transactions list (which sorts
  `TransactionDate desc, Id desc`), so the balance shown agrees with the account screen.

## R5: Link storage

- **Decision**: Nullable `Mortgages.AccountId` FK to `Accounts`, `OnDelete SetNull` (US1 scenario 5: a
  deleted account behaves as none; saving not blocked). Ownership checked in `MortgageService` on
  create/update; a foreign or unknown id is a 400 field error `accountId`. Accounts are unchanged (FR-001).
- Audit text is unchanged and carries no account or balance data (SEC-003).

## R6: Fallback periods

- **Decision**: Start = date of the account's first balance-bearing transaction; period k starts at
  start + (k - 1) months (day anchored, clamped to month end, like Monthly repayments). Rows run to the
  month containing the account's latest balance-bearing transaction. An account with no balance-bearing
  transactions has no fallback rows: the schedule shows the enter-details prompt.
- Using balance-bearing transactions for both start and end keeps the fallback consistent with the blank
  rules (FR-005, FR-005a, FR-007): the first and last rows always show a balance.

## R7: Client data

- **Decision**: Account list reuses `getAccounts` and the `['accounts']` query key (already invalidated
  by imports), sorted alphabetically by description (case-insensitive compare). Balances use a new
  `['mortgage-period-balances', ...]` key, invalidated where `['accounts']` is after an import or
  transaction delete. Amounts are decimal strings, formatted with `formatCurrencyAmount`.
- Load failure: schedule renders, column cells blank, generic message (Edge Cases); never the server detail.

## R8: Schedule layout

- **Decision**: `AmortizationSchedule` gains optional account props; the grid becomes four columns when
  an account is linked. The fallback uses the same grid (full column set, FR-008) with every column other than Period and the account balance blank.
  Windowing stays as is; balances are looked up by period index.
