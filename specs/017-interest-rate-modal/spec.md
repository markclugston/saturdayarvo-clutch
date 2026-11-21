# Feature Specification: Change Interest Rate Modal

**Feature Branch**: `017-interest-rate-modal`

**Created**: 2026-11-21

**Status**: Draft

**Input**: User description: "rather than having the interest rate changes as a growing list on the mortgage screen add a button to a modal popup labeled "Change Interest Rate". on the popup you will be able to see a list of all interest rate changes including the first starting date. you will be able to add or remove those interest rate changes. on the main mortgage screen you will see Current Interest Rate with the "Change Interest Rate" button next to it. the button should be a standard grey button. e.g. no black, dark blue or light blue."

## Clarifications

### Session 2026-11-21

- Q: Do modal changes become unsaved Loan details changes stored by the Loan details Save button, or does the modal save them itself? → A: Loan details Save. The modal only edits the unsaved Loan details; Save stores them and Cancel discards them.
- Q: What happens to a New Interest Rate or Effective Date typed in the modal but not added when the modal closes? → A: Discarded without a prompt; the add inputs are empty the next time the modal opens.
- Q: Where do the add inputs sit in the modal relative to the list? → A: Fixed at the top of the modal, with the list scrolling below them.
- Q: Where does keyboard focus go after a change is removed in the modal? → A: To the modal dialog itself, with no visible focus ring on any control; the next Tab moves to the first control in the modal.
- Q: When does an "interest rate changes need attention" message next to Current Interest Rate clear? → A: There is no such message; it was not requested. Row-level interest rate change problems from a refused save are shown only in the modal. The form summary near Save stays as in 016: it shows the set-level message, and when the only highlighted fields are interest rate changes it reads "Correct the interest rate changes in Change Interest Rate and try again." instead of "Correct the highlighted fields and try again."

<!--
  Builds on 016-mortgage-tracking. Validation rules, limits, saving, versioning, auditing and the
  unsaved-changes prompt from 016 are unchanged; only where interest rate changes are shown and entered moves.
-->

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the current interest rate (Priority: P1)

As a signed-in user viewing a mortgage, I see its Current Interest Rate on the Loan details group instead of a growing list of every rate change.

**Why this priority**: Keeps the Loan details group short and shows the rate that matters now.

**Independent Test**: Open a saved mortgage with three interest rate changes (one in the future) and confirm Loan details shows one Current Interest Rate value, the rate in force today, with no list of rows.

**Acceptance Scenarios**:

1. **Given** a mortgage, **When** the Loan details group is shown, **Then** it shows "Current Interest Rate" with its value and a "Change Interest Rate" button next to it, and no interest rate change rows.
2. **Given** interest rate changes effective before, on and after today, **When** the value is shown, **Then** it is the New Interest Rate of the change with the latest Effective Date on or before today.
3. **Given** no interest rate change is effective on or before today (for example a new mortgage with none entered), **When** the value is shown, **Then** it reads "Not set".
4. **Given** the "Change Interest Rate" button, **When** the user views it in any theme, **Then** it is a neutral grey button, not the primary (blue), secondary (black) or selected (light blue) style.

---

### User Story 2 - Review, add and remove interest rate changes in a modal (Priority: P1)

As a signed-in user, I select "Change Interest Rate" to open a modal listing every interest rate change, including the opening rate on the first repayment date, where I can add and remove changes.

**Why this priority**: Replaces the on-screen list; without it rates cannot be entered.

**Independent Test**: Open the modal on a saved mortgage, add one change, remove another, save, reopen and confirm the list matches.

**Acceptance Scenarios**:

