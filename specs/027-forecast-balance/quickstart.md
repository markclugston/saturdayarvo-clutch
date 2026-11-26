# Quickstart: Forecast Balance validation

Run from `src/clutch-web`. The integration run needs Docker, the .NET SDK and ports 5173 and 7180.

## Per task

```powershell
npx vitest related src/features/mortgages/forecastBalances.ts src/features/mortgages/actualBalances.ts src/features/mortgages/AmortizationSchedule.tsx src/features/mortgages/BurnDownChart.tsx --run --reporter=dot
```

## Phase end

```powershell
npm run lint
```

```powershell
npm run typecheck
```

```powershell
npm test -- --reporter=dot
```

## Completion

```powershell
npx playwright test --config playwright.style-guide.config.ts --reporter=line
```

```powershell
npm run test:e2e
```

```powershell
npm run test:e2e:integration
```

```powershell
npm run build
```

```powershell
npm audit --omit=dev
```

Screenshot baselines (forecast and, after the colour changes, existing burndown states): regenerate with `--update-snapshots=all` limited by `-g "burndown|forecast"`, review the images, then rerun without the flag.

"mortgages burndown gradient contrast and hue" is removed under the accepted exception (research.md R13).

## Expected outcomes

| Scenario | Evidence |
|---|---|
| Values (FR-002 to FR-007, SC-001) | `forecastBalances.test.ts`: windows 12/26/52 and fewer, odd/even median and rounding, zero/negative median, negative and zero reductions counted in a positive median, pairs with a blank excluded, balances beyond `rowCount` ignored, mostly repeated balances (Weekly with monthly repayments) giving no forecast, single balance, zero then blank, still above zero at the final row, last balance on the final row, negative last balance, 0- and 3-decimal amounts |
| Column (FR-001, FR-007a, SC-005) | Component tests: header order, blank loading/failed/fallback/no-data, shown without a Bank Schedule, absent without an account |
| Refresh (FR-008) | Component test: invalidated balances and changed account or Details change the cells |
| Series, legend, label, text (FR-009, FR-011 to FR-013, SC-002) | Component tests against contracts/forecast-balance-ui.md; each hovered amount equals the table cell |
| Unchanged without forecast (US2-5) | Component test: output equals the no-forecast chart; existing screenshots pass |
| Contrast and distinct colours (FR-010, SC-004) | Style-guide tests per theme (research.md R12, R13) |
| 320 px, themes, axe, reduced motion | Style-guide forecast states: table and chart screenshots, no page sideways scroll; Forecast Balance header and cell scrolled into view, unclipped and not overlapping; forecast line, area and legend inside the chart, legend entries not overlapping, hover label inside the chart |
| 500 ms at 1,560 periods (SC-003) | Component timing test with most rows forecast |
