# Data Model: Forecast Balance

Derived view data only. No schema, storage or API change.

## `forecastBalances(balances, frequency, rowCount)`

| Input | Meaning |
|---|---|
| `balances` | Actual Balance cells: index i is period i + 1; null or missing is blank |
| `frequency` | `Monthly`, `Fortnightly` or `Weekly`: window of 12, 26 or 52 reductions |
| `rowCount` | Schedule rows; later balances are ignored and no row is added |

**Output**: `(string | null)[]`, indexed like `balances`; a decimal string on forecast rows, otherwise null. Empty when there is no forecast.

## Rules

1. `last` = the last non-blank row within `rowCount`.
2. Reduction at row i = balance(i − 1) − balance(i), only when both are non-blank. Period 1 has none.
3. Window = the newest reductions up to `last`, at most 12 / 26 / 52.
4. Forecast reduction = median of the window; even count: mean of the two middle values rounded half up to the minor unit.
5. Rows after `last`: previous value (first: balance(`last`)) minus the reduction. The first result ≤ 0 is `0` (at the balance scale) and ends the output; otherwise it ends at `rowCount`.

## Empty output

No non-blank balance · no reduction (including a single balance) · reduction ≤ 0 · `last` is the final row.

## Hook and chart state

| Type | Change |
|---|---|
| `ActualBalances` (`actualBalances.ts`) | adds `forecast`; empty unless status is `ready` and Details are complete |
| `ActualBalancePoint` → `BalancePoint` | renamed (with `actualBalancePoints` → `balancePoints`); used for both series |
| `PlottedDate` (`BurnDownChart.tsx`) | adds optional `forecast: { point, y }`; never at the Disbursal Date or on an Actual Balance row |
| `Plot` | adds `forecastLine` and `forecastArea`, both starting at the last Actual Balance point; empty without forecast points |
| `Plot.spans` | each series' line range (highest to lowest y), which its gradient covers; null without a line |