1. **Given** the Loan details group, **When** the user selects "Change Interest Rate", **Then** a modal titled "Change Interest Rate" opens listing every interest rate change in Effective Date order, each showing New Interest Rate and Effective Date, with the change on the First Repayment Date, if present, marked as the opening rate.
2. **Given** the modal, **When** the user enters a New Interest Rate and Effective Date and adds them, **Then** the change appears in the list in Effective Date order.
3. **Given** a listed change, **When** the user selects its remove control, **Then** it leaves the list and focus moves to the modal dialog itself, with no visible focus ring on any control; the next Tab moves to the first control in the modal.
4. **Given** First Repayment Date, Number of Periods or Repayment Frequency is missing or invalid, **When** the modal is open, **Then** adding is unavailable and the existing hint explains those fields are needed first; removing stays available.
5. **Given** the user has added or removed changes, **When** they close the modal, **Then** the changes stay as unsaved Loan details changes, Current Interest Rate reflects them, and nothing is stored until the user selects the Loan details Save button; Loan details Cancel discards them with the other edits.
6. **Given** the modal is open, **When** the user presses Escape or the close control, **Then** it closes and focus returns to the "Change Interest Rate" button.

---

### User Story 3 - See interest rate problems on save (Priority: P2)

As a signed-in user, when a save is refused because of interest rate changes, I can see what is wrong and fix it in the modal.

**Why this priority**: Row errors are no longer visible on the main screen.

**Independent Test**: Remove the opening rate, save, open the modal and confirm it flags the missing opening rate.

**Acceptance Scenarios**:

1. **Given** a save refused for any interest rate change problem, **When** the user opens the modal, **Then** each offending row and any list-wide problem (such as a missing opening rate) is shown with its message as in 016.
2. **Given** a save refused for interest rate change problems, **When** the result is shown, **Then** no extra message is added next to Current Interest Rate.
3. **Given** a save refused only for interest rate change row problems, **When** the result is shown, **Then** the summary near Save reads "Correct the interest rate changes in Change Interest Rate and try again."

### Edge Cases

- Opening rate removed → allowed in the modal; save refused with 016's "Add the opening interest rate, effective on the first repayment date".
- First Repayment Date changed after rates were entered → rows outside the new range are flagged on save as in 016.
- Mortgage already has 60 interest rate changes → adding is unavailable with 016's limit hint.
- Duplicate Effective Date, rate outside 0–100 or more than 2 decimal places, date outside the allowed range → refused when adding, with the field flagged in the modal.
- Rows left partly filled are not possible: a change is only added once both values are valid.
- Problem fixed in the modal after a refused save (for example the opening rate added back) → as in 016, the list-wide message and the summary near Save stay until the next Save re-validates; a removed row's messages disappear with it.
- Values typed in the add inputs but not added when the modal closes → discarded without a prompt; they are not unsaved Loan details changes and do not trigger 016's unsaved-changes prompt.
- Narrow screens (320 CSS pixels) → the modal fits the viewport and its list scrolls inside it, with no page-level horizontal scroll.
- Long lists (up to 60) → the list scrolls within the modal below the add inputs, which stay visible at the top.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Loan details group MUST replace the interest rate change rows with a "Current Interest Rate" read-only value and a "Change Interest Rate" button beside it at 768 CSS pixels and wider, stacked below it under 768 CSS pixels, with neither clipped at 320 CSS pixels.
- **FR-002**: Current Interest Rate MUST be the New Interest Rate of the change with the latest Effective Date on or before the user's local today, formatted as a percentage with 2 decimal places as in 016 (for example "6.00%"), from the values currently in the form; with none, it MUST read "Not set".
- **FR-003**: The "Change Interest Rate" button MUST use a neutral grey style that is not the primary, secondary or selected/tint style (so never blue, light blue or black in any theme), meets WCAG 2.2 AA contrast in Light, Dark and System themes, and is added to the style guide as a named button style.
- **FR-004**: Selecting the button MUST open a modal dialog titled "Change Interest Rate" that traps focus, closes on Escape or a close control, and returns focus to the button.
- **FR-005**: The modal MUST list every interest rate change in Effective Date order, each with New Interest Rate, Effective Date and a remove control named for assistive technology (e.g. "Remove 5.25% from 1 Jan 2025"); the change on the First Repayment Date MUST be marked as the opening rate. After a remove, focus MUST move to the modal dialog itself (staying inside the focus trap) with no visible focus ring on any control, and the next Tab MUST reach the first control in the modal.
- **FR-006**: The modal MUST let the user add a change by entering New Interest Rate and Effective Date and selecting "Add", using add inputs fixed at the top of the modal above the list, which scrolls on its own and leaves them visible; each new change MUST be checked against 016's rules (rate range and precision, date range, unique date) before it is listed, with errors shown next to the field. At 016's 60-change limit, adding MUST be unavailable with 016's limit hint. Values typed but not added MUST be discarded when the modal closes, and the add inputs MUST be empty each time it opens.
- **FR-007**: Adding MUST be unavailable until First Repayment Date, Number of Periods and Repayment Frequency are valid, as in 016.
- **FR-008**: The modal MUST NOT save on its own; it has no Save or Cancel button. Changes made in it MUST become unsaved Loan details changes, stored only by the Loan details Save button, discarded by Loan details Cancel, and covered by 016's unsaved-changes prompt.
- **FR-009**: After a save refused for interest rate change problems, the modal MUST show the row-level and list-wide messages from 016 when opened. No message is added next to Current Interest Rate. The form summary near Save keeps 016's behaviour, except that when every field error belongs to an interest rate change it MUST read "Correct the interest rate changes in Change Interest Rate and try again."
- **FR-010**: All 016 validation, limits, saving, conflict handling, auditing and unsaved-changes behaviour MUST apply unchanged to interest rate changes made through the modal.

