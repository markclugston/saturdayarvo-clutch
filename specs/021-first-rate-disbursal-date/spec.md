# Feature Specification: First Interest Rate Uses Disbursal Date

**Feature Branch**: `021-first-rate-disbursal-date`

**Created**: 2026-11-22

**Status**: Draft

**Input**: User description: "when starting a mortgage, the first interest rate entered have a date the same as the disbursal date.  disable the date field for that interest rate and prefill it with the disbursal date.  don't allow entering an interest rate (disable the button) until the disbursal date is entered."

<!--
  Builds on 017-interest-rate-modal. Validation limits, saving, versioning, auditing and the
  unsaved-changes prompt are unchanged; only how the first (opening) rate's date is set changes.
-->

## Clarifications

### Session 2026-11-22

- Q: When the Disbursal Date is cleared after interest rates have been added, what should happen? → A: It cannot be cleared or edited while interest rates exist; they must be deleted first.
- Q: If the user deletes the opening rate while later rate changes still exist, what should happen? → A: Not allowed; the opening rate cannot be deleted while other rates exist, but its rate value can be changed.
- Q: Should "always disabled" cover only the opening rate's own date, leaving Effective Date editable for later rates? → A: Yes. The opening rate is the first interest rate entered; its date is always the Disbursal Date and can never be changed, in the add input or on its row. Later rates' dates stay editable when they are added.
- Q: What should happen to an existing saved mortgage whose first rate's Effective Date differs from its Disbursal Date? → A: This state cannot exist; the rule is enforced so the two always match, and no handling is needed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Opening rate takes the disbursal date (Priority: P1)

As a signed-in user starting a mortgage, when I add the first interest rate in Interest Rates, its Effective Date is the Disbursal Date, shown prefilled and not editable.

**Why this priority**: The opening rate always starts on the disbursal date; typing it again invites a mismatch.

**Independent Test**: On a new mortgage enter a Disbursal Date, open Interest Rates, and confirm the Effective Date is prefilled with it and disabled; add a rate and confirm it is listed as the Opening Rate on that date.

**Acceptance Scenarios**:

1. **Given** a Disbursal Date is entered and no interest rate changes exist, **When** the user opens Interest Rates, **Then** Effective Date shows the Disbursal Date and is disabled.
2. **Given** that state, **When** the user enters a New Interest Rate and selects Add, **Then** the rate is added with the Disbursal Date as its Effective Date and listed as the Opening Rate.
3. **Given** at least one interest rate change exists, **When** the user opens Interest Rates, **Then** Effective Date is empty and editable for the next rate.
4. **Given** the opening rate was the only change and it was removed, so no changes remain, **When** the user views the add inputs, **Then** Effective Date is again prefilled with the Disbursal Date and disabled.
5. **Given** the Opening Rate and at least one later change exist, **When** the user views the Opening Rate, **Then** its delete control is disabled with a hint, and its rate value can still be edited.
6. **Given** the Opening Rate's rate value is being edited, **When** the user enters a value that fails the New Interest Rate validation (empty, not a number, or outside the allowed range), **Then** the edit is rejected, the same error message New Interest Rate shows for that value is displayed on that row, and the previous rate is kept.

---

### User Story 2 - Add is unavailable until the disbursal date is entered (Priority: P1)

As a signed-in user, I cannot enter an interest rate until the Disbursal Date is entered.

**Why this priority**: The opening rate's date depends on it.

**Independent Test**: On a new mortgage with an empty Disbursal Date, open Interest Rates and confirm the rate input, date field and Add button are disabled with a hint; enter the date and confirm they become available.

**Acceptance Scenarios**:

1. **Given** the Disbursal Date is empty, **When** the user opens Interest Rates, **Then** the New Interest Rate input, Effective Date and Add button are disabled and the hint "Enter the disbursal date first" is shown.
2. **Given** the Disbursal Date is empty, **When** the user enters a Disbursal Date, **Then** adding becomes available, subject to the existing Duration and Payment Frequency requirements.

### User Story 3 - Clear line item titles and layout (Priority: P2)

As a signed-in user, I can tell the opening rate from later changes at a glance in the Interest Rates dialog.

**Why this priority**: Presentation only; behaviour is unchanged.

**Independent Test**: Open Interest Rates on a mortgage with an opening rate and a later change and read each line item's title and layout.

