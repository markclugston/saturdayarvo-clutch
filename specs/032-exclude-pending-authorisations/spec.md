# Feature Specification: Exclude Pending Authorisations From Imports

**Feature Branch**: `032-exclude-pending-authorisations`

**Created**: 2026-11-28

**Status**: Draft

**Input**: User description: "when importing transactions exclude transactions that share the same balance as the prior transaction while having either a credit or debit amount.  if there is no balance being imported then exclude transactions that have a description that contains "AUTHORISATION ONLY".  these transactions are likely authorizations and have not been debited as yet. on the preview screen show these transactions, however highlight they will not be imported."

## Clarifications

### Session 2026-11-28

- Q: When some rows are excluded, what should the preview's "{N} transactions will be imported into this account" sentence count? → A: Only the rows that will be imported.
- Change requested during implementation: for files without balances, match descriptions against the authorisation patterns in FR-002 instead of the single phrase "AUTHORISATION ONLY".
- Correction from user testing: a bank can list a pending authorisation among later dated rows, and it must still be excluded. "Prior" therefore follows the file's running order, not the row dates.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Skip Authorisations In A File With Balances (Priority: P1)

A user imports a bank file that includes balances. Rows whose amount did not change the balance (same balance as the prior transaction) are pending authorisations, so they are left out of the import.

**Why this priority**: Importing authorisations creates transactions that were never debited, corrupting account totals.

**Independent Test**: Import a file with balances where one row repeats the prior row's balance with a non-zero amount; confirm it is not saved and all other valid rows are.

**Acceptance Scenarios**:

1. **Given** a file with balances where a row with a non-zero amount has the same balance as the prior row, **When** the user confirms the import, **Then** that row is not saved and every other valid row is.
2. **Given** a file with balances where a row's description matches an authorisation pattern but its balance differs from the prior row's, **When** the user confirms the import, **Then** that row is saved (the description rule does not apply when balances are imported).

---

### User Story 2 - Skip Authorisations In A File Without Balances (Priority: P1)

A user imports a bank file with no balances. Rows whose description matches an authorisation pattern (FR-002) are left out of the import.

**Why this priority**: Files without balances have no other signal for authorisations.

**Independent Test**: Import a file without balances containing a row that matches an authorisation pattern; confirm it is not saved.

**Acceptance Scenarios**:

1. **Given** a file without balances and a row whose description matches any pattern in FR-002 in any letter case, **When** the user confirms the import, **Then** that row is not saved and every other valid row is.
2. **Given** a file without balances and a row where the matched letters are only part of a longer word (for example "AUTHORITY" or "AUTHENTIC"), **When** the user confirms the import, **Then** that row is saved.

---

### User Story 3 - See Excluded Rows On The Preview (Priority: P1)

On the import preview, excluded rows still appear in the list, highlighted with a clear indication that they will not be imported.

**Why this priority**: The user must be able to see and trust what will and will not be imported before confirming.

**Independent Test**: Load a preview containing an excluded row; confirm the row is shown, highlighted, and marked as not being imported.

**Acceptance Scenarios**:

1. **Given** a preview containing excluded rows, **When** the preview is shown, **Then** each excluded row appears in its usual position, highlighted, with a "Will Not Be Imported" indication readable by assistive technology.
2. **Given** a preview with no excluded rows, **When** the preview is shown, **Then** no row carries the indication.
3. **Given** a preview of 5 rows of which 2 are excluded, **When** the preview is shown, **Then** it states that 3 transactions will be imported.

### Edge Cases

- The first row in the file's running order has no prior transaction → never excluded by the balance rule.
- A row dated earlier than the rows around it → still compared with the prior row in the file's running order.
- A row with a zero amount and the same balance as the prior row → not excluded (it has neither a credit nor a debit amount).
- A row with no balance in a file that otherwise has balances, or whose prior row has no balance → not excluded by the balance rule, and the description rule does not apply.
- Consecutive authorisations → each is compared with the row immediately before it, so all are excluded.
- An excluded row that would also be a possible duplicate → it is not imported, so it does not require duplicate confirmation.
- Every row is excluded → the preview states that 0 transactions will be imported; confirming saves no transactions.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When the import includes balances, the system MUST exclude every row with a non-zero amount whose balance equals the balance of the prior row in the file's running order.
- **FR-002**: When the import includes no balances, the system MUST exclude every row whose description matches any of these patterns, ignoring letter case (`\b` is a word boundary, `[- ]?` an optional hyphen or space):
  - `\bAUTH\b`
  - `\bAUTHORI[ZS]ATION\b`
  - `\bPRE[- ]?AUTH\b`
  - `\bPRE[- ]?AUTHORI[ZS]ATION\b`
  - `\bAUTH[- ]?ONLY\b`
  - `\bAUTH[- ]?HOLD\b`
  - `\bPENDING[- ]?AUTH\b`
  - `\bOPEN[- ]?AUTH\b`
  - `\bUNCAPTURED[- ]?AUTH\b`
  - `\bCARD[- ]?VERIFICATION\b`
  - `\bZERO[- ]?(DOLLAR|AMOUNT|VALUE)[- ]?AUTH\b`
- **FR-003**: Exactly one rule applies per import: FR-001 when the import includes balances, otherwise FR-002.
- **FR-004**: Confirming an import MUST NOT save excluded rows, and MUST save the remaining valid rows as it does today.
- **FR-005**: The preview MUST show excluded rows in their usual position, highlighted and marked "Will Not Be Imported".
- **FR-006**: Excluded rows MUST NOT count towards possible-duplicate confirmation.
- **FR-007**: The server MUST decide exclusion; the preview displays the server's decision.
- **FR-008**: The preview's count of transactions that will be imported MUST count only rows that are not excluded.

### Key Entities *(include if feature involves data)*

- **Import Review Row**: a previewed row; gains whether it will be excluded from the import.

### Constitution Scope

Tick each that applies, so plan can pick requirement IDs without rereading the spec:

- [x] Stores, changes or deletes data (DOT-002, OPS-001 migrations)
- [ ] Creates or reads audit records (AUD-001)
- [x] Adds or changes endpoints, auth or input handling (SEC-001, SEC-004)
- [x] Handles personal, payment or financial data (SEC-003)
- [x] Changes UI in clutch-web (WEB-001, style guide)

## Success Criteria *(mandatory)*

- **SC-001**: 100% of rows meeting FR-001 or FR-002 are absent from the account after confirmation, and 100% of other valid rows are present.
- **SC-002**: 100% of excluded rows are visible and marked on the preview before confirmation.
- **SC-003**: A user can tell which rows will not be imported from the preview alone, without opening any other screen.

## Out Of Scope

- None

## Assumptions

- "Prior transaction" means the adjacent row in the file's running order: the row below in a newest-first file, the row above in an oldest-first file, whatever their dates. File direction uses the existing rules (`src/Clutch.API/Domain/Imports/ImportOrdering.cs`).
- "Includes balances" means the import's mapping provides a balance; rows without a balance value are handled per Edge Cases.
- Exclusion is automatic; the user cannot override it on the preview (not requested).
- Existing import behaviour (review lifecycle, duplicate detection, validation, ownership, ordering, error format) is settled (`src/Clutch.API/Application/Imports/`).
- The preview list keeps the list standard (`clutch-ui-style` §12); the highlight follows the existing possible-duplicate highlight pattern in `src/clutch-web/src/features/imports/ImportReviewTable.tsx`.
