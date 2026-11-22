---

description: "Task list for First Interest Rate Uses Disbursal Date"
---

# Tasks: First Interest Rate Uses Disbursal Date

**Input**: `specs/021-first-rate-disbursal-date/` (plan.md, spec.md, quickstart.md)

**Tests**: REQUIRED. ENG-001 makes every behaviour change an explicit request for tests. Write
tests first and confirm they fail before implementing.

## Format: `- [ ] T### [P?] [US#?] Description with exact file path`

All paths are under `src/clutch-web/` (feature dir: `src/features/mortgages/`).

## Phase 1: Setup

None needed (no new packages or config).

## Phase 2: Foundational (blocks all stories)

- [X] T001 [P] Unit tests in `src/features/mortgages/loanDraft.test.ts` for new helpers `openingRowKey(draft)` (key of the row dated on `disbursalDate`; undefined when none or Disbursal Date empty) and `canEditDisbursalDate(draft)` (true only when `draft.rows.length === 0`)
- [X] T002 Add `openingRowKey` and `canEditDisbursalDate` in `src/features/mortgages/loanDraft.ts` so T001 passes (plan: Source Code, Design Notes)

**Checkpoint**: build + fast tests pass.

---

## Phase 3: User Story 1 - Opening rate takes the disbursal date (Priority: P1) 🎯 MVP

**Goal**: First rate's Effective Date is the Disbursal Date, prefilled and disabled; the Disbursal Date locks while rates exist; Opening Rate cannot be deleted while others exist but its rate is editable.
**Independent Test**: Enter a Disbursal Date, open Interest Rates, confirm date prefilled and disabled; add a rate and see it listed as Opening Rate on that date.

- [X] T003 [P] [US1] Component tests in `src/features/mortgages/InterestRateChangesDialog.test.tsx`: prefilled disabled date with no rows (US1.1), add uses Disbursal Date (US1.2, FR-003), empty editable date with rows (US1.3, FR-004), prefill returns after removal (US1.4); a later rate dated on or before the Disbursal Date is rejected, so only one row is ever dated on the Disbursal Date (plan: Constraints)
- [X] T004 [US1] Component tests in `src/features/mortgages/InterestRateChangesDialog.test.tsx`: Opening Rate remove disabled with `aria-describedby` hint while other rows exist, enabled when sole row; hint reads "Delete the other interest rate changes first"; its rate editable and committed on blur, an invalid value rejected with a row error and the previous rate kept, no date edit offered; the rate edit shows only characters valid for a percentage, shows the formatted value on blur and is right aligned (US1.5, US1.6, FR-007, FR-008, WEB-001)
- [X] T005 [P] [US1] Component tests in `src/features/mortgages/LoanDetailsForm.test.tsx`: Disbursal Date disabled with hint "Delete all interest rate changes to edit the disbursal date" while rows exist, editable at zero rows (FR-005)
- [X] T006 [US1] In `src/features/mortgages/InterestRateChangesDialog.tsx` pass `draft` to `AddArea`; when `canEditDisbursalDate(draft)` show `draft.disbursalDate` in a disabled date input and call `onAdd(newRow(rate.trim(), draft.disbursalDate))`; otherwise keep local, empty-after-add date state
- [X] T007 [US1] In `src/features/mortgages/InterestRateChangesDialog.tsx` `RateList`: disable the remove button of the row matching `openingRowKey(draft)` while `rows.length > 1` with an `aria-describedby` hint "Delete the other interest rate changes first"; add inline rate edit via `FormattedNumberField` on that row only (commit on blur, validated by running `validateDraft` on the draft with only that row's rate replaced and reading that row's `newInterestRate` error, so the same messages as New Interest Rate apply without a candidate row or false date errors; row error and previous rate kept when invalid; date stays plain text)
- [X] T008 [US1] In `src/features/mortgages/LoanDetailsForm.tsx` set Disbursal Date `disabled={saving || !canEditDisbursalDate(draft)}` with the sentence-case hint from T005

**Checkpoint**: the new US1 tests pass; run `npm test -- InterestRateChangesDialog LoanDetailsForm loanDraft`. Existing tests broken by the new disabled states are fixed in T011 (Phase 4), so the full run is green only after Phase 4.

---

## Phase 4: User Story 2 - Add is unavailable until the disbursal date is entered (Priority: P1)

**Goal**: Rate input, Effective Date and Add are disabled with a hint until a Disbursal Date exists.
**Independent Test**: With empty Disbursal Date confirm all three disabled with hint; enter the date and they enable.