**Acceptance Scenarios**:

1. **Given** the Opening Rate row, **When** it is shown, **Then** its single title, above the rate, reads "Opening Interest Rate" and no other "Opening Rate" text appears on the row.
2. **Given** any later interest rate change row, **When** it is shown, **Then** its title above the rate reads "Interest Rate Change".
3. **Given** any row, **When** it is shown, **Then** the rate and the date start at the row's left edge, with the rate left aligned and clear space between the title and the rate and date.

### Edge Cases

- Disbursal Date cleared or changed while interest rate changes exist - not possible; the Disbursal Date is disabled until all interest rate changes are deleted.
- Attempt to change the Opening Rate's date - not possible; it is always the Disbursal Date and is never editable.
- Opening rate delete attempted while later changes exist - not possible; its delete control is disabled with a hint, and its rate value can still be changed. It can be deleted only once it is the sole remaining change.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST disable the New Interest Rate input, Effective Date and Add button in Interest Rates while the Disbursal Date is empty, with the hint "Enter the disbursal date first". This hint takes precedence over any other missing-header hint, even when Duration or Payment Frequency is also missing.
- **FR-002**: When no interest rate changes exist, System MUST prefill Effective Date with the Disbursal Date and disable it.
- **FR-003**: System MUST add the first interest rate with the Disbursal Date as its Effective Date.
- **FR-004**: When at least one interest rate change exists, System MUST leave Effective Date editable and empty for the next rate.
- **FR-005**: System MUST disable the Disbursal Date field, with the hint "Delete all interest rate changes to edit the disbursal date", while any interest rate change exists, so the opening rate's Effective Date always equals the Disbursal Date. The user must delete all interest rate changes before the Disbursal Date can be edited or cleared.
- **FR-006**: System MUST keep the existing requirements for adding (valid Duration and Payment Frequency, maximum number of changes) and the Opening Rate row (FR-010).
- **FR-007**: System MUST NOT allow the Opening Rate to be deleted while any other interest rate change exists, with a hint explaining why. The hint reads "Delete the other interest rate changes first". The Opening Rate's rate value MUST remain editable on its row, using the same validation as New Interest Rate, with errors shown on that row and the previous rate kept when invalid; its Effective Date stays the Disbursal Date.
- **FR-008**: The Opening Rate is the first interest rate entered. Its Effective Date MUST always equal the Disbursal Date and MUST NOT be editable anywhere (the add input is prefilled and disabled, and no date edit is offered on its row). Only rates added after it have an editable Effective Date.

- **FR-009**: The button that opens the interest rate dialog and the dialog's title MUST both read "Interest Rates".
- **FR-010**: The Opening Rate row MUST show one title, "Opening Interest Rate", above its rate (also its accessible name) and no other Opening Rate label. Every other row MUST show the title "Interest Rate Change" above its rate.
- **FR-011**: Within a row the rate and date MUST start at the row's left edge, the rate left aligned, with clear space between the title and the rate and date.
- **FR-012**: When the message "Add the opening interest rate, effective on the disbursal date" is showing, adding an opening interest rate MUST remove it, in the dialog and beside Save, without waiting for the next Save.

### Constitution Scope

- [ ] Stores, changes or deletes data (DOT-002, OPS-001 migrations)
- [ ] Creates or reads audit records (AUD-001)
- [ ] Adds or changes endpoints, auth or input handling (SEC-001)
- [ ] Handles personal, payment or financial data (SEC-003)
- [x] Changes UI in clutch-web (WEB-001, style guide)

## Success Criteria *(mandatory)*

- **SC-001**: 100% of first interest rates added to a mortgage have an Effective Date equal to its Disbursal Date, with no date typing.
- **SC-002**: A user cannot add an interest rate on a mortgage with no Disbursal Date.

## Assumptions

- "First interest rate" means the first rate added when the mortgage has no interest rate changes; it is the existing Opening Rate.
- The existing Duration and Payment Frequency requirement for adding stays; the Disbursal Date is the minimum needed.
- An opening rate whose date differs from the Disbursal Date is an impossible state, so no migration or mismatch handling is needed.
- The Disbursal Date is locked while rates exist (FR-005), so the opening rate never needs to follow later edits and the two never differ.
