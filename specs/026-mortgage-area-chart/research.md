# Research: Mortgage Area Chart

## R1 Series colours (new tokens)

- **Decision**: RGB triplets in `index.css`, used as `rgb(var(--…))` like existing tokens:

  | Token | Light | Dark |
  |---|---|---|
  | `chart-schedule-start` (blue) | 26 95 230 | 142 186 255 |
  | `chart-schedule-mid` (violet) | 124 58 237 | 206 176 255 |
  | `chart-schedule-end` (pink) | 190 24 93 | 249 168 212 |
  | `chart-actual-start` (teal) | 0 118 128 | 90 205 220 |
  | `chart-actual-mid` (sky) | 3 105 161 | 110 190 255 |
  | `chart-actual-end` (indigo) | 67 56 202 | 165 180 252 |

- **Revision (2026-11-24, user review)**: three stops per series (start at 0, mid at 0.5, end at 1), like the reference. Sampled piecewise at 41 steps against every background below, the minimum contrast is Light 3.15, Dark 3.29; the Actual Balance colours stay at least 36.5° (Light) and 40.5° (Dark) from `success`, and about 30° from the Bank Schedule colour at the same date. The figures in the rationale below are for the earlier two-stop pair.

- **Rationale**: Every sampled step of the Actual Balance gradient (teal ≈185° → cyan ≈203° Light, ≈187° → ≈207° Dark) is at least 36° (Light) and 41° (Dark) in hue from `success` (22 122 69 ≈148° / 111 211 155 ≈146°), above FR-002's 30°, and well away from `warning` (amber ≈35°), so it implies neither status. At each date the Actual colour is at least 30° in hue from the Bank Schedule colour, and the lines also differ by dash (FR-004). Minimum contrast against `card` sampled at 41 sRGB interpolation steps: Light 5.49 (schedule), 5.38 (actual); Dark 6.94, 6.85 — all ≥ 3:1 (FR-004, SC-002). Against every background a line, ring or dot can sit on (card, card + Bank fill at 0.18, card + Actual fill at 0.14, both fills, and each of those under the hover band, `fg` at 0.05) the minimum is Light 3.22 (schedule), 3.15 (actual); Dark 3.36, 3.31 — all ≥ 3:1. The browser test recomputes this from computed styles, so the test, not this table, is authoritative.
- **Decision history**: The first pick, teal→green, was dropped (user decision, 2026-11-24): a teal→green blend passes within ≈6° of `success` mid-schedule, failing FR-002. Teal→cyan keeps the teal start the user chose. Amber→yellow-green was rejected because amber reads as `warning`.
- **Alternatives**: Reusing `chart-primary`/`chart-navy` (no shift over time); a hue-shifting gradient through pink like the reference (rejected by clarification).

## R2 Gradient technique

