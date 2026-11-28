# Feature Specification: Align Existing Lists

**Feature Branch**: `031-align-lists`

**Created**: 2026-11-28

**Status**: Draft

**Input**: User description: "Align existing lists with the list standard", with these decisions given on 2026-11-28: align the account transactions list and its delete dialog, the asset valuations list and the import review list; rebuild the amortization schedule and the Interest Rates dialog list as tables; leave Categories and Your Accounts as they are (approved differences); extract a shared list component from the Assets list.

In this document the **list standard** is `clutch-ui-style` §12, whose reference is the **Assets list**.

## Clarifications

### Session 2026-11-28

- Q: Should Your Accounts become a table? → A: No. "the account table should stay as is. its not a list in the same way as the others. just like categories is different." and "dont change accounts".

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Account Transactions Match the Assets List (Priority: P1)

The user views and deletes transactions in a list that looks and behaves like the Assets list.

**Why this priority**: It is the most used of the lists being aligned.

**Independent Test**: Open an account, view its loading, empty, failed and filled list, and delete a transaction.

**Acceptance Scenarios**:

1. **Given** a transaction with a long description, **When** the list is shown, **Then** the description is on one line, cut short, and its full text is available.
2. **Given** a transaction row, **When** the user selects its delete button and confirms, **Then** the transaction is deleted, the list updates and a message names what was deleted.
3. **Given** the list cannot be loaded, **When** the user selects "Retry", **Then** it is loaded again.

---

### User Story 2 - Asset Valuations Scroll Like the Assets List (Priority: P2)

A long valuations list keeps its title and column header in view while its rows scroll.

**Why this priority**: Long valuation histories lose their header today.

**Independent Test**: Open an asset with more valuations than fit on screen and scroll to the end.

**Acceptance Scenarios**:

1. **Given** a Valuations group taller than the content area, **When** the user scrolls, **Then** the group stops near the top, its rows move under a header that stays put, and the buttons after the group can then be reached.
2. **Given** a stopped group, **When** the user removes a row, **Then** it is removed at once and focus moves to "Add Valuation".

---

### User Story 3 - Import Review Matches the Assets List (Priority: P3)

The user reviews a long import with the column header in view.

**Why this priority**: Imports are often long, but are reviewed once.

**Independent Test**: Review an import with more rows than fit on screen, with and without possible duplicates.

**Acceptance Scenarios**:

1. **Given** a long review, **When** the user scrolls, **Then** it stops and scrolls as the Assets list does, and the controls after it can then be reached.
2. **Given** a row with no warning, **When** it is shown, **Then** its Warning cell is empty.

---

### User Story 4 - Amortization Schedule Is a Standard Table (Priority: P4)

The schedule is presented as a table, and balance loading and failure look like other lists.

**Why this priority**: It already scrolls correctly; the gap is structure and states.

**Independent Test**: Show a long schedule with an account selected, while balances load, fail and succeed.

**Acceptance Scenarios**:

1. **Given** balances are loading, **When** the schedule is shown, **Then** a spinner with a loading message is visible and the schedule rows remain.
2. **Given** balances failed to load, **When** the user selects "Retry", **Then** they are loaded again and the columns fill on success.
3. **Given** the longest duration allowed, **When** the user scrolls to the end, **Then** every period is reachable and the schedule stays responsive.

---

### User Story 5 - Interest Rate Changes Are a Standard Table (Priority: P5)

In the Interest Rates dialog the changes are a table styled like the Assets list, below the add inputs.

**Why this priority**: The list is short and used rarely.

**Independent Test**: Open the dialog with many changes, scroll, edit the opening rate and remove a change.

**Acceptance Scenarios**:

1. **Given** more changes than fit, **When** the user scrolls the list, **Then** the column header and the add inputs stay in view.
2. **Given** a change that can be removed, **When** the user selects its red trash button, **Then** it leaves the list and focus moves to the dialog as today.

### Edge Cases

