# Implementation Plan: First Interest Rate Uses Disbursal Date

**Branch**: `021-first-rate-disbursal-date` | **Date**: 2026-11-22 | **Spec**: [spec.md](spec.md)

## Summary

Frontend-only change. In Interest Rates, the opening rate's date is the Disbursal Date: prefilled and
disabled when no rates exist, with the whole add area disabled until a Disbursal Date is entered. The
Disbursal Date field locks while any rate exists, and the Opening Rate cannot be deleted while other rates
exist (its rate value stays editable). No API, schema or validation-rule changes: `validateDraft` already
requires an opening rate dated on the Disbursal Date, so the server contract is unchanged.

## Technical Context

**Baseline**: The existing stack and settled decisions in the code (see `docs/code-map.md`).

**Feature-specific changes**: None beyond baseline. Changes are confined to `src/clutch-web/src/features/mortgages/`.

**Performance Goals**: Constitution defaults (pure client-side state).

**Constraints**:
- The draft is unsaved state in `LoanDraft`; the dialog edits `rows` only (017). Locking logic derives from `draft.rows`, so unsaved rows lock the Disbursal Date too.
- Opening Rate = the row whose date equals `draft.disbursalDate` (the existing label rule). The lock guarantees at most one such row.
- Existing hint `ADD_ROW_HINT` (disbursal date, duration, frequency) stays, unchanged, for the other missing-header cases (Disbursal Date entered but Duration or Payment Frequency missing or invalid). The new, more specific hint "Enter the disbursal date first" takes precedence whenever the Disbursal Date is empty, even if Duration or Payment Frequency is also missing (FR-001).

**Scale/Scope**: 3 source files, 3 primary test files, plus existing tests, test helpers and e2e journeys updated for the new behaviour (see Source Code).

## Constitution Check

| ID | Applies | How the plan complies | Gate / evidence | Status |
|----|---------|-----------------------|-----------------|--------|
| ARC-001 | Yes | UI-only change in clutch-web; no unrequested features. The one addition beyond a pure lock is an inline rate edit on the Opening Rate row, required by FR-007 ("rate value can still be edited"); the list has no edit control today. | Review | Pass |
| DOT-001 | N/A | No .NET changes | - | N/A |
| DOT-002 | N/A | No data access change; server validation unchanged | - | N/A |
| AUD-001 | N/A | No audit change | - | N/A |
| ENG-001 | Yes | Test tasks for every behaviour change (see Source Code); lint, typecheck, tests, build must pass | Test tasks, quality gates | Pass |
| OPS-001 | N/A | No logging, health or migration change | - | N/A |
| SEC-001 | Yes (review only) | No endpoint, auth or input-handling change; client-side enabling only, server still validates. The completion review still applies: independent OWASP Top 10 and dependency review of the changed code (`clutch-security-review`) | Security review task (T014) | Pass |
| SEC-002 | N/A | No secrets | - | N/A |
| SEC-003 | N/A | Financial values already handled; no new logging or disclosure | - | N/A |
| WEB-001 | Yes | Reuse `FloatingField`, `FormattedNumberField`, `Button`; Title Case labels; % entry via shared field; rates right aligned; hints are sentence case | Frontend gates, UI checklist below | Pass |
| Perf & Observability | Yes | Synchronous state changes; no new actions needing progress | 500 ms feedback | Pass |

**Style guide sections**: forms and floating labels, disabled states and helper text, tokens, accessibility
(disabled controls described by a hint via `aria-describedby`, visible focus).

**UI compliance checklist** (§11):

