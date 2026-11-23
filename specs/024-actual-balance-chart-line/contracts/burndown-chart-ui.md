# UI Contract: Mortgage Burndown Chart

Changes to `BurnDownChart` only; everything not listed is unchanged from 023.

## Props

| Prop | Type | Change |
|---|---|---|
| `saved` | `boolean` | unchanged |
| `schedule` | `ScheduledPeriod[] \| undefined` | unchanged |
| `openingBalanceCents` | `number \| undefined` | unchanged |
| `disbursalDate` | `string \| undefined` | unchanged |
| `paymentFrequency`, `duration` | from the valid calculation | new; build the balances request key (same as the table's) |
| `accountId` | `string \| undefined` | new; Mortgage Account selection, saved or not |

## Rendered output (Bank Schedule plotted)

| Condition | Actual Balance line | Legend | Text alternative suffix |
|---|---|---|---|
| No account / account not found | none | "Bank Schedule" only, at x 400 (as today; group class `text-chart-primary`) | none (label identical to today) |
| Loading or failed | none | both entries | none; no chart message |
| Ready, 0 points | none | both | ` Actual Balance: there are no actual balances to plot.` |
| Ready, 1 point | `<circle r="3">`, `text-chart-navy`, fill `currentColor` | both | ` Actual Balance: {amount} on {date}.` |
| Ready, ≥ 2 points | `<polyline>` `text-chart-navy`, stroke 2, `strokeDasharray="6 4"`, after Bank Schedule | both | ` Actual Balance: from {first amount} on {first date} to {last amount} on {last date}.` |

- Bank Schedule polyline and legend group: `text-chart-primary` (was `text-primary`; same colour), polyline
  solid, stroke 2.
- Legend with both: Bank Schedule sample x 270–294, label x 300; Actual Balance dashed sample (`6 4`, stroke 3,
  `text-chart-navy`) x 400–424, label "Actual Balance" x 430. Labels `text-fg-secondary`, font 12.
- Amounts use `formatCurrencyAmount(amount, currencyCode)`; dates use `formatDisplayDate`.
- Axis per [data-model.md](../data-model.md) BalanceAxis; negative tick labels `-$…`.

## Bank Schedule not plotted

Unchanged: enter-details prompt or the empty frame with `NOT_CALCULATED_CHART_MESSAGE`; no Actual Balance line or
legend entry (FR-005).
