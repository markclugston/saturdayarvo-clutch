# Quickstart: Actual Balance Chart Line

All checks are agent-executable. Run from `src/clutch-web`.

## Prerequisites

```powershell
npm ci
```

## 1. Points and chart (Vitest)

```powershell
npx vitest run src/features/mortgages/actualBalances.test.ts src/features/mortgages/BurnDownChart.test.tsx
```

Expected, among others ([contract](contracts/burndown-chart-ui.md)):

| Scenario | Expected |
|---|---|
| Balances `[null, "499000.00", "498100.50"]` | 2 points at periods 2 and 3's dates; no Disbursal Date point |
| No account | SVG and label identical to 023's output, except the Bank Schedule class `text-chart-primary` (same colour) |
| Two or more balances | dashed `text-chart-navy` polyline after the solid `text-chart-primary` one; legend lists both |
| One balance | single `text-chart-navy` circle, no polyline |
| Ready, no balances | no line; legend lists Actual Balance; label says no actual balances to plot |
| Loading / failed | no line, no chart message, label describes the Bank Schedule only |
| Balance above Opening Balance | axis top is the next round value above it |
| Negative balance | axis extends below $0; $0 tick still labelled; guides aligned with ticks; every point inside the plot |
| 1,560 periods with balances | renders within 500 ms |

## 2. Integration in the page (Vitest)

```powershell
npx vitest run src/features/mortgages
```

Expected: column values unchanged after the hook extraction; changing the account or choosing "None" redraws or
removes the line; invalidating period balances (import, delete) updates it; editing a Detail redraws both lines.

## 3. Browser journeys and style guide (Playwright)

```powershell
npm run test:e2e -- e2e/mortgages.spec.ts
```

```powershell
npm run test:e2e:style-guide
```

Expected: a mortgage with a linked account shows both lines and legend entries; axe passes and screenshots match
in Light and Dark themes and at 320 px.

## 4. Quality gates

```powershell
npm run lint
```

```powershell
npm run typecheck
```

```powershell
npm run test
```

```powershell
npm run test:e2e
```

```powershell
npm run test:e2e:style-guide
```

```powershell
npm run build
```

Expected: no errors or warnings (`clutch/style-tokens` included); all tests pass, including the SC-004 timing test.