- **Decision**: One `<linearGradient gradientUnits="userSpaceOnUse">` per series from x = 70 to x = 580 (plot edges), so a colour always means the same date for both series and for stroke, fill and rings. Stops carry `className="text-chart-…"` and `stopColor="currentColor"` (lint-checked tokens, theme switch for free). Ids from `useId()` so two charts never collide. Legend samples sit at x ≈ 270–294 (Bank Schedule, when Actual Balance is listed) and x ≈ 400–424, where the series gradient would show only a late-range slice, so each legend sample uses its own `<linearGradient data-part="legend-gradient" gradientUnits="objectBoundingBox">` with the same three token stops, showing the full start→mid→end range (FR-006). Both legend samples are solid (the dash clip path is removed).
- **Alternatives**: `objectBoundingBox` gradients (colour would track each path's own extent, breaking "same colour = same date"); inline `style` with `var()` (bypasses the token lint rule).

## R3 Fill strength

- **Decision**: Area `fill="url(#…)"` with `fillOpacity` 0.18 (Bank Schedule) and 0.14 (Actual Balance), drawn in order: Bank area, Actual area, hover band (while shown, R5), guides, Bank line, Actual line, rings/dot. Guides drawn above fills guarantee they show through (FR-003). No hatching.
- **Alternatives**: Vertical opacity fade (reference) — dropped: fading to 0 at $0 hides the area near payoff; hatch texture — extra pattern code for no requirement.

## R4 Smoothing without overshoot

- **Decision**: Monotone cubic interpolation in x (Fritsch–Carlson, as d3 `curveMonotoneX`) implemented in `chartGeometry.ts`, emitting one SVG path. It passes through every point and never leaves the range of two neighbouring points, so it cannot rise between falling points (FR-005). Area path = line path + vertical to y($0) + back to the start, which fills above and below $0 for negative Actual Balances.
- **Alternatives**: Catmull-Rom / basis curves (overshoot); a chart library (new dependency and third-party review for one curve).

## R5 Hover label rendering

- **Decision**: An HTML overlay (`pointer-events-none`, `aria-hidden`) absolutely positioned in the chart's existing `relative` container, styled with the tooltip popup's tokens (`rounded-control bg-raised text-fg shadow-float`). **Revised 2026-11-24 (user review: the label jumped to the far side when the rings straddled the middle)**: the label always follows the hovered date. A pure `labelPosition` function (in `chartGeometry.ts`) takes the container size, the label size, the hovered x and ring ys in container pixels and returns `left`/`top` and a side: `right` (12 px right of the band) when it fits, else `left`, else `over` (clamped over the date, above or below the rings). Vertically it centres on the rings' midpoint, clamped inside the container. The component measures the label in a `useLayoutEffect` and writes the position straight to the element's style (no state, no extra render), so it never flashes in the wrong place. Band (`rect`, `fill-fg` at `fillOpacity` 0.05, at least 6 units wide, drawn above both fills and below the guides, lines, rings and dot) and rings (`circle`, `stroke="url(#gradient)"`, `fill` card) in the SVG, both `pointer-events-none` so they never take the pointer from the listener `rect` (no spurious `pointerleave`, nothing blocks other dates — FR-010).
- **Alternatives**: The `Tooltip` primitive (trigger-based, one trigger per date would be 1,561 focus stops); SVG `<text>` label (no token surface/shadow, harder alignment).

## R6 Pointer mapping and nearest date

- **Decision**: Convert `clientX` to viewBox x from the SVG's `getBoundingClientRect()` with `xMidYMid meet` scaling (pure function, testable in jsdom); binary search in the precomputed ascending x array of plotted dates (Disbursal Date + every row); ties go to the earlier date. Listen on a transparent `rect` covering the plot area; `pointerleave` from it hides a pointer-owned label.
- **Alternatives**: `getScreenCTM()` (absent in jsdom); linear scan (fine at 1,561, but binary search is as simple and guarantees SC-003).

## R7 Keyboard and announcements

- **Decision**: Wrap the SVG in a `div` with `tabIndex={0}`, `role="group"`, `aria-label="Burndown Values"`, `aria-describedby` → sr-only instructions ("Use the arrow keys, Home, End, Page Up and Page Down to read values; Escape hides them."), `focus-visible:focus-ring rounded-control`. The SVG keeps `role="img"` and 024's name. Keys per FR-009; Page Down/Up target = plotted date nearest (date ± 1 calendar year), forced to at least one step, clamped. A sr-only `role="status"` (polite) inside the group holds text set only by keyboard moves (date, series names, amounts) and is cleared on pointer moves and hide, so hover never announces (SC 4.1.3). `blur` hides; Escape hides and keeps focus.
- **Alternatives**: `role="application"` (overrides screen-reader browse mode unnecessarily); making the `img` itself focusable (an `img` should not own interactive keys).

## R8 State ownership

- **Decision**: One `useState<{ index: number; source: 'pointer' | 'keyboard' } | null>`; announcement string in separate state set only in the key handler. Everything else (band x, ring y, label text) derived during render — no `useEffect`.

## R10 End-of-line series name (2026-11-24)

- **Decision**: With both lines solid, an SVG `<text data-part="series-name">Actual Balance</text>` sits 6 units right of the last Actual Balance point (or the single dot), vertically centred on it; if it would cross the plot's right edge it is anchored `end` and placed above the point. Filled `text-fg-secondary` with a `stroke-card` halo (`paint-order: stroke`, width 3) so it keeps 4.5:1 over fills, guides and lines. Drawn above the lines, below the rings, `pointer-events-none`.
- **Rationale**: WCAG 2.2 SC 1.4.1: once the dash goes, a name on the line is the non-colour cue (direct labelling); the Bank Schedule is the unnamed line and the legend names both.
- **Alternatives**: Dots on every Actual point (cluttered on weekly schedules); a thicker line (weak cue).
