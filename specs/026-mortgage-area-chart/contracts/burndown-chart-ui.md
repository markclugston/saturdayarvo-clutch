# UI Contract: Mortgage Burndown (area chart)

Tests locate the chart by these roles, names and attributes. Anything not listed is unchanged from 023/024.

## Accessible structure

| Element | Role / attribute | Name / content |
|---|---|---|
| Keyboard container | `group`, `tabindex="0"` | "Burndown Values"; described by the sr-only instructions |
| Chart graphic | `img` | 024 text alternative, unchanged ("Line chart of the mortgage balance over time …") |
| Announcer | `status` (polite), sr-only | Label text after keyboard moves; empty otherwise |
| Visible label | `aria-hidden="true"`, `data-slot="burndown-label"` | Date; "Bank Schedule" + amount; "Actual Balance" + amount when the row has one |

## SVG parts (for browser tests)

| Selector | Meaning |
|---|---|
| `linearGradient[data-series="schedule"]`, `[data-series="actual"]` | Series gradients; stops `.text-chart-schedule-start/end`, `.text-chart-actual-start/end` |
| `path[data-series="schedule"][data-part="line"]` | Solid Bank Schedule line |
| `path[data-series="schedule"][data-part="area"]` | Bank Schedule fill |
| `path[data-series="actual"][data-part="line"]` | Dashed Actual Balance line (≥ 2 points) |
| `path[data-series="actual"][data-part="area"]` | Actual Balance fill (≥ 2 points) |
| `circle[data-series="actual"][data-part="dot"]` | Single Actual Balance (exactly 1 point; no area); filled with the Actual Balance series gradient (`fill="url(#…)"`), not `chart-navy` |
| `rect[data-part="band"]`, `circle[data-part="ring"][data-series=…]` | Hover band and rings; present only while the label shows; `pointer-events: none` |
| `[data-part="legend"][data-series=…]` | Legend sample and name |
| `linearGradient[data-part="legend-gradient"][data-series=…]` | Legend sample gradient (`objectBoundingBox`, same start/end token stops as the series) |

## Keys (focus on the group)

| Key | Label hidden | Label shown |
|---|---|---|
| Right Arrow / Home / Page Down | First date | Next / first / nearest +1 year (≥ 1 step, stop at last) |
| Left Arrow / End / Page Up | Last date | Previous / last / nearest −1 year (≥ 1 step, stop at first) |
| Escape | — | Hide |

Handled keys call `preventDefault`. Blur hides. Pointer leaving the plot hides only a pointer-moved label.

## Label format

- Date: `formatDisplayDate` (e.g. "29 Nov 2023").
- Bank Schedule: one shared cents formatter, exported from `src/features/mortgages/` and used by both the schedule table's closing balance and the chart (replacing the private `closingBalance` in `AmortizationSchedule.tsx` and `dollars()` in `BurnDownChart.tsx`), e.g. "$499,502.25" (FR-007).
- Actual Balance: `formatCurrencyAmount(amount, currencyCode)`, the linked account's currency, as the schedule's Actual Balance column (FR-007).
- Amounts right aligned, `tabular-nums`.
