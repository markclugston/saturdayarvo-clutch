# Quickstart: Amortization Period Dates and End-of-Day Balances

## API (repository root)

```powershell
dotnet build
dotnet test --filter "FullyQualifiedName~Mortgages"
```

Expected: all pass. The `Integration` tests need Docker (SQL Server fixture).

Covered scenarios (`F(d, N)` = the Disbursal Date `d` plus N payment intervals, FR-007):

1. `FinalRepaymentDate`: (2023-11-29, 1, Monthly) → 2023-12-29; (2023-11-29, 360, Monthly) → 2053-11-29;
   (2024-01-31, 1..3, Monthly) → 2024-02-29, 2024-03-31, 2024-04-30; Weekly/Fortnightly → 7N/14N days;
   (9999-12-10, 3, Weekly) → 9999-12-31; (9999-12-17, 3, Weekly) → `null`; periods 0 → `null`. (FR-001, FR-007)
2. Validator: Duration N with `F(d, N)` after 31 Dec 9999 refused (9999-12-10 Weekly: 3 accepted, 4 refused); Effective Date one day before and on
   `F(d, N)` accepted, one day after refused. Same vectors in the UI (SC-006).
3. `MortgagePeriods(2023-11-29, 360, Monthly)`: 360 windows ending on each period date. (FR-002, US1.6)
4. Lookup: transactions on a period date (last by Id wins), none on the date (previous wins), the day after
   (ignored), before the first transaction (null). (FR-004, US2.1–US2.4, SC-002, SC-003)
5. Latest transaction between period 3 and 4 dates: period 4 shows it, period 5 on omitted; latest before
   period 1: period 1 shows it. (FR-005)
6. `MonthlyPeriods` fallback output unchanged; endpoint `periodCount` = duration. (FR-006, contract)
7. Endpoint: a mortgage saved under the old rule whose `F(d, Duration)` now passes 31 Dec 9999 is refused with
   the `duration` message, and so is its next save; the endpoint's Duration limit uses the scenario 2 vectors.
   (Spec edge case, FR-007, SEC-004)

## Web (`src/clutch-web`)

```powershell
npm run typecheck
npm run lint
npm test -- AmortizationSchedule repaymentDates loanDraft InterestRateChangesDialog LoanPayoffTimeline MortgagesPage
npm run build
```

Expected: all pass. Covered: Duration 360 renders `aria-rowcount` 361, row 1 "29 Dec 2023", row 360
"29 Nov 2053"; dates follow form changes; fallback view keeps blank dates; balances map to `balances[k - 1]`;
no-account mortgage shows dates and Duration rows (SC-004); Duration and Effective Date boundary vectors match
the API (SC-006).

## Browser check (required completion gate)

```powershell
npm run e2e
```

Mortgage journeys (`e2e/mortgages.spec.ts`: row count, a dated row, Effective Date range message) and the
style-guide spec (axe, focus, both themes).
