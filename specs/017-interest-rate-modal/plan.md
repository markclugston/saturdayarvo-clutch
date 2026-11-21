# Implementation Plan: Change Interest Rate Modal

**Branch**: `017-interest-rate-modal` | **Date**: 2026-11-21 | **Spec**: [spec.md](spec.md)

## Summary

Replace the inline "Interest Rate Changes" rows in Loan details with a read-only "Current Interest Rate"
value and a grey "Change Interest Rate" button that opens a modal. The modal lists every change (opening
rate marked), adds a validated change from inputs fixed at the top, and removes changes. It edits the
existing `LoanDraft.rows` only, so 016's Save, Cancel, validation, server mapping and unsaved-changes guard
are reused unchanged. Frontend only: no API, schema or audit change.

## Technical Context

**Baseline**: The existing stack and settled decisions in the code (see `docs/code-map.md`).

**Feature-specific changes**:

- New `neutral` variant on the shared `Button` primitive (`bg-raised text-fg hover:bg-hover`), documented in style guide §5. No new tokens (see [research.md](research.md) R1).
- New `InterestRateChangesDialog` (Base UI dialog via `components/ui/dialog.tsx`) replacing `InterestRateChangesField`.
- New pure helpers in `loanDraft.ts`: `currentInterestRate(rows, today)`, `formatDisplayDate(date)` and `validateNewRateChange(draft, rate, date, today)`, the latter reusing 016's row rules (see [data-model.md](data-model.md)).
- No new packages, endpoints, migrations or schema changes.

**Performance Goals**: Constitution defaults (all interactions are client-side and immediate).

**Constraints**: Modal fits 320 CSS px with no page-level horizontal scroll; add inputs stay visible while the list (up to 60) scrolls; WCAG 2.2 AA in Light, Dark and System.

**Scale/Scope**: One feature folder (`features/mortgages`), one UI primitive, one style-guide reference; up to 60 rows per mortgage.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*
*Procedure: `clutch-constitution-check` skill. One row per ID; use N/A with a reason when an ID does not apply.*

| ID | Applies | How the plan complies | Gate / evidence | Status |
|----|---------|-----------------------|-----------------|--------|
| ARC-001 | Yes | UI only, in clutch-web; no unrequested features (no in-place edit, no rate summary message); domain rules stay in `loanDraft.ts` pure functions | Review | PASS |
| DOT-001 | No | No C# changes | — | N/A |
| DOT-002 | No | No EF Core, query or schema change | — | N/A |
| AUD-001 | No | 016's audit of mortgage saves is unchanged; no new audit reads/writes | — | N/A |
| ENG-001 | Yes | Vitest: `loanDraft` helpers, `InterestRateChangesDialog`, `LoanDetailsForm`, `Button` neutral variant; Playwright: `mortgages.spec.ts` journey and `style-guide.spec.ts` axe/focus states updated | `npm run lint`, `typecheck`, `test`, `build`, `test:e2e` | PENDING |
| OPS-001 | No | No service, runtime or migration change | — | N/A |
| SEC-001 | Yes (marginal) | No endpoint or auth change; client input is still validated server-side by 016's unchanged validator; no new dependency | Independent security review over the diff | PENDING |
| SEC-002 | No | No configuration, credentials or integrations touched | — | N/A |
| SEC-003 | Yes | Interest rates are financial data: not logged, not put in URLs or storage; save errors stay 016's generic messages | Independent security review | PENDING |
| WEB-001 | Yes | TypeScript; Title Case for "Current Interest Rate", "Change Interest Rate", "New Interest Rate", "Effective Date", "Add", "Opening Rate", "Close", and the accessible names "Interest Rate Changes" and "Remove {rate} from {date}"; style guide applied (below); axe in all themes | Frontend gates, UI compliance checklist | PENDING |
| Perf & Observability | Yes (marginal) | Opening, adding and removing are synchronous client state changes (< 500 ms); no service behaviour, so no new metrics | Review: no async work on these paths (Vitest covers the behaviour, not timing) | PASS |

**Applicable style guide sections**: §2 (layout/surfaces: modal on `card`, inputs on `raised`), §4 (floating-label fields for the add inputs), §5 (new neutral button, icon remove/close buttons), §6 (tokens), §7–9 (Title Case, reduced motion, focus ring, contrast), §10 (primitive change in `button.tsx`, synchronized style-guide update).

**UI compliance checklist (§11)**:

- [ ] No borders or divider lines on layout containers (documented hairline exception only)
- [ ] Surface hierarchy follows canvas, content, card, raised
- [ ] Only tokens used: no raw hex, no default palette, no non-token radius
- [ ] Form fields use floating labels
- [ ] Labels, headings and button text use Title Case; helper, error and body text use sentence case
- [ ] Navigation expand/collapse behaviour unchanged; only restyled, unless an approved spec amends it (015: content resizes at 768px and above)
- [ ] Dark theme has no pure black surface or pure white text
- [ ] Both themes visually verified
- [ ] WCAG 2.2 AA contrast checked in both themes
- [ ] Visible focus ring on every interactive element
- [ ] Status not conveyed by colour alone
- [ ] `prefers-reduced-motion` respected

Note on "visible focus ring on every interactive element": after a remove, focus moves to the dialog popup itself (FR-005). The popup is a container, not an interactive control, so it has no ring (`outline-none`, already on `DialogPopup`); every control keeps its ring. Not a deviation.

**Post-design re-check (Phase 1)**: No change. The design adds no endpoint, schema, dependency or token; all gates above remain as stated.

## Project Structure

### Documentation (this feature)

```text
specs/017-interest-rate-modal/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── interest-rate-modal-ui.md
└── tasks.md             # /speckit-tasks output
```

### Source Code (files this feature touches)

```text
src/clutch-web/src/components/ui/
├── button.tsx                          # + neutral variant
└── button.test.tsx                     # + neutral variant test

src/clutch-web/src/features/mortgages/
├── loanDraft.ts                        # + currentInterestRate, formatDisplayDate, validateNewRateChange
├── loanDraft.test.ts                   # new
├── CurrentInterestRate.tsx             # new: value + "Change Interest Rate" button + dialog open state
├── InterestRateChangesDialog.tsx       # new: modal (add inputs, scrolling list, remove)
├── InterestRateChangesDialog.test.tsx  # new
├── InterestRateChangesField.tsx        # removed (replaced by the two above)
├── LoanDetailsForm.tsx                 # use CurrentInterestRate
├── LoanDetailsForm.test.tsx            # update rate-row tests to the modal
├── MortgagesPage.test.tsx              # update rate-row helpers
└── testSupport.tsx                     # update rate-row helpers

src/clutch-web/e2e/
├── mortgages.spec.ts                   # journey through the modal
└── style-guide.spec.ts                 # modal + neutral button states (axe, focus, 320 px, themes)

.claude/skills/clutch-ui-style/references/forms-components.md   # §5 Neutral button
.github/…                                                       # synced by scripts/sync-agent-config.ps1 -From claude
```

**Structure Decision**: Existing layout, following sibling files (`DeleteMortgageDialog.tsx` for the dialog, `DeleteMortgageControl.tsx` for a trigger that owns its dialog state).

## Complexity Tracking

No violations.
