# Feature Specification: Optional Transaction Balance Field

**Feature Branch**: `agents/add-optional-balance-field-config`

**Created**: 2026-11-10

**Status**: Draft

**Input**: User description: "in transactions add an extra optional field for the balance. there needs to be a new optional configuration point for the import to specify which field the balance is in. this is not a calculated field. this configuration is to be saved along with all the other import config fields. when displaying the list of transactions the balance is to show on the right of the amount column as the right most column."

## Clarifications

### Session 2026-11-10

- Q: Should the balance column always appear in the transaction list, or only when at least one listed transaction has a balance? → A: Show only if any listed transaction has a balance.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Import running balance from a CSV (Priority: P1)

A user whose bank CSV export contains a running balance column chooses, in the import settings, which field holds the balance. When the import completes, each imported transaction stores the balance value from the file exactly as supplied.

**Why this priority**: Capturing the bank-supplied balance is the core of the feature.

**Independent Test**: Import a CSV that contains a balance column with the balance field mapped, then verify each imported transaction holds the balance value from its row.

**Acceptance Scenarios**:

1. **Given** the import settings, **When** the user views the field mappings, **Then** an optional "balance" field mapping is offered alongside the existing mappings and may be left unset.
2. **Given** a balance field is mapped, **When** the import completes, **Then** each transaction stores the balance value read from its row of the file.
3. **Given** a balance field is mapped, **When** a row has an empty balance value, **Then** that transaction is imported with no balance and is not rejected.
4. **Given** a balance field is mapped, **When** a row has a balance value that is not a valid number, **Then** the import is rejected with an error naming the row and the balance field, in the same way as other invalid values.
5. **Given** no balance field is mapped, **When** the user imports a file, **Then** the import behaves exactly as before and transactions have no balance.
6. **Given** a balance field is mapped, **When** transactions are imported, **Then** the balance is never calculated or derived from other transactions; it is only the value supplied in the file.

---

### User Story 2 - Balance mapping saved with import settings (Priority: P1)

The balance field mapping is saved and reused with all other saved import settings for the account.

**Why this priority**: Users should not have to re-select the balance field on every import.

**Independent Test**: Successfully import with a balance mapping, start another import for the same account, and verify the balance mapping is applied by default and shown when settings are opened.

**Acceptance Scenarios**:

1. **Given** a successful import used a balance mapping, **When** the user later starts an import for the same account, **Then** the balance mapping is applied by default along with the other saved settings.
2. **Given** saved settings exist, **When** the user opens the settings, **Then** the current balance mapping is shown and can be changed or cleared.
3. **Given** settings saved before this feature existed, **When** the user starts an import, **Then** they load normally with no balance mapping.
4. **Given** the user changes or cancels the balance mapping and the import does not succeed, **Then** the previously saved settings remain unchanged.

---

### User Story 3 - See balance in the transaction list (Priority: P2)

When viewing the list of transactions, the user sees each transaction's balance in a column to the right of the amount column, as the right-most column.

**Why this priority**: Displaying the balance gives the imported data its value, but depends on the data being captured first.

**Independent Test**: View a list containing transactions with and without balances and verify the balance column is the right-most column, immediately after the amount column.

**Acceptance Scenarios**:

1. **Given** transactions with balances, **When** the user views the transaction list, **Then** a balance column appears directly to the right of the amount column as the right-most column.
2. **Given** a transaction has no balance, **When** the list is shown alongside others that have balances, **Then** its balance cell is blank.
4. **Given** none of the listed transactions has a balance, **When** the list is shown, **Then** no balance column is displayed.
3. **Given** the list is displayed, **Then** balances are formatted consistently with amounts and aligned like the amount column.

---

### Edge Cases

- Balance column mapped to the same file field as another mapping (e.g. amount): handled by the existing mapping validation rules for duplicate field use.
- Balance values that are negative (overdrawn accounts) are accepted and shown with their sign.
- Balance values using the configured number formatting (thousands separators, optional currency code) are parsed using the same rules as amounts.
- A mapped balance field is missing from a later file: reported through the existing "settings need attention" flow.
- Duplicate detection of transactions is not affected by the balance value.
- Existing transactions imported before this feature have no balance and show a blank balance.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each transaction MUST support an optional balance value.
- **FR-002**: The import settings MUST offer an optional configuration point to specify which file field contains the balance; leaving it unset MUST be valid.
- **FR-003**: When a balance field is mapped, the system MUST store the balance exactly as supplied in the file for each transaction and MUST NOT calculate it.
- **FR-004**: Empty balance values MUST result in a transaction with no balance without rejecting the row; non-numeric values MUST be flagged by the existing validation flow.
- **FR-005**: The balance mapping MUST be saved, loaded, displayed, and replaced together with all other saved import settings under the same rules (most recent successful import wins, per account, available across devices).
- **FR-006**: Previously saved settings without a balance mapping MUST continue to work unchanged.
- **FR-007**: When at least one listed transaction has a balance, the transaction list MUST display the balance in a column immediately right of the amount column, as the right-most column; when none do, the column MUST be omitted.
- **FR-008**: Transactions without a balance MUST show a blank balance cell when the balance column is displayed.
- **FR-009**: Imports without a balance mapping MUST behave exactly as before this feature.

### Key Entities

- **Transaction**: An existing record gaining an optional balance value as supplied by the bank.
- **Import Settings**: The saved per-account import configuration, gaining an optional mapping to the balance field.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a file with a mapped balance column, 100% of rows with a valid balance value are imported with that exact balance.
- **SC-002**: Importing a file without a balance mapping produces identical results to the behavior before this feature.
- **SC-003**: After one successful import with a balance mapping, 100% of subsequent imports for that account apply the mapping without user action.
- **SC-004**: In 100% of transaction list views containing at least one balance, the balance column is the right-most column and directly follows the amount column.

## Assumptions

- Builds on specs 001 (import bank transactions) and 002 (save import settings); the balance mapping follows the same mapping and number-format rules as the amount field.
- The balance is informational only and is not used for validation, reconciliation, or duplicate detection.
- The balance column applies to all transaction lists that show amounts.
- Numeric format for balance values reuses the existing import number-format settings.
- The new balance selector and list column follow the existing light/dark theme tokens, keyboard access and WCAG 2.2 AA requirements; no theme persistence changes.
