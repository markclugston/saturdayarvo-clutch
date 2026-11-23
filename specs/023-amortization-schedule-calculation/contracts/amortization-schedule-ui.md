# UI Contract: Amortization Schedule Calculation

No API change. This contract covers the calculation module's interface and what the Loan Payoff Timeline shows.

## Module `src/features/mortgages/scheduleCalculation.ts`

```ts
export type ScheduleInputs = {
  openingBalanceCents: number
  disbursalDate: string            // yyyy-MM-dd
  duration: number
  paymentFrequency: PaymentFrequency
  rateChanges: { annualRatePercent: number; effectiveDate: string }[]
}

export type ScheduledPeriod = {
  period: number
  date: string                     // yyyy-MM-dd
  openingCents: number
  interestCents: number
  repaymentCents: number
  closingCents: number
}

/** Null when the schedule cannot be calculated (never throws). */
export function calculateSchedule(inputs: ScheduleInputs): ScheduledPeriod[] | null
```

`loanDraft.ts`: `scheduleInputs(draft: LoanDraft, today: string): ScheduleInputs | null`.
`repaymentDates.ts`: `daysBetween(from: string, to: string): number` (whole UTC days, `to − from`).

## Component props

| Component | New / changed prop | Meaning |
|---|---|---|
| `LoanDetailsForm` | `onCalculationInputsChange?: (inputs: ScheduleInputs \| undefined) => void` | Emitted on every draft change; undefined while any calculation input is invalid |
| `LoanPayoffTimeline` | `calculation?: ScheduleInputs` | Memoises `calculateSchedule`; passes the result to both views |
| `AmortizationSchedule` | `schedule?: ScheduledPeriod[]` | Bank Schedule cell k = `formatCurrency(closingCents k)`; absent → `Not yet calculated` |
| `BurnDownChart` | `schedule?: ScheduledPeriod[]`, `openingBalanceCents?`, `disbursalDate?` | Present → plotted line; absent → today's output |

## Displayed states

| State | Bank Schedule cells | Burndown |
|---|---|---|
| Calculation inputs valid (saved clean, saved edited, or unsaved) | `$499,502.25` … `$0.00`, right aligned, `tabular-nums`, default text colour | "Bank Schedule" line from Opening Balance at Disbursal Date through each period date; Y ticks `$0`…`$500K`; X year ticks; message below removed; `aria-label` per research R7 |
| Saved mortgage, any calculation input invalid in the form | `Not yet calculated` (as today) | Empty frame and "The burn down will appear once the schedule is calculated." (as today) |
| Unsaved mortgage, inputs incomplete | Unchanged (rows per 016/022 rules, `Not yet calculated`) | "Please enter your mortgage details" (as today) |
| Fallback monthly view (account, incomplete Details) | Blank (as today) | as above |

Unchanged: Period, Date and Actual Balance columns, `aria-rowcount`, windowing, the view toggle and its
status text, headings and the legend label "Bank Schedule".
