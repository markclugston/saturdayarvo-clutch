# Quickstart: Change Interest Rate Modal

Agent-executable validation. Run from `src/clutch-web`. Behaviour under test is in
[contracts/interest-rate-modal-ui.md](contracts/interest-rate-modal-ui.md) and
[data-model.md](data-model.md).

## Prerequisites

- `npm ci` done; Docker running for the Playwright test API (see `e2e/start-test-api.mjs`).

## Quality gates

```powershell
npm run lint
```

```powershell
npm run typecheck
```

```powershell
npm test
```

```powershell
npm run build
```

```powershell
npm run test:e2e
```

## Scenarios and expected outcomes

| # | Scenario | Covered by | Expected |
|---|---|---|---|
| 1 | Rates before, on and after today; none on or before today | `loanDraft.test.ts` | Current Interest Rate is the latest-on-or-before-today rate; otherwise "Not set" (SC-003) |
| 2 | Loan details with 1 and 60 changes | `LoanDetailsForm.test.tsx`, `e2e/style-guide.spec.ts` | No rate rows in the group; same structure regardless of count; group height equal (SC-001) |
| 3 | Open dialog, add, remove, close, Save, reopen | `InterestRateChangesDialog.test.tsx`, `LoanDetailsForm.test.tsx`, `e2e/mortgages.spec.ts` | List matches after reload (SC-002, SC-005); Cancel discards modal edits |
| 4 | Invalid add (duplicate date, 100.5, 3 dp, out-of-range date), header invalid, 60 rows | `InterestRateChangesDialog.test.tsx` | Field errors with 016 messages; Add disabled with hint; remove still works |
| 5 | Typed but not added, close, reopen | `InterestRateChangesDialog.test.tsx`, `MortgagesPage.test.tsx` | Inputs empty; form not dirty |
| 6 | Remove focus; Escape/Close focus return | `InterestRateChangesDialog.test.tsx`, `e2e/style-guide.spec.ts` | Focus on popup then "Close" (first control) on Tab; focus back on "Change Interest Rate" |
| 7 | Remove opening rate, Save | `LoanDetailsForm.test.tsx` | Save refused; dialog shows "Add the opening interest rate, effective on the drawdown date"; nothing beside Current Interest Rate; with only rate-row errors the summary near Save reads "Correct the interest rate changes in Change Interest Rate and try again." |
| 8 | Axe, focus ring, Light/Dark/System, 320 px and desktop, 60 rows | `e2e/style-guide.spec.ts` | No violations; no page horizontal scroll; add inputs visible while list scrolls (SC-004) |
| 9 | Neutral variant | `button.test.tsx` | Uses `bg-raised text-fg`, not primary/secondary/selected classes |
