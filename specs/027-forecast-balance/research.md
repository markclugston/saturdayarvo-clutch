# Research: Forecast Balance

No open NEEDS CLARIFICATION items. Design decisions only.

## R1. Where the forecast is calculated

- **Decision**: A pure function in new `forecastBalances.ts`; `useActualBalances` returns its result as `forecast`, memoised on the balances data, frequency and duration.
- **Rationale**: The table and chart already share this hook, so they cannot disagree (SC-002), and the forecast follows every query refresh (FR-008, FR-008a). It needs no Bank Schedule (FR-007a).
- **Alternatives**: Calculating in each view (two call sites to keep equal); server calculation (excluded by FR-008a).

## R2. Arithmetic

- **Decision**: `BigInt` minor units parsed from the decimal strings; the scale is the longest fraction among the balances used. An even-count median is the mean of the two middle values, rounded half up. Output is a decimal string at that scale.
- **Rationale**: Exact to the cent, also for 0- and 3-decimal currencies ("cent" means the currency's minor unit). Strings feed `formatCurrencyAmount` as Actual Balance does. Only a positive reduction is used, so rounding of negative values never shows.
- **Alternatives**: Floating-point dollars (rounding drift over 1,560 subtractions).

## R3. The reduction window

- **Decision**: Walk back from the last non-blank row, collecting reductions (both rows non-blank) until 12 / 26 / 52 are held or the rows run out (FR-004).
- **Rationale**: The server returns no blank between two balances (`Domain/Mortgages/PeriodBalances.cs` repeats the latest balance in each period without a new transaction, up to the period of the latest transaction, and never beyond it), so this equals "the last 12 months" for all real data.
- **Consequence of the spec** (spec Edge Cases): Periods between balances with no new transaction repeat the balance and count as zero reductions. A schedule more frequent than the account's repayments (for example Weekly with monthly repayments) therefore gets a zero median and a blank column once more than half of the window's reductions are zero.

## R9. Revision after review (2026-11-26): solid line, new colours, no gaps

Replaces R4, R5 and R6 where they differ (spec Clarifications, review session).

- **Line**: solid. No casing under the line or ring.
- **Colours**: `--chart-forecast-start/-mid/-end` are 255 0 45, 255 128 45 and 255 255 45 in both themes, read from the user's sample image.
- **Gradient**: `userSpaceOnUse` from the last Actual Balance point's y to y($0), so all three colours show on every forecast. A forecast starting low on a plot-wide gradient would show no red.
- **Gaps**: the white seam between the two solid areas came from antialiasing their shared edge, in the paths and in the fade mask. Both areas use `shape-rendering="crispEdges"` and the mask rect reaches half a box beyond each side.
- **Legend**: a solid `rect` sample with an `objectBoundingBox` gradient, like the other series. Positions are unchanged.
- **Open (CRITICAL, WEB-001)**: contrast on the card is 3.97 / 2.51 / 1.07 (start / mid / end) in Light, so only the first 38% of the gradient reaches 3:1; Dark passes (3.46 to 12.81). Over the filled areas it is lower still. The distinct colour gate also fails near the yellow end (smallest OKLab distance in Dark 0.083 from Actual Balance and 0.028 from a status colour). The browser test "forecast contrast and distinct colours" fails until the colours or the requirement change.

## R10. Colours of the other series and stripe strength (2026-11-26)

Amends 026 FR-002 and R1–R2, and R9 where they differ.

- **Colours (both themes)**: Actual Balance 17 255 0 → 17 255 128 → 17 255 255; Bank Schedule 0 15 255 → 128 15 255 → 255 15 255; read from the user's sample images.
- **Gradients**: each series' `userSpaceOnUse` gradient runs from its line's highest point to its lowest (Forecast Balance too, so it ends at the last forecast point, not always $0). Line, area and rings share it.
- **Dark stripes**: `--chart-hatch-opacity` and `--chart-hatch-width` are 0.6 and 1.2 in Light, 1 and 2 in Dark.
- **Open (CRITICAL, WEB-001)**: contrast on the card, start / mid / end: Actual Balance 1.37 / 1.34 / 1.25 in Light (Dark passes); Bank Schedule 1.64 / 2.24 / 4.42 in Dark (Light passes). Actual Balance green is also close to the success colour, against 026 FR-002's 30° hue gap.
- **Pending fix**: the unmerged contrast fix plans other Actual Balance colours and card-coloured casings under every line, both of which these decisions replace or reject. It must be re-scoped before it is merged.

## R11. Final colours (2026-11-26)

Replaces the colours and contrast figures in R9 and R10.

| Series | Light (start / mid / end) | Dark | Contrast on the card (Light; Dark) |
|---|---|---|---|
| Bank Schedule | 0 15 255 / 128 15 255 / 255 15 255 | same | 8.36 to 3.10; 1.64 to 4.42 |
| Actual Balance | 22 163 74 (all three) | 74 222 128 | 3.30; 7.88 |
| Forecast Balance | 255 128 45 (all three) | same | 2.51; 5.48 |

- Each series keeps three tokens and its own gradient, so a later scheme is a token change only.
- Stripes: `--chart-hatch-opacity` / `--chart-hatch-width` 0.6 / 1.2 in Light, 1 / 2.2 in Dark.
- **Open (CRITICAL, WEB-001)**: "forecast contrast and distinct colours" fails in Light (contrast only). "Gradient contrast and hue" fails in both themes: lines against the fills, the Dark blue on the card, and the single green's hue matching `success` (026 FR-002), which the user chose.

## R12. Shades that reach 3:1 on the card (2026-11-26)

Replaces three values and the open items in R11.

| Token | Theme | Was | Now | Lowest on the card |
|---|---|---|---|---|
| `--chart-forecast-*` | Light | 255 128 45 | 233 108 7 | 3.18 (was 2.51) |
| `--chart-schedule-start` | Dark | 0 15 255 | 52 110 255 | 3.05 along the gradient (was 1.64) |
| `--chart-schedule-mid` | Dark | 128 15 255 | 142 84 255 | (included above) |

- Each keeps its hue in OKLab and moves lightness only as far as needed, plus a small margin.
- Browser tests "lines reach 3:1 on the card" and "forecast contrast and distinct colours" pass in both themes.
- **Open (CRITICAL, WEB-001)**: "gradient contrast and hue" still fails in both themes: Bank Schedule and Actual Balance against the filled areas, and the single Actual Balance green's hue against `success`.

## R13. Accepted accessibility exception (2026-11-26)

- **Decision (user)**: keep the chart as built. Closes the open items in R9–R12 and the dependency; see plan.md Complexity Tracking for its scope. Permanent: do not raise these three points again.
- **Test**: "gradient contrast and hue" is removed. "Lines reach 3:1 on the card" and "forecast contrast and distinct colours" remain.
- **Alternatives rejected**: fainter fills with deeper lines; measuring only against the card as a general rule change; a dotted forecast fill; names beside the lines; the casing fix.

## R4. Contrast for the new series

- **Decision**: A solid card-coloured casing under the forecast line (stroke width 6) and under its hover ring. The forecast area is a solid gradient fill at opacity 0.25 inside the existing fade mask.
- **Rationale**: FR-010 needs 3:1 against what is behind the line. With the current Bank Schedule (0.6) and Actual Balance (0.5) fills, no distinct set of colours reaches that in Dark. The casing makes the card the background, which also meets SC-004. It is drawn beneath the Bank Schedule and Actual Balance lines, so they look as before. Where one of those lines crosses or overlaps the forecast, the forecast is drawn over it and line-to-line contrast is not required (FR-010); the dashes tell it apart. Casing above those lines was rejected because it would hide them where they run close together.
- **Alternatives**: Near-white or near-black colours (not a recognisable colour scheme); lowering existing fill opacity (changes existing drawing, excluded by the spec).

- **Recheck (2026-11-26, fix unmerged)**: the fix plans `path[data-part="casing"]` and `circle[data-part="ring-casing"]`, card coloured and 6 wide, as one layer under the lines and one under the rings. The forecast casings use the same names, width and layers, so the merge adds the other series to them. Its planned §5 no longer limits fills to 20%, so 0.25 is allowed.

## R5. Colours

| Token | Light | Dark |
|---|---|---|
| `--chart-forecast-start` | `192 38 211` | `232 121 249` |
| `--chart-forecast-mid` | `131 24 67` | `236 72 153` |
| `--chart-forecast-end` | `124 45 18` | `249 115 22` |

- **Decision**: Fuchsia → pink → orange, top to bottom by balance level.
- **Measured** (41 steps along each gradient): contrast with the card at least 4.71 (Light) and 3.89 (Dark). Smallest OKLab distance from the Bank Schedule or Actual Balance colour at the same level 0.168 / 0.189; from the danger, warning, success and info tokens 0.134 / 0.122.
- **Recheck (2026-11-26)** against the fix's planned Actual Balance colours (coral middle, Light amber end 194 132 4; 401 steps): smallest distance from that series 0.167 (Light) and 0.114 (Dark), above the 0.10 gate. No colour replaced.
- **Gate**: The browser test requires contrast ≥ 3:1, OKLab distance ≥ 0.10 from both series at the same gradient level, and OKLab distance ≥ 0.10 from the four status tokens.
- **Alternatives**: Hue-gap rule as in 026 (the free hue ranges are too narrow for three colours); lime schemes (close to success and warning in Light).

## R6. Dashes and legend

- **Decision**: `stroke-dasharray="6 3"` on the line and legend sample. The sample is a `line` with its own `userSpaceOnUse` gradient (an `objectBoundingBox` gradient does not paint a zero-height line). With forecast values the legend starts at `width - 410`, `- 280`, `- 150`; without them it is unchanged.

## R7. Table width

- **Decision**: With the forecast column the table is `min-w-140`; narrower cards scroll within the content panel, as the 320 px table already does. The page itself never scrolls sideways (the app shell is `overflow-hidden`), so browser checks must scroll the column into view in the panel. The card is not widened: the header's card background and the row stripes span the table's full width past the card edge. Without a linked account nothing changes.
- **Rationale**: Five columns cannot hold amounts legibly in 320 px. A wrapper with its own horizontal scroll would break the sticky header.

## R8. Existing failures found (not caused by this feature)

- `e2e/style-guide.spec.ts` "mortgages burndown gradient contrast and hue" fails in both themes at both widths on `main` (4 of 38 burndown tests; run 2026-11-26). Commit `c9f8e62` raised fill opacity to 0.6 / 0.5 and changed colours without changing that test. Causes: lines below 3:1 against the fills; the Light Actual Balance end is 2.94:1 on the card; the green middle colour is about 1° in hue from `success` (30° required).
- `clutch-ui-style/references/forms-components.md` §5 says the burndown gradients run left to right and fills are at most 20% opaque. The code runs top to bottom, hatches the Bank Schedule fill and uses 0.6 / 0.5.

Both are being fixed separately (user decision, 2026-11-26); see plan.md Open Issues.
