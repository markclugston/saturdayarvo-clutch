# Research: Actual Balance Chart Line

No NEEDS CLARIFICATION items remained after the spec's clarification session. These entries record the
design decisions the plan depends on.

## R1. One source of balances for column and chart

- **Decision**: Extract the account lookup and `usePeriodBalances` request from `AccountSchedule` into a hook
  `useActualBalances(accountId, scheduleParams)` in a new `actualBalances.ts`. `AmortizationSchedule` and
  `BurnDownChart` both call it. The chart passes `duration`, `disbursalDate` and `paymentFrequency` from the
  valid `calculation`, which is exactly what the page already passes the table while the calculation is valid
  (023 R6), so both use the same TanStack Query key and share one cached response.
- **Rationale**: SC-001 (point = cell) holds by construction; FR-008 is free because imports and transaction
  deletes already invalidate `periodBalancesQueryKey` (`useTransactions.ts`, `ImportPage.tsx`); an account
  missing from the accounts list behaves as none in both views (020).
- **Alternatives**: Lift the query into `LoanPayoffTimeline` and pass data down to both views — rejected: the
  table also needs the query in its monthly fallback, which the chart never plots, so the hook would need two
  modes anyway. A separate chart-only query — rejected: could disagree with the column.

## R2. Balance values to points

- **Decision**: Pure `actualBalancePoints(balances, schedule)` returns, for each index `i` with a non-null
  `balances[i]` and a `schedule[i]`, `{ date: schedule[i].date, amount: balances[i], value: Number(amount) }`.
  `value` (dollars) positions the point; the decimal string `amount` is formatted for the text alternative with
  `formatCurrencyAmount(amount, currencyCode)`, the column's own formatter.
- **Rationale**: Row k's date is the schedule's period-k date, which equals the table's date (022/023);
  floating-point rounding is invisible at plot resolution, while text uses the exact string. FR-002: no
  Disbursal Date point and no point for blank cells.
- **Alternatives**: Convert to integer cents — unnecessary; currencies with other precisions would need care
  for no visual gain.

## R3. Balance axis range

- **Decision**: All axis values are in dollars. `upper = niceMaximum(max(openingBalanceCents / 100, largest
  actual value))` (unchanged when no actual exceeds the Opening Balance). When no actual is negative: `[0, upper]`
  with 4 intervals, the fixed horizontal guides and `y` mapping exactly as today. When one is: `step = upper / 4`,
  `lower = -ceil(-smallest / step) × step`, ticks at every `step` from `lower` to `upper`, so $0 stays a labelled
  tick; `y(value) = PLOT_BOTTOM - (PLOT_BOTTOM - PLOT_TOP) × (value - lower) / (upper - lower)` for both series,
  and the horizontal guides are drawn at each tick's `y` (replacing the fixed four) so guides and tick labels
  stay aligned. Axis tick labels for negative values render as `-$…`.
- **Rationale**: FR-006, SC-005; SC-002 needs the no-account chart byte-identical, which the unchanged
  non-negative branch guarantees.
- **Alternatives**: Recompute a nice step over the whole span — rejected: changes ticks for the common case.
  Thinning tick labels for very large negatives — not needed: a negative Actual Balance is a small overpayment
  past zero (020 FR-005b), so it adds one or two ticks at most.

## R4. Drawing and legend

- **Decision**: Actual Balance `<polyline>` with `className="text-chart-navy"`, `strokeWidth="2"`,
  `strokeDasharray="6 4"`, `strokeLinejoin="round"`, rendered after the Bank Schedule polyline (on top). Exactly
  one point: a `<circle r="3">` filled `currentColor` in `text-chart-navy`. Bank Schedule polyline and legend group switch their class from
  `text-primary` to `text-chart-primary` (same `rgb(var(--primary))`, no visual change) so both series use
  chart tokens as SC-003 states. Legend: with Actual Balance, Bank Schedule sample moves to x 270–294 (label at
  300) and Actual Balance sample sits at x 400–424 (label at 430), dashed `6 4`, stroke 3; without it, the legend
  is unchanged.
- **Rationale**: FR-003/FR-004 and the clarifications; colour plus dash satisfies WCAG 1.4.1.
- **Alternatives**: Markers on every point — rejected by clarification; second legend row — would shrink the
  plot area for all users.

## R5. Legend and text while balances load or fail

- **Decision**: The legend lists Actual Balance whenever the account resolves and the Bank Schedule is plotted
  (FR-004), including while loading, after a failure and when there are no points. Loading or failed: no line,
  no chart message, text alternative describes the Bank Schedule only and adds nothing about Actual Balance.
  Ready with no points: text alternative ends "Actual Balance: there are no actual balances to plot."
- **Rationale**: FR-004 ties the legend to the selection, FR-009 forbids a chart message and the table already
  shows the error; FR-007's "both series" applies once both are plotted.
- **Alternatives**: Hide the legend entry until data arrives — contradicts FR-004's wording.

## R6. Performance

- **Decision**: Points and axis range in one `useMemo` over `(schedule, balances)`; one polyline of up to 1,560
  points. Component test renders 1,560 periods and asserts the render completes within SC-004's 500 ms.
- **Rationale**: Same O(n) cost as the Bank Schedule line.
