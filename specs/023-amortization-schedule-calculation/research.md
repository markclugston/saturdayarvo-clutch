# Research: Amortization Schedule Calculation

No NEEDS CLARIFICATION items remained after the spec's clarification session. These entries record the
design decisions the plan depends on.

## R1 Calculation algorithm

- **Decision**: One forward pass over periods k = 1..Duration. For each period: start date = date of period
  k − 1 (Disbursal Date for k = 1), end date = date of period k (both from `finalRepaymentDate`, 022);
  segment the days [start, end) by the sorted rate changes in force; weighted periodic rate =
  Σ (annual rateᵢ ÷ 100 ÷ periods per year) × daysᵢ ÷ period days (FR-005). Interest = round(opening × rate).
  Repayment: period 1 uses the level repayment over Duration at the rate in effect on the Disbursal Date
  (FR-006); recalculated at the start of a period when a rate change took effect after the period in which
  the repayment was last calculated began, and the period accrues wholly at one rate (FR-006); otherwise the
  current repayment is kept. Every repayment is capped at opening + interest, so a balance stops at 0 and
  later periods repay 0 (FR-007). Last period: repayment = opening + interest (FR-007).
- **Rationale**: O(periods + changes); matches every acceptance scenario; one code path for single and
  blended periods (a single segment of weight 1 is the plain periodic rate, so SC-002 holds exactly).
- **Alternatives considered**: Daily-interest accrual for every period (rejected: spec fixes the periodic rate
  at annual ÷ 12/26/52 outside blended periods); recalculating on every period (rejected: not a level
  repayment, breaks SC-002).

## R2 Money representation and rounding

- **Decision**: Balances, interest and repayments are integer cents (`number`, safe up to 2⁵³ ≫ the 016 max
  of 999,999,999,999.99). Opening Balance is parsed from its decimal string into cents without float
  multiplication. Rounding helper: `Math.sign(x) * Math.round(Math.abs(x))` (half away from zero, FR-007)
  applied to `cents × rate` products. Level repayment = round(B × r ÷ (1 − (1 + r)^−n)); at r = 0,
  round(B ÷ n).
- **Rationale**: Exact cents for the displayed balances; verified against the spec example
  ($2,997.75; $499,502.25; $499,002.01; period 360 = $0.00 with a final repayment of $3,000.44).
- **Alternatives considered**: A decimal library (rejected: new dependency, not needed for cent-level
  results); floating-dollar balances (rejected: drift breaks SC-002).
- **Note**: Because rounding is monotone and the exact level repayment exceeds the first period's interest,
  the rounded repayment is never below a later period's interest at the same rate, so balances never rise
  without a mid-period change (SC-001). At extreme inputs (e.g. 100% weekly over 1,560 periods) the rounded
  repayment can equal the interest, leaving the residual to the last repayment; this follows FR-007 and still
  satisfies SC-001.

## R3 Day counting and rate change on a boundary

- **Decision**: Days are whole UTC calendar days between `yyyy-MM-dd` dates (new exported
  `daysBetween(from, to)` in `repaymentDates.ts`, using its existing `utcMilliseconds`). A change effective on
  day d applies to days ≥ d; a change on a period's date therefore falls wholly in the next period (spec edge
  case); a change on the final repayment date affects nothing. Multiple changes on different days within one
  period each form a segment.
- **Rationale**: Reuses 022's date rules and avoids time zone shifts (`new Date(string)` is never used).
- **Alternatives considered**: Counting with local `Date` objects (rejected: DST and year < 100 issues that
  `repaymentDates.ts` already avoids).

## R4 Failure handling

- **Decision**: `calculateSchedule` returns `null` instead of throwing when an input cannot be parsed, a date
  is out of range, or any intermediate value is non-finite; callers show "Not yet calculated" and the chart's
  existing message.
- **Rationale**: Spec edge case "calculation cannot be completed"; no error details shown (SEC-003).

## R5 Source of inputs (FR-002)

- **Decision**: `LoanDetailsForm` emits `onCalculationInputsChange(scheduleInputs(draft, today) ?? undefined)`
  on every draft change, the same way it emits `onScheduleChange`. `scheduleInputs` runs `validateDraft` and
  returns null if any error key other than `name` exists (account is not validated by `validateDraft`; empty
  rate rows are already skipped).
- **Rationale**: A clean saved mortgage's draft equals its saved values (`mortgageToDraft`), so one source
  covers both cases, and there is never a saved-value fallback while the form is invalid.
- **Alternatives considered**: Using `selectedMortgage` when not dirty and the draft otherwise (rejected: two
  paths, same result).

## R6 Rows and dates while the form is edited

- **Decision**: While calculation inputs are valid, `MortgagesPage` passes their Duration, Disbursal Date and
  Payment Frequency to the timeline (instead of the saved ones), so row count, dates, Bank Schedule values and
  the Actual Balance request share one set of inputs. While invalid, the existing rule (saved values, else the
  form's valid header) is unchanged.
- **Rationale**: Without this, an edited Duration or Frequency would put balances against the wrong dates and
  break SC-005. A clean saved mortgage and an unsaved one behave exactly as today (FR-009).
- **Alternatives considered**: Hiding values whenever the header differs from the saved one (rejected:
  contradicts FR-002's "form's current values").

## R7 Burndown rendering

- **Decision**: Keep the hand-drawn SVG (viewBox 600 × 300, plot area x 70–580, y 30–260). Plot an SVG
  `polyline` in `text-primary`: x linear in days from Disbursal Date to final repayment date; y linear from 0
  to a "nice" maximum: the smallest value of the form 1, 2, 2.5 or 5 × 10ⁿ that is ≥ the highest balance
  (e.g. $500,000.00 → $500K), divided into 4 equal tick intervals ($0, $125K, $250K, $375K, $500K). Y tick labels use a
  compact dollar format (`$500K`, via `Intl.NumberFormat('en-US', { notation: 'compact' })` with a `$`
  prefix, matching `formatCurrency`'s `$`); x ticks show the years of the start, end and up to three evenly
  spaced dates. `aria-label`: "Line chart of the mortgage balance over time for the Bank Schedule, falling from
  {Opening Balance} on {Disbursal Date} to $0.00 on {final repayment date}." Message below the chart removed
  when plotted.
- **Rationale**: No charting dependency (would need SEC-001 third-party review); Duration + 1 points in one
  polyline render fast (1,561 for 30 years weekly).
- **Alternatives considered**: A charting library (rejected: new dependency and review for one line series);
  down-sampling points (rejected: SC-005 needs every point).

## R8 Bank Schedule cell format

- **Decision**: Format closing balances with the mortgage's existing `formatCurrency` (`$499,502.25`), the
  format of the Opening Balance field, independent of any linked account's currency.
- **Rationale**: The mortgage has no currency code; its amounts are shown with `formatCurrency` today.
