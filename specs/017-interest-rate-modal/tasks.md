---

description: "Task list for 017 Change Interest Rate Modal"
---

# Tasks: Change Interest Rate Modal

**Input**: `specs/017-interest-rate-modal/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Tests**: REQUIRED. ENG-001 makes every behaviour change an explicit request for tests. Write
tests first and confirm they fail before implementing.

## Format: `- [ ] T### [P?] [US#?] Description with exact file path`

- **[P]**: parallel-safe (different files, no dependency). **[US#]**: user story label.
- Paths and patterns follow the nearest existing sibling (`docs/code-map.md`): the dialog follows
  `DeleteMortgageDialog.tsx`; a trigger that owns its dialog state follows `DeleteMortgageControl.tsx`.
- Abbreviations: `WEB` = `src/clutch-web`, `MTG` = `src/clutch-web/src/features/mortgages`.
- UI text and accessible names come from `contracts/interest-rate-modal-ui.md`; validation messages
  are 016's, reused through `validateDraft` (research R3). Do not copy or reword them.

No Setup phase: no new packages, tokens, endpoints or migrations (plan Technical Context).

## Phase 1: Foundational (blocks all stories)

- [X] T001 [P] Test `variant="neutral"`: `bg-raised text-fg hover:bg-hover`, `rounded-control`, shared focus ring and disabled rules, no primary/secondary-solid/selected classes, no `dark:` class, in `WEB/src/components/ui/button.test.tsx`
- [X] T002 Add `neutral` variant per research R1 and contract "Neutral button" in `WEB/src/components/ui/button.tsx`
- [X] T003 [P] Add "Neutral button" (when to use, classes, contrast, Dark note from R1) to style guide §5 in `.claude/skills/clutch-ui-style/references/forms-components.md`; run `.\scripts\sync-agent-config.ps1 -From claude`

**Checkpoint**: `npm run lint`, `typecheck`, `test` pass.

---

## Phase 2: User Story 1 - See the current interest rate (Priority: P1) 🎯 MVP

**Goal**: Loan details shows "Current Interest Rate" and a grey "Change Interest Rate" button. | **Independent Test**: Saved mortgage with rates before, on and after today shows one value, today's rate; none effective → "Not set".

- [X] T004 [P] [US1] Create `currentInterestRate(rows, today)` tests per data-model.md (latest valid date `<= today` wins, on-today counts, future ignored, unsorted rows, unparseable rate or date ignored, none → `null`); `formatDisplayDate` tests (`2025-01-01` → `1 Jan 2025`, no UTC day shift), in `MTG/loanDraft.test.ts`
- [X] T005 [P] [US1] Tests: "Current Interest Rate" value (`5.25%` via `formatPercent`, "Not set"), reflects unsaved row edits, button "Change Interest Rate" uses neutral variant and is disabled while saving, in `MTG/LoanDetailsForm.test.tsx`
- [X] T006 [US1] Add `currentInterestRate(rows, today)` per research R2 and data-model.md, and `formatDisplayDate(date)` per data-model.md "Listed rows", in `MTG/loanDraft.ts`
- [X] T007 [US1] Create `CurrentInterestRate.tsx`: labelled read-only value (not an input) + `Button variant="neutral"` "Change Interest Rate" beside it at 768 px and wider, stacked below it under 768 px; owns dialog `open` state (dialog wired in T016), in `MTG/CurrentInterestRate.tsx`
- [X] T008 [US1] Render `CurrentInterestRate` in the Loan details group, computed from the draft with `localToday()`, in `MTG/LoanDetailsForm.tsx` (inline rate rows stay until T017 removes them)

**Checkpoint**: US1 tests pass; existing mortgage tests still pass (rate rows still present).

---

## Phase 3: User Story 2 - Review, add and remove interest rate changes in a modal (Priority: P1)

**Goal**: "Change Interest Rate" opens a modal that lists, adds and removes changes as unsaved Loan details edits. | **Independent Test**: On a saved mortgage add one change, remove another, Save, reload, reopen: list matches (SC-005).

- [X] T009 [P] [US2] `validateNewRateChange(draft, rate, date, today)` tests: each 016 message (outside 0–100, >2 dp, invalid date, outside first–final repayment date, duplicate date), valid → `{}`, opening rate not checked, in `MTG/loanDraft.test.ts`
- [X] T010 [P] [US2] Create dialog tests per quickstart rows 3–6: title, initial focus on New Interest Rate (Close when adding unavailable), date-order list, "Opening Rate" text, empty text, add/clear/refocus, invalid add, disabled Add hints (header invalid; at 60 rows the limit hint), remove still available while Add is disabled, remove name and focus (popup focused, next Tab reaches "Close"), focus trap (Tab from the last control wraps to the first, Shift+Tab from the first wraps to the last), Escape/Close, inputs reset, in `MTG/InterestRateChangesDialog.test.tsx`
- [X] T011 [P] [US2] Replace inline rate-row tests: no rate rows in the group with 1 and 60 changes (SC-001); move T005's "reflects unsaved row edits" test to the modal: Current Interest Rate updates after a modal add and after a modal remove, before Save (US2 AS5); modal edits make the form dirty, Save sends them, Cancel discards them, 016 unsaved-changes prompt covers them, a version conflict after modal edits keeps 016's conflict handling (FR-010), in `MTG/LoanDetailsForm.test.tsx`
- [X] T012 [P] [US2] Test that typed-but-not-added values leave the form clean (no unsaved-changes prompt on tab switch) in `MTG/MortgagesPage.test.tsx`
- [X] T013 [US2] Add `validateNewRateChange` per research R3 (append candidate, run `validateDraft`, return only its `newInterestRate`/`effectiveDate` errors) in `MTG/loanDraft.ts`
- [X] T014 [US2] Create `InterestRateChangesDialog.tsx` per contract "Dialog" and research R4: `DialogPopup` `flex flex-col overflow-hidden max-w-lg`; header with `DialogTitle` "Change Interest Rate" and icon `Button` "Close" (sets `open` false; `dialog.tsx` has no close part) placed before the add area so it is the first control; fixed add area, `min-h-0 overflow-y-auto` list, popup `tabIndex={-1}` focus after remove, in `MTG/InterestRateChangesDialog.tsx`
- [X] T015 [US2] In the dialog: add inputs are local state reset on each open; Add enabled only when `headerIsValid`, rows < 60 (`MAX_RATE_CHANGES`) and not saving; valid add appends `newRow(rate, date)` via `onChange`; move `ADD_ROW_HINT` and the limit hint ("You can add up to 60 interest rate changes") from `InterestRateChangesField.tsx` into this file unchanged, in `MTG/InterestRateChangesDialog.tsx`
- [X] T016 [US2] Wire the dialog into `CurrentInterestRate` (controlled `open`, `finalFocus` = trigger, pass `draft`, `today`, `onRowsChange`, `saving`) in `MTG/CurrentInterestRate.tsx`
- [X] T017 [US2] Remove `InterestRateChangesField` usage and pass rows and change handler to `CurrentInterestRate` in `MTG/LoanDetailsForm.tsx`; delete `MTG/InterestRateChangesField.tsx` (after T015 moved its hint constants)
- [X] T018 [P] [US2] Update rate helpers to open "Change Interest Rate", fill "New Interest Rate"/"Effective Date", select "Add", close, in `MTG/testSupport.tsx`
- [X] T019 [P] [US2] Update rate assertions (line ~157) to read rates from the dialog list items, in `MTG/MortgagesPage.test.tsx`
- [X] T020 [US2] Update `addRate` helper and reload assertions (lines ~39, ~73) to use the dialog; add journey: add, remove, Save, reload, reopen, list matches; Cancel discards; one add journey uses exactly 6 actions (open, New Interest Rate, Effective Date, Add, Close, Save) and is saved (SC-002), in `WEB/e2e/mortgages.spec.ts`

**Checkpoint**: all Vitest tests pass; `mortgages.spec.ts` passes.

---

## Phase 4: User Story 3 - See interest rate problems on save (Priority: P2)

**Goal**: Rate problems from a refused save are shown in the modal only. | **Independent Test**: Remove the opening rate, Save, open the modal: it shows the missing-opening-rate message.

- [X] T021 [P] [US3] Tests: per-row errors under their row (`{rowKey}.newInterestRate`/`.effectiveDate`), set-level `interestRateChanges` above the list with `role="alert"` on first appearance only, removed row's errors gone, set-level message stays after the problem is fixed in the dialog (e.g. opening rate added back) until the next Save, in `MTG/InterestRateChangesDialog.test.tsx`
- [X] T022 [P] [US3] Tests: remove opening rate + Save → refused, dialog shows "Add the opening interest rate, effective on the first repayment date"; server-mapped row errors shown in dialog; First Repayment Date moved after rates were entered → Save refused and the out-of-range rows flagged in the dialog; nothing beside Current Interest Rate; summary near Save shows the set-level message and no "Correct …" line when there is no field error; with only rate-row errors it reads "Correct the interest rate changes in Change Interest Rate and try again."; with any other field error it reads "Correct the highlighted fields and try again.", in `MTG/LoanDetailsForm.test.tsx`
- [X] T023 [US3] Render row and set-level errors per research R5 and contract "Errors after a refused save" in `MTG/InterestRateChangesDialog.tsx`
- [X] T024 [US3] Pass `errors` (row keys and `interestRateChanges`) through `CurrentInterestRate` to the dialog; update the `nonFieldKeys` comment (set-level message now shows in the dialog); in `LoanDetailsForm.tsx` keep the existing `hasFieldErrors` guard and, only when it is true, choose the summary line by whether all field-error keys are rate-row keys (an empty set must not show the rate line), in `MTG/LoanDetailsForm.tsx` and `MTG/CurrentInterestRate.tsx`

**Checkpoint**: all Vitest tests pass.

---

## Phase 5: Completion Gates

- [X] T025 Style-guide states per quickstart row 8: update the rate step (line ~231) to use the dialog; dialog and neutral button in Light, Dark, System; 320 px and desktop; axe clean; focus ring; 60 rows list scrolls with add inputs visible; no page horizontal scroll; remove focus then Tab reaches "Close"; Escape returns focus; Loan details group bounding-box height equal with 1 and 60 changes (SC-001); at 320 px the Current Interest Rate value and button stack and neither is clipped, and at desktop width they sit side by side (FR-001); focus trap wraps in both directions (FR-004), in `WEB/e2e/style-guide.spec.ts` (WEB-001, SC-004); refresh `style-guide.spec.ts-snapshots` only for intended changes
- [X] T026 Independent security review of the full diff incl. `npm audit --omit=dev`; confirm rates are not logged or put in URLs or storage (SEC-001, SEC-003, `clutch-security-review`)
- [X] T027 Validate the plan's UI compliance checklist in both themes (WEB-001, `clutch-ui-style`)
- [X] T028 Run completion quality gates from quickstart.md (`npm run lint`, `typecheck`, `test`, `build`, `test:e2e`) and record results (ENG-001, `clutch-frontend`)
- [X] T029 Run `/speckit-converge` and complete any tasks it appends before declaring completion (Workflow gates)

---

## Dependencies & Execution Order

- Foundational → US1 → US2 → US3 → Completion Gates.
- T002 needs T001 (test first); T007 needs T002; T008 needs T006 and T007.
- T013 needs T006 (same file); T015 needs T013 and T014.
- US1 and US2 are both P1 and ship together: US1 adds the value and button beside 016's inline rows; T017 removes the rows once the dialog exists (T014–T016).
- T016 needs T007 and T014; T017 needs T016; T018–T020 need T017.
- US3 builds on the US2 dialog: T023 needs T014; T024 needs T017 and T023.
- T025 needs T017 (removes the inline rows the current style-guide step uses).

## Parallel Opportunities

- Foundational: T001, T003
- US1: T004, T005
- US2: T009, T010, T011, T012; then T018, T019 after T017
- US3: T021, T022

## Implementation Strategy

MVP = User Stories 1 and 2 together (US1 alone has no button action). Deliver stories incrementally; each must pass its own tests before the next starts.
