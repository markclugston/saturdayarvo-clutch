# Quickstart: First Interest Rate Uses Disbursal Date

Run from `src/clutch-web`.

```powershell
npm run typecheck
npm run lint
npm test -- InterestRateChangesDialog LoanDetailsForm loanDraft
npm run build
```

Expected: all pass.

## Scenarios (covered by component tests)

1. New mortgage, empty Disbursal Date: open Interest Rates; rate input, Effective Date and Add are disabled and the hint "Enter the disbursal date first" is shown, and it still wins when Duration or Payment Frequency is also empty. (US2, FR-001)
2. Enter Disbursal Date, Duration and Payment Frequency: Effective Date shows the Disbursal Date and is disabled; adding a rate lists it as Opening Rate on that date. (US1.1, US1.2)
3. With one rate present: Effective Date is empty and editable; the Disbursal Date field is disabled with a hint. (US1.3, FR-005)
4. With the Opening Rate plus a later rate: the Opening Rate's remove button is disabled with a hint; its rate can be edited (an invalid value is rejected with a row error and the old rate kept); its date cannot. (US1.5, US1.6, FR-007, FR-008)
5. Remove the later rate, then the Opening Rate: Effective Date is prefilled again and the Disbursal Date is editable. (US1.4)

## Browser check (required completion gate)

```powershell
npm run e2e
```

Run the affected mortgage journey specs and the style-guide spec for axe, focus and both themes.
