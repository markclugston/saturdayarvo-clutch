# Contract: Change Interest Rate UI

Accessible names and roles that tests (Vitest, Playwright, axe) rely on. Amends the
"Details panel" section of `specs/016-mortgage-tracking/contracts/mortgages-ui.md`; everything else
there is unchanged.

## Details group

- The "Interest rate changes" rows are removed.
- Read-only value labelled "Current Interest Rate" (a term/definition pair or labelled text, not an input): `formatPercent` with 2 decimal places (`5.25%`, `6.00%`), or "Not set".
- Button "Change Interest Rate" beside it at 768 px and wider, stacked below it under 768 px (neither clipped at 320 px), `variant="neutral"`, disabled while saving. Selecting it opens the dialog.
- Form summary near Save, conflict, save-failed and toast behaviour unchanged from 016, except: when every field error key is a rate-row key (`{rowKey}.newInterestRate` / `.effectiveDate`), the summary line reads "Correct the interest rate changes in Change Interest Rate and try again." With no field errors (for example only the set-level `interestRateChanges` message), neither "Correct …" line is shown, as in 016. No message is added beside Current Interest Rate.

## Dialog "Change Interest Rate"

- `role="dialog"`, modal, accessible name "Change Interest Rate"; focus trapped; DOM and Tab order: header (title, "Close"), add area ("New Interest Rate", "Effective Date", "Add"), then each "Remove …" in list order, so "Close" is the first control; Escape or the icon button "Close" closes it and returns focus to "Change Interest Rate". No Save or Cancel buttons.
- Initial focus: the "New Interest Rate" add input (or "Close" when adding is unavailable).
- **Add area** (fixed at top, does not scroll): floating-label fields "New Interest Rate" (%, decimal) and "Effective Date" (`type="date"`), button "Add".
  - Unavailable (`disabled`) until Drawdown Date, Duration and Payment Frequency are valid, with hint "Enter the drawdown date, duration and payment frequency first" linked by `aria-describedby`; at 60 changes, hint "You can add up to 60 interest rate changes".
  - Invalid add: error under the field (`aria-invalid="true"`, `aria-describedby`), nothing added. Valid add: row appears in date order, inputs clear, focus returns to "New Interest Rate".
  - Inputs are empty every time the dialog opens.
  - Add is also `disabled` while saving (cannot occur from the dialog, but keeps the rule uniform with Remove).
- **List** (scrolls within the dialog): a `list` with `aria-label="Interest Rate Changes"` (no visible heading; the dialog title already names it); one `listitem` per change in Effective Date order showing the rate (`5.25%`) and date (`1 Jan 2025`). The change on the Drawdown Date shows the text "Opening Rate" (not colour alone).
  - Each item has icon button "Remove {rate} from {date}" (e.g. "Remove 5.25% from 1 Jan 2025"); always available unless saving.
  - After a remove, focus moves to the dialog popup (no visible ring on any control); the next Tab reaches "Close", the first control in the dialog.
  - Empty list: text "No interest rate changes yet".
- **Errors after a refused save**: per-row messages under the row (from `{rowKey}.newInterestRate` / `.effectiveDate`), and the set-level `interestRateChanges` message (e.g. "Add the opening interest rate, effective on the drawdown date") above the list, as text with `role="alert"` only when it first appears.

## Neutral button (style guide §5)

- `Button variant="neutral"`: `raised` fill, `fg` text, `hover` on hover, `rounded-control`, shared focus ring, no border, no `dark:` variant.