- [X] T009 [US2] Component tests in `src/features/mortgages/InterestRateChangesDialog.test.tsx`: empty Disbursal Date disables rate, date and Add with hint "Enter the disbursal date first" (US2.1, FR-001); the "Enter the disbursal date first" hint wins even when Duration or Payment Frequency is also empty; enabled after entry, other missing headers keep `ADD_ROW_HINT`, limit hint unchanged (US2.2, FR-001, FR-006)
- [X] T010 [US2] In `src/features/mortgages/InterestRateChangesDialog.tsx` `AddArea`: `disbursalMissing = draft.disbursalDate === ''` disables rate, date and Add with the new hint linked by `aria-describedby`; keep `ADD_ROW_HINT` for other header problems
- [X] T011 Update existing tests and helpers that type a first rate's Effective Date or edit the Disbursal Date after adding rates, now that US1 and US2 disabled states exist: `MortgagesPage.test.tsx`, `testSupport.tsx`, `InterestRateChangesDialog.test.tsx`, `LoanDetailsForm.test.tsx`; then re-run `npm test -- InterestRateChangesDialog LoanDetailsForm loanDraft`

**Checkpoint**: story's tests pass.

---

## Phase 5: Completion Gates

- [X] T012 Update affected journey in `e2e/mortgages.spec.ts` (and `e2e/style-guide.spec.ts` if it types dates) for the prefilled first Effective Date and locked Disbursal Date (WEB-001)
- [X] T013 Validate UI compliance checklist in both themes, including axe, focus ring and the new rate edit field (WEB-001, `clutch-ui-style`)
- [X] T014 Perform the independent OWASP Top 10 and dependency vulnerability review of the changed code, record findings, and remediate any before completion (SEC-001, `clutch-security-review`)
- [X] T015 Run `npm run typecheck`, `npm run lint`, `npm test -- InterestRateChangesDialog LoanDetailsForm loanDraft`, `npm run build`, `npm run e2e` (mortgage and style-guide specs) and record results (ENG-001, `clutch-frontend`)
- [ ] T016 Run `/speckit-converge` and complete any tasks it appends before declaring the feature complete (Workflow and Delivery Gates)

---

## Phase 6: Follow-up - Interest Rates dialog presentation and unsaved schedule (US3, 020 FR-008)

- [X] T017 [P] [US3] Component tests in `src/features/mortgages/InterestRateChangesDialog.test.tsx`: Opening row titled "Opening Interest Rate" with no other Opening Rate text, other rows "Interest Rate Change", rate left aligned (FR-010, FR-011); button and dialog named "Interest Rates" in all mortgage tests (FR-009)
- [X] T018 [US3] In `src/features/mortgages/InterestRateChangesDialog.tsx` and `CurrentInterestRate.tsx`: rename to "Interest Rates", the new titles, left aligned rate and date, wider spacing between title and data
- [X] T019 [P] Tests in `LoanDetailsForm.test.tsx` (`onScheduleChange` reports valid Duration, Disbursal Date and Payment Frequency, `undefined` once any is invalid) and `MortgagesPage.test.tsx` (unsaved mortgage schedule has Duration + 1 rows; prompt returns when Duration is cleared) for 020 FR-008
- [X] T020 Add `onScheduleChange` to `LoanDetailsForm.tsx`; `MortgagesPage.tsx` passes the saved values, else the form's, to the schedule
- [X] T022 Test in `LoanDetailsForm.test.tsx` and fix in `LoanDetailsForm.tsx`: adding an opening rate clears the "Add the opening interest rate" message (FR-012)
- [ ] T021 Update `e2e/mortgages.spec.ts` and `e2e/style-guide.spec.ts` for the new labels (renamed; not yet run) and run `npm run e2e` for the mortgage and style-guide specs

---

## Dependencies & Execution Order

- Foundational → US1 → US2 → Completion Gates. T011 (updating existing tests) runs last in Phase 4, after both stories' implementation tasks.
- T002 needs T001; T006, T007 need T002; T011 after T006-T008 and T010 (the new disabled states can break existing tests), then re-run the affected tests.
- T010 edits the same file as T006/T007, so run it after them.
- Tests (T003-T005, T009) are written and failing before their implementation tasks.

## Parallel Opportunities

- Foundational: T001 alone, then T002.
- US1: T003 and T005 together (different files); T004 follows T003 (same file); then T006→T007 (same file), T008 in parallel with them.
- US2: T009 follows T004 (same test file); T010 follows T007.

## Implementation Strategy

MVP = User Story 1. Deliver stories incrementally; each must pass its own tests before the next starts.
