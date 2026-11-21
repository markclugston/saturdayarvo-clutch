# Research: Change Interest Rate Modal

The spec left one item to planning (the grey button token). The other entries record design
choices that the code made necessary.

## R1 Grey button style

- **Decision**: New `neutral` `Button` variant: `bg-raised text-fg hover:bg-hover`, same radius, focus ring and disabled rules as the other variants. Named "Neutral button" in style guide §5.
- **Rationale**: `raised` is already the grey control tone (fields, icon buttons). `fg` on `raised` is about 16:1 in Light and 8:1 in Dark, well above AA. It is neither `primary`, `secondary-solid` (near-black in Light) nor `selected`.
- **Note**: In Dark, `secondary-solid` already resolves to the `raised` value, so neutral and secondary look alike there. That is acceptable: the request rules out black and blues, and Dark's secondary is grey. No new token is added.
- **Alternatives**: A new `--neutral-button` token (rejected: duplicates `raised`); using the `icon` variant at default size (rejected: the style guide names icon buttons as square, and a named style was requested).

## R2 Current Interest Rate

- **Decision**: `currentInterestRate(rows, today)` in `loanDraft.ts` returns the rate of the row with the latest valid Effective Date `<= today` (local, via `localToday()`), or `null` → "Not set". Displayed with `formatPercent`.
- **Rationale**: Pure, unit-testable (SC-003) and computed from the unsaved draft so it reflects modal edits (US2 AS5).

## R3 Validating an added change

- **Decision**: `validateNewRateChange(draft, rate, date, today)` runs `validateDraft` on the draft with the candidate appended and returns only the candidate's `newInterestRate`/`effectiveDate` errors. The 60-change limit is enforced by disabling Add (data-model "Add allowed"), not here.
- **Rationale**: Reuses 016's exact rules and messages (FR-006, FR-010) instead of copying them. The opening-rate rule is set-level and is not checked on add.

## R4 Modal layout and focus

- **Decision**: `DialogPopup` overridden to `flex flex-col overflow-hidden` with a wider max width (`max-w-lg`); header and add inputs sit in a non-scrolling block, the list in a `min-h-0 overflow-y-auto` region. Controlled `open` state with `finalFocus` set to the trigger button; after a remove, focus the popup element (`tabIndex={-1}`, existing `outline-none`).
- **Rationale**: Meets the clarified layout (inputs fixed, list scrolls) and focus behaviour; Base UI keeps the trap. Add-input state lives inside the dialog component and is reset on each open, so unadded values are discarded (FR-006) and never touch the draft or the unsaved-changes guard.

## R5 Save errors after the move

- **Decision**: Row and set-level `interestRateChanges` errors stay in `LoanDetailsForm`'s `errors` and are passed to the dialog, which shows them per row and above the list. The summary near Save keeps the set-level message; its generic line switches to "Correct the interest rate changes in Change Interest Rate and try again." when all field errors are rate-row errors, since those fields are hidden while the dialog is closed. Nothing is added beside Current Interest Rate.
- **Rationale**: FR-009 and clarification 5; 016's summary behaviour is preserved (FR-010).
