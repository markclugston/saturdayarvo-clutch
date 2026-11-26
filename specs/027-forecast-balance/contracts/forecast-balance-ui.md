# UI Contract: Forecast Balance

Additions to `specs/026-mortgage-area-chart/contracts/burndown-chart-ui.md`. Anything not listed is unchanged.

## Amortization Schedule

| Element | Contract |
|---|---|
| Column header | `columnheader` "Forecast Balance", immediately after "Actual Balance"; present exactly when that column is |
| Cell | `formatCurrencyAmount(value, currencyCode)` or empty; right aligned, `tabular-nums` |
| 320 px | The content panel scrolls sideways, not the page; header and cells scroll into view unclipped, without overlapping other columns |

## Burndown SVG (only when forecast values are plotted)

| Selector | Meaning |
|---|---|
| `linearGradient[data-series="forecast"]` | Series gradient from the forecast line's highest point to its lowest; stops `.text-chart-forecast-start/-mid/-end`. The Bank Schedule and Actual Balance gradients likewise span their own lines |
| `path[data-series="schedule"][data-part="area"]`, `pattern line` | Stripe strength from `--chart-hatch-opacity` and `--chart-hatch-width` (stronger in Dark) |
| `path[data-series="forecast"][data-part="area"]` | Fill from the last Actual Balance point to the last forecast point; opacity 0.25, in the fade mask; `crispEdges`, as is the Actual Balance area |
| `path[data-series="forecast"][data-part="line"]` | Solid line, width 2 |
| `circle[data-series="forecast"][data-part="ring"]` | Hover ring on forecast dates |
| `[data-part="legend"][data-series="forecast"]` | Solid `rect` sample and "Forecast Balance" |
| `linearGradient[data-part="legend-gradient"][data-series="forecast"]` | `objectBoundingBox` across the sample, same stops |

## Paths

The forecast line is `monotonePath` over the last Actual Balance point followed by every forecast point (the existing smoothing, which passes through each point). The area is `areaPath` over the same points, closed to $0.

## Paint order

Areas (Bank Schedule, Actual Balance, Forecast Balance) → hover band → guides and frame → Bank Schedule line → Actual Balance line and dot → forecast line → rings → pointer area.

Contrast is measured against the card, and every series reaches 3:1 on it (research.md R12); contrast over the filled areas is not required (R13). Where series lines cross or overlap, line-to-line contrast is not required (FR-010).

## Text

| Place | Content |
|---|---|
| Hover label and announcement | Date; "Bank Schedule" + amount; "Forecast Balance" + amount on forecast dates |
| Hover label position | On forecast dates the forecast ring's y joins the ring ys passed to `labelPosition`; placement rules are unchanged |
| Text alternative | Appends ` Forecast Balance: from {amount} on {date} to {amount} on {date}.`, or ` Forecast Balance: {amount} on {date}.` for one value; nothing without forecast values |
