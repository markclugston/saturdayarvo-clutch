# Contract: Mortgage Account Balance UI

## Details group (`LoanDetailsForm`)

- New `FloatingField as="select"`, label `Mortgage Account`, placed after Payment Frequency, same width class
  as sibling selects. First option "None" (value empty). Options: all accounts by description, alphabetical.
- Draft field `accountId` (string, '' = none) in `loanDraft.ts`; part of dirty comparison, input mapping and
  server error mapping (`accountId`).
- A linked id missing from the account list is treated as none for display; saving is not blocked.
- Accounts failing to load: select offers only "None"; no new message (the form remains usable).
- The form reports its current `accountId` to `MortgagesPage` (`onAccountChange`).

## Amortization Schedule (`AmortizationSchedule`)

- Props: `accountId?`, plus saved mortgage `drawdownDate`, `paymentFrequency`, `duration` (unchanged when
  absent).
- With an account: a fourth column immediately right of Bank Schedule, header = account description,
  cells formatted by `formatCurrencyAmount` in the account currency, read-only, blank when no value.
- Without: layout and behaviour exactly as before (SC-003).
- The balances request sends `drawdownDate`, `frequency` and `duration` all together only when the schedule can
  be generated from the current Details; otherwise it sends none of them (never a partial or invalid mix, which
  the API rejects with 400).
- Details incomplete (a new, unsaved mortgage) + account: monthly fallback rows with the full column set
  (FR-008): every column other than Period and the account balance is blank (Date and Bank Schedule cells
  empty). No balance-bearing transactions: enter-details prompt.
- Load failure: schedule shown, balance cells blank, `ErrorMessage` "The account balances could not be loaded."
- Loading: column cells empty with an `aria-busy` status; no layout shift.