### Key Entities *(include if feature involves data)*

- **Interest rate change**: Unchanged from 016 (New Interest Rate, Effective Date, belongs to one mortgage).
- **Current interest rate** (displayed, not stored): Derived from the interest rate changes and today's date.

### Constitution Scope

Tick each that applies, so plan can pick requirement IDs without rereading the spec:

- [ ] Stores, changes or deletes data (DOT-002, OPS-001 migrations)
- [ ] Creates or reads audit records (AUD-001)
- [x] Adds or changes endpoints, auth or input handling (SEC-001) — client input handling only; server validation unchanged from 016
- [x] Handles personal, payment or financial data (SEC-003)
- [x] Changes UI in clutch-web (WEB-001, style guide)

## Success Criteria *(mandatory)*

- **SC-001**: The Loan details group's height no longer grows with the number of interest rate changes: it is the same with 1 and 60 changes.
- **SC-002**: A user can open the modal, add one interest rate change and save the mortgage in one uninterrupted journey of no more than 6 actions (open, two fields, Add, close, Save).
- **SC-003**: For any set of changes and any date, Current Interest Rate matches the rule in FR-002 in 100% of checks.
- **SC-004**: The modal and the grey button pass automated accessibility checks with no violations in all three themes, at 320 CSS pixels and at desktop widths.
- **SC-005**: 100% of interest rate changes added or removed in the modal appear unchanged after saving and reopening the mortgage.

## Assumptions

- 016's validation rules, limits, messages, ordering, saving and the server's handling of interest rate changes stay as implemented (`src/clutch-web/src/features/mortgages/`, `src/Clutch.API/Application/Mortgages/`); no data or API change is needed.
- Listed changes are not edited in place; to correct one, the user removes it and adds a new one (the request names add and remove only).
- The modal uses the existing dialog pattern from the delete confirmation (`DeleteMortgageDialog.tsx`) and the style guide.
- "Grey button" means a neutral grey fill with standard text colour, similar to the existing `raised` surface used by icon buttons; planning settled it as the `raised` token in a named "Neutral button" style (research R1).
- "Today" for Current Interest Rate is the user's local date, as in 016.
- In Dark the secondary style already resolves to the `raised` grey, so the neutral button may look the same as secondary there; FR-003 is about the named style, not a distinct Dark colour.