- [X] Only tokens used (Lint)
- [X] No borders on layout containers (Lint, Review)
- [X] Transitions within allowed set (Lint, Browser)
- [X] Surface hierarchy unchanged (Browser, Review)
- [X] Built from existing primitives, none restyled ad hoc (Review)
- [X] Floating labels on form fields (Review)
- [X] Title Case labels and button text; sentence case hints (Review)
- [X] % field uses the shared formatted field, including the new row rate edit (Component)
- [X] Numbers right aligned, `tabular-nums` (Lint, Component, Review)
- [X] Navigation behaviour unchanged (Browser)
- [X] Dark theme has no pure black or white (Browser)
- [X] Both themes verified (Browser)
- [X] WCAG 2.2 AA axe and contrast in both themes (Browser)
- [X] Visible focus ring on every interactive element (Browser)
- [X] Status not conveyed by colour alone: disabled reasons are text hints (Review)

## Project Structure

### Documentation (this feature)

```text
specs/021-first-rate-disbursal-date/
├── plan.md
├── quickstart.md
└── tasks.md             # /speckit-tasks output
```

No `research.md` (no open unknowns), `data-model.md` (no entity or schema change) or `contracts/` (API unchanged).

### Source Code (files this feature touches)

```text
src/clutch-web/src/features/mortgages/
├── loanDraft.ts                       # helpers: openingRowKey(draft) (key of the row dated on the Disbursal Date, else undefined);
│                                      #   canEditDisbursalDate(draft) (draft.rows.length === 0)
├── loanDraft.test.ts                  # helper unit tests
├── InterestRateChangesDialog.tsx      # AddArea: prefill + disable date when no rows, disable all when Disbursal Date empty, new hint;
│                                      #   add uses draft.disbursalDate for first rate; RateList: Opening Rate delete disabled with hint
│                                      #   while other rows exist, inline rate edit on Opening Rate row
├── InterestRateChangesDialog.test.tsx # US1 + US2 scenarios, FR-007/FR-008
├── LoanDetailsForm.tsx                # Disbursal Date disabled with hint while rows exist
└── LoanDetailsForm.test.tsx           # lock and unlock scenarios
```

Also update any existing mortgage tests or e2e journey specs that type a first rate's Effective Date or edit the Disbursal Date after adding rates (found by searching `Effective Date` and `Disbursal Date` in `src/` and `e2e/`), at minimum `MortgagesPage.test.tsx`, `testSupport.tsx`, `e2e/mortgages.spec.ts` and `e2e/style-guide.spec.ts`.

**Structure Decision**: Existing layout, following sibling files. No new files.

## Design Notes

- **Add area**: `AddArea` receives `draft`. `isOpening = canEditDisbursalDate(draft)` (true only when no rows exist yet). Date input value is `draft.disbursalDate` and `disabled` when `isOpening`; otherwise local state as today and empty after each add. Local date state is ignored for the opening add.
- **Add disabled states**: `disbursalMissing = draft.disbursalDate === ''` disables rate, date and Add with hint "Enter the disbursal date first". Any other header problem keeps `ADD_ROW_HINT`; the limit hint is unchanged.
- **Opening add**: `onAdd(newRow(rate.trim(), draft.disbursalDate))`; `validateNewRateChange` is called with the Disbursal Date, so existing validation applies unchanged.
- **Disbursal Date lock**: `disabled={saving || !canEditDisbursalDate(draft)}` with `describedBy` hint "Delete all interest rate changes to edit the disbursal date" (sentence case). Rows are counted raw, matching the dialog's own count.
- **Delete rule**: the row whose key is `openingRowKey(draft)` has its remove button disabled when `rows.length > 1`, with the hint "Delete the other interest rate changes first" linked by `aria-describedby`. It becomes available once it is the sole row, which re-enables the prefilled add (US1 scenario 4).
- **Rate edit**: only the Opening Rate row gets an editable rate (`FormattedNumberField`) so FR-007 holds; later rows are unchanged (remove and re-add). Date is plain text on every row. The edit commits on blur, validated by running `validateDraft` on the draft with only that row's rate replaced and reading that row's `newInterestRate` error (not `validateNewRateChange`, whose appended candidate dated on the Disbursal Date would raise a false "already used" date error), so messages match New Interest Rate; an invalid value shows the row error (existing `ErrorMessage` row pattern) and the previous rate is kept.

## Complexity Tracking

No violations.
