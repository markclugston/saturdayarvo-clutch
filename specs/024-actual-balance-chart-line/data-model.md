# Data Model: Actual Balance Chart Line

No stored data, schema or API change. Client-side shapes only; inputs are existing types
(`PeriodBalances` in `src/lib/api/schemas.ts`, `ScheduledPeriod` and `ScheduleInputs` in
`src/features/mortgages/scheduleCalculation.ts`).

## ActualBalances (hook result, `useActualBalances`)

| Field | Type | Rule |
|---|---|---|
| `status` | `'none' \| 'loading' \| 'failed' \| 'ready'` | `none`: no account selected, or the account is missing from the accounts list (020). |
| `balances` | `(string \| null)[]` | Index i = period i + 1; null or missing = blank cell. Empty unless `ready`. |
| `currencyCode` | `string \| undefined` | Response's code, else the account's (as the column does). |
| `periodCount` | `number \| undefined` | Monthly fallback row count (table only). |

Request key: `accountId` plus `{ disbursalDate, frequency, duration }` when all three are known, otherwise none
(monthly fallback). The chart always passes all three from the valid calculation.

## ActualBalancePoint (`actualBalancePoints(balances, schedule)`)

| Field | Type | Rule |
|---|---|---|
| `date` | `string` (ISO) | `schedule[i].date` for the row. |
| `amount` | `string` | `balances[i]` unchanged; formatted with `formatCurrencyAmount` for text. |
| `value` | `number` | `Number(amount)` in dollars; positions the point. May be negative or above the Opening Balance. |

Validation: one point per index where `balances[i]` is non-null and `schedule[i]` exists; ordered by period
(= date order); no point at the Disbursal Date (FR-001, FR-002).

## BalanceAxis (derived in `BurnDownChart`)

| Field | Rule |
|---|---|
| `upper` | `niceMaximum(max(openingBalanceCents / 100, max(point.value)))`, in dollars |
| `lower` | `0` when no value < 0; else `-ceil(-min / step) × step` with `step = upper / 4` |
| `ticks` | Every `step` from `lower` to `upper`; includes `0` |
| `y(value)` | `PLOT_BOTTOM - (PLOT_BOTTOM - PLOT_TOP) × (value - lower) / (upper - lower)` for both series and tick labels |
| guides | `lower = 0`: the fixed four guides, as today; `lower < 0`: one guide at each tick's `y` |

State: series appear only while the Bank Schedule is plotted; Actual Balance drawn only when `status = ready`
and at least one point exists.
