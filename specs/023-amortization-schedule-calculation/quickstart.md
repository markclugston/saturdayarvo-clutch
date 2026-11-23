# Quickstart: Amortization Schedule Calculation

All checks are agent-executable. Run from `src/clutch-web`.

## Prerequisites

```powershell
npm ci
```

## 1. Calculation (Vitest)

```powershell
npx vitest run src/features/mortgages/scheduleCalculation.test.ts src/features/mortgages/loanDraft.test.ts src/features/mortgages/repaymentDates.test.ts
```

Expected, among others:

| Scenario | Expected |
|---|---|
| $500,000.00, 360 Monthly, 6.00% | P1 $499,502.25 (repayment $2,997.75, interest $2,500.00); P2 $499,002.01; P360 $0.00 |
| Weekly / Fortnightly | periodic rate = annual ÷ 52 / 26; last balance $0.00 |
| 0.00% | equal repayments; last balance $0.00 |
| 6.00% → 5.50% on period 24's date | P1–24 at 6.00%; P25 repayment recalculated over 336 periods from P24's balance |
| Period 29 Dec 2023–29 Jan 2024, 6.00% → 5.00% on 8 Jan 2024 | interest = round(opening × (0.06/12 × 10/31 + 0.05/12 × 21/31)) |
| Two changes in one period; change on final date; Duration 1 | blended by days; unaffected; one row at $0.00 |
| Mid-period rise above the kept repayment | that period's balance rises; next period recalculated |
| Rate change inside period 1 | P1 repayment at the Disbursal Date's rate; P1 interest blended; recalculated from P2 |
| $1.80, 360 Monthly, 0.00% | repayment rounds up to $0.01; balance reaches $0.00 at P180 and stays $0.00, never negative |
| 1,560 Weekly periods | completes well under 500 ms (SC-004) |
| Invalid input other than Name | `scheduleInputs` returns null |

## 2. Components (Vitest)

```powershell
npx vitest run src/features/mortgages
```

Expected: Bank Schedule cells show calculated balances; editing a Detail updates them without saving;
an invalid edit on a saved mortgage shows "Not yet calculated" and the chart message (no saved fallback);
an invalid Name alone keeps values; the Burndown draws the series and its text alternative names the Opening
Balance, Disbursal Date, final repayment date and $0.00; Actual Balance column unchanged.

## 3. Browser journeys and style guide (Playwright)

```powershell
npm run test:e2e -- e2e/mortgages.spec.ts
```

```powershell
npm run test:e2e:style-guide
```

Expected: saved mortgage shows calculated balances and a plotted Burndown; a rate change edit updates both;
axe passes and screenshots match in light and dark themes.

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

Expected: no errors or warnings (`clutch/numeric-align`, `clutch/style-tokens` included); all tests pass,
including the SC-004 timing test.
