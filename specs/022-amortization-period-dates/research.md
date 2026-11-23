# Research: Amortization Period Dates and End-of-Day Balances

No NEEDS CLARIFICATION items remain. These entries record the design decisions.

## R1 One repayment date rule: payment k is k intervals after the Disbursal Date

- **Decision**: Change `RepaymentDates.FinalRepaymentDate` (C#) and `finalRepaymentDate` (TS) so `periods` steps
  are taken instead of `periods − 1`: the date of payment N is the Disbursal Date plus N intervals, anchored on the
  disbursal day, clamped to month end, `null` past 31 Dec 9999. Period k's date is `FinalRepaymentDate(d, k)`.
  Callers that validate (`MortgageValidator` Duration limit and Effective Date range, `PeriodBalanceService`
  schedule check, `loanDraft.ts` Duration limit and Effective Date range) keep their code and follow the new date
  (FR-007, SEC-004 in both tiers).
- **Rationale**: The user confirmed period 1 is the first payment, one interval after disbursal, and no payment
  follows period Duration. One function per tier keeps rows, the 31 Dec 9999 limit and the Effective Date range
  consistent; with the limit on period Duration, every shown row has a date.
- **Callers adjusted for the shift**: `PeriodBalances.MonthlyPeriods` (020 fallback, unchanged behaviour) asks
  for `period − 1` steps instead of `period`; shared test vectors in `RepaymentDatesTests.cs` and
  `repaymentDates.test.ts` move one interval (e.g. `periods = 1` now returns one interval on, `0` stays `null`).
- **Alternatives**: A second `PaymentDate` function beside the old one: leaves the validated final date one
  interval short of the last row (the conflict raised earlier). Chaining from the previous row: rejected by the
  spec (31 Jan → 29 Feb → 29 Mar drifts).
- **Data impact**: No schema or stored data change. The Effective Date range widens by one interval (existing
  rows stay valid). A saved mortgage within one interval of 31 Dec 9999 is flagged on its next save (spec edge
  case); no migration or backfill.

## R2 Period windows for the end-of-day lookup

- **Decision**: `PeriodBalances.MortgagePeriods` yields, for k = 1..Duration, the window
  `(Start = period k − 1 date + 1 day, End = period k date)`, with period 1's `Start = DateOnly.MinValue`.
  `PeriodBalances.Lookup` is unchanged.
- **Rationale**: `Lookup` returns the last point on or before `End` (FR-004, end of day) and stops at the first
  window whose `Start` is after the latest point. With these windows that is FR-005: the first row dated on or
  after the latest transaction shows its balance; later rows are blank. Rows before the first transaction stay
  blank.
- **Alternatives**: Point-in-time windows (`Start = End`): blanks the first row after the latest transaction,
  contradicting FR-005. A new lookup: unnecessary.

## R3 Row count

- **Decision**: Duration rows (FR-002); API `periodCount = duration`. The 31 Dec 9999 guard in
  `MortgagePeriods` stays as a defensive stop but cannot trigger for validated input.

## R4 Date display format

- **Decision**: `formatDisplayDate` from `features/mortgages/loanDraft.ts` ("29 Dec 2023", no time zone shift,
  four-digit years), as `InterestRateChangesDialog` shows mortgage dates (FR-003).
- **Rationale**: The mortgages feature's established display format, matches the spec's examples, and is
  locale-independent, so tests are deterministic.
- **Alternatives**: `Intl.DateTimeFormat` medium (Transactions table): locale-dependent and `new Date` parsing;
  not what the mortgage screens use.

## R5 Dates are computed in the UI; API shape unchanged

- **Decision**: The UI computes dates; `GET /api/mortgages/period-balances` keeps its shape.
- **Rationale**: Dates show without a linked account (SC-004, no request made) and for unsaved form values
  (US1.4). Parity between tiers is held by the shared test vectors (R1).