- A list that fits on screen → it looks and scrolls normally.
- Content area too short for title, header and a few rows → the page scrolls normally.
- A table wider than its group → it scrolls sideways within the group, header aligned.
- A transaction already deleted → the dialog says so, offers "Close" and the list updates.
- Two transactions with the same description and date → both delete buttons share a name; each still deletes only its own row.
- Balances fail while rows are scrolled → the message and "Retry" are shown without losing the schedule.
- Row errors on a valuation or rate change → shown in that row as today.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The five lists in scope and the Assets list MUST share one list implementation, taken from the Assets list and kept with the shared UI components.
- **FR-002**: The Assets list MUST look and behave as it does today.
- **FR-003**: Each list in scope MUST meet the list standard for structure, caption, column header, row lines, cells, scrolling, row buttons and empty state, except as FR-012 states.
- **FR-004**: Transaction descriptions MUST show on one line, cut short with the full text available; dates, amounts and balances MUST NOT wrap.
- **FR-005**: Each transaction delete button MUST be named "Delete {description}, {date}".
- **FR-006**: The transactions list MUST show a spinner with "Loading transactions…", a load failure message with "Retry", and when empty "No transactions yet. Import transactions to see them here." Its title and "Load More" behaviour are unchanged.
- **FR-007**: The delete confirmation MUST be titled "Delete Transaction", say "This permanently deletes “{description}”. This cannot be undone.", match the Assets dialog's layout, show "Deleting…" at once with both buttons disabled, show failures in the dialog, offer "Close" for a transaction already gone, and on success close, update the list and say "{description} was deleted."
- **FR-008**: The valuations list MUST stop and scroll as the Assets list does; its empty message MUST read "No valuations yet. Add a valuation to record what this asset is worth." Ordering, adding, removing and error messages are unchanged.
- **FR-009**: The import review list MUST stop and scroll as the Assets list does, cut long descriptions short with the full text available, and leave the Warning cell empty when there is no warning. The duplicate notice and chip are unchanged.
- **FR-010**: The amortization schedule MUST be a table with a caption; its columns, values, "Not yet calculated" text, scrolling, empty message and usability at the longest duration are unchanged.
- **FR-011**: While balances load, the schedule MUST show a spinner with "Loading account balances…"; when they fail, it MUST show the failure message with "Retry". Schedule rows remain visible in both.
- **FR-012**: The interest rate changes MUST be a table (Interest Rate, Effective Date, Actions) in date order that scrolls within the dialog below the add inputs, with its header held. It does not stop and scroll with the page (approved by the user's choice of "Table styled like Assets, still scrolling below the add inputs").
- **FR-013**: Each rate change MUST have a red trash button keeping its name "Remove {rate} from {date}". The editable opening rate, the disabled removal with its hint, row messages and focus after removal are unchanged. The empty message MUST read "No interest rate changes yet. Add a rate above."
- **FR-014**: The list standard MUST record Categories and Your Accounts as approved differences, with the user's words and date, record the FR-012 difference, drop aligned lists from its existing differences and point to the shared implementation.

### Constitution Scope

- [ ] Stores, changes or deletes data (DOT-002, OPS-001 migrations)
- [ ] Creates or reads audit records (AUD-001)
- [ ] Adds or changes endpoints, auth or input handling (SEC-001, SEC-004)
- [x] Handles personal, payment or financial data (SEC-003) — display only
- [x] Changes UI in clutch-web (WEB-001, style guide)

## Success Criteria *(mandatory)*

- **SC-001**: No list differs from the list standard unless the user's approval of that difference is recorded.
- **SC-002**: In every list in scope, 100% of rows can be reached and the column header stays visible while they move.
- **SC-003**: The Assets list passes its existing tests and looks unchanged in light and dark themes.
- **SC-004**: All lists in scope pass the accessibility and style-guide checks in light and dark themes.

## Out Of Scope

- The Your Accounts page: no change.
- The Categories page: no change.

## Assumptions

- A transaction is identified to the user by its description and date.
- "Not yet calculated" is schedule content, not a missing optional value.
- Removing a rate change or valuation edits an unsaved form, so neither needs confirmation.
- Server behaviour, data loading, formatting and theme tokens are settled in the code (`docs/code-map.md`).
