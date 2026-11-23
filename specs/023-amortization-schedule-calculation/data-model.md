# Data Model: Amortization Schedule Calculation

Nothing is stored (FR-010). Both types are derived in clutch-web
(`src/features/mortgages/scheduleCalculation.ts`) and recalculated on every input change.

## ScheduleInputs (from the Details form)

| Field | Type | Source / rule |
|---|---|---|
| `openingBalanceCents` | integer > 0 | Opening Balance, ≤ 99,999,999,999,999 cents (016) |
| `disbursalDate` | `yyyy-MM-dd` | Disbursal Date |
| `duration` | integer ≥ 1 | Duration; final repayment date ≤ 31 Dec 9999 (022) |
| `paymentFrequency` | `'Weekly' \| 'Fortnightly' \| 'Monthly'` | periods per year 52 / 26 / 12 |
| `rateChanges` | `{ annualRatePercent: number; effectiveDate: string }[]` | non-empty rows, sorted by date; one on the Disbursal Date (021); dates within [Disbursal Date, final repayment date]; rates 0–100, ≤ 2 dp |

Built by `scheduleInputs(draft, today)` only when `validateDraft` reports no error except `name`; otherwise
`null` (FR-002).

## ScheduledPeriod (one per row)

| Field | Type | Rule |
|---|---|---|
| `period` | integer 1..Duration | row number |
| `date` | `yyyy-MM-dd` | `finalRepaymentDate(disbursalDate, period, frequency)` (022) |
| `openingCents` | integer | previous `closingCents`; period 1 = `openingBalanceCents` |
| `interestCents` | integer | round(opening × day-weighted periodic rate) (FR-005, FR-007) |
| `repaymentCents` | integer | level P&I repayment (FR-004, FR-006; period 1 at the Disbursal Date's rate), capped at opening + interest; last period = opening + interest (FR-007) |
| `closingCents` | integer | opening + interest − repayment; shown as Bank Schedule; last = 0 |

Rates in effect and their days are internal to the calculation and not exposed (no new columns, spec
clarification).

### Invariants (tested)

- `closingCents` of the last period = 0; every `closingCents` ≥ 0, and 0 before the last period only after
  an early repayment by rounding (SC-001, FR-007).
- Without a change strictly inside the period: `closingCents ≤ openingCents` (SC-001).
- `closingCents = openingCents + interestCents − repaymentCents` for every period.
- Repayment changes only at the first period that accrues wholly at a newly effective rate, when capped at
  opening + interest, and at the last period (FR-006, FR-007).
