# Feature Specification: Mortgage Account Balance Column

**Feature Branch**: `020-mortgage-account-balance-column`

**Created**: 2026-11-22

**Status**: Draft

**Input**: User description: "on the mortgages Details group.  Add a drop listing all the accounts with a label of "Mortgage Account".  This is optional however when selected put a column to the right of Bank Schedule in the Amortization Schedule.  In this column show the balance from the account for every period (end of period).  This might require looking back to the last transaction in that period and using that balance.  keep in mind periods can be different durations.  if the details section isn't filled out yet, then use the start of the account as the first period and show the balance at the end of the first month.  then continue showing monthly balances their after."

<!--
  Builds on 016-mortgage-tracking (Details group, Amortization Schedule) and 008-transaction-balance-field
  (imported transactions can carry a running balance). Accounts currently have no label concept (see FR-001).
-->

## Clarifications

### Session 2026-11-22

- Q: Accounts have no "label" today. How does an account get the label "Mortgage Account"? → A: It does not. "Mortgage Account" is the fixed field label of the drop-down, not a stored or user-entered account label. Accounts are unchanged.
- Q: Which accounts does the "Mortgage Account" drop-down list? → A: All of the user's own accounts, alphabetical by description.
- Q: When are mortgage Details "incomplete" for the monthly fallback? → A: Whenever the mortgage's own Amortization Schedule cannot be generated because a field it requires is missing.
- Q: For periods that end after the account's most recent transaction, should the balance be blank or repeat the last known balance? → A: Blank only for periods that start after the latest balance-bearing transaction date; the period containing it shows that balance; balances are never carried forward past that transaction's period (periods before it still use the most recent earlier balance, per FR-005).
- Q: In the monthly fallback view, which columns are shown besides the account balance? → A: The full column set; every cell the mortgage's own schedule would calculate is blank, plus the account balance column.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Link a mortgage to its account (Priority: P1)

As a signed-in user, I optionally pick, in a mortgage's Details group, which of my accounts, in a drop-down labelled "Mortgage Account", holds that mortgage, and the choice is saved with the mortgage.

**Why this priority**: The selection is what the balance column depends on.

**Independent Test**: Open a mortgage, pick an account in the "Mortgage Account" drop-down, save, reload and confirm the pick is kept; clear it and confirm it is empty after save.

**Acceptance Scenarios**:

1. **Given** the user has accounts, **When** the user opens the Details group, **Then** an optional drop-down labelled "Mortgage Account" lists all of the user's accounts alphabetically by description, with an empty "None" choice.
2. **Given** the user has no accounts, **When** the user opens the Details group, **Then** the drop-down offers only the "None" choice.
3. **Given** an account is chosen and the mortgage saved, **When** the user returns to it later, **Then** the same account is selected.
4. **Given** a chosen account, **When** the user selects none and saves, **Then** the link is removed and no balance column is shown.
5. **Given** a linked account that is later deleted, **When** the mortgage is shown, **Then** it behaves as having no account and saving is not blocked.

---

### User Story 2 - See account balance per period (Priority: P1)

As a signed-in user with a linked account, I see a balance column to the right of Bank Schedule in the Amortization Schedule, showing the account's balance at the end of each period.

**Why this priority**: This is the feature's purpose: compare the bank schedule with the real balance.

**Independent Test**: Link an account with imported transactions carrying balances and confirm each period shows the balance of the last transaction on or before that period's end.

**Acceptance Scenarios**:

1. **Given** a linked account, **When** the schedule is shown, **Then** a column to the right of Bank Schedule shows one balance per period.
2. **Given** a period containing transactions, **When** the balance is shown, **Then** it is the balance of the last balance-bearing transaction dated within that period.
3. **Given** a period with no balance-bearing transactions, **When** the balance is shown, **Then** it is the balance of the most recent earlier balance-bearing transaction.
4. **Given** periods of different lengths (weekly, fortnightly, monthly or irregular), **When** balances are shown, **Then** each uses its own period end.
5. **Given** a period ending before the account's first transaction, **When** the balance is shown, **Then** the cell is blank.
6. **Given** a period starting after the account's latest balance-bearing transaction, **When** the balance is shown, **Then** the cell is blank (future periods are not filled); the period containing that transaction still shows its balance.
7. **Given** no linked account, **When** the schedule is shown, **Then** no balance column is shown.

---

### User Story 3 - Monthly balances before details are complete (Priority: P2)

As a user who has linked an account but not yet completed the loan details, I still see monthly balances starting from the account's first balance-bearing transaction.

**Why this priority**: Gives value before the mortgage is fully set up.

**Independent Test**: On a new, unsaved mortgage with incomplete Details, pick an account and confirm monthly rows begin at the account's first balance-bearing transaction.

**Acceptance Scenarios**:

1. **Given** a linked account and Details not yet filled in, **When** the schedule is shown, **Then** period 1 starts at the date of the account's first balance-bearing transaction and shows the balance at the end of that first month, and each following row is one further month; all columns other than the period and the account balance are blank.
2. **Given** that fallback view, **When** the Details are completed and saved, **Then** the schedule switches to the mortgage's own periods.

### Edge Cases

- Transactions without a balance value are skipped; the last transaction with a balance is used.
- Several transactions on the same day: the last one in the account's transaction order is used. That order is the Transactions list order (date, then transaction Id), so the balance agrees with the account screen.
- The account has no transactions with balances: the column shows blank cells; in the monthly fallback there are no rows and the enter-details prompt is shown.
- Fallback monthly rows continue to the month of the account's latest balance-bearing transaction, no later. The final month shows the balance of that transaction.
- Balances fail to load: the schedule still shows, the column is blank and a generic message is shown.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Accounts MUST NOT gain any label or flag for this feature; "Mortgage Account" is only the fixed label of the drop-down.
- **FR-002**: The Details group MUST include an optional drop-down labelled "Mortgage Account" listing all of the user's accounts, showing each account's description, in alphabetical order (case-insensitive; accounts with equal descriptions keep the order the accounts list returns them), plus a "None" choice listed first.
- **FR-003**: The chosen account MUST be saved and loaded with the mortgage, following existing save, conflict and cancel behaviour.
- **FR-004**: With an account chosen, the Amortization Schedule MUST show a column immediately right of Bank Schedule, headed with the account's description followed by " Balance" (e.g. "Offset Account Balance"); without one, no column.
- **FR-005**: Each cell MUST show the account balance at the end of that period: the balance of the last balance-bearing transaction dated on or before the period's last day.
- **FR-005a**: A period whose first day is after the date of the account's latest balance-bearing transaction MUST show a blank cell; the period containing that transaction shows its balance, and a balance MUST NOT be carried forward into any period that starts after that transaction's date. Within and before that range, FR-005 applies (a period with no balance-bearing transaction shows the most recent earlier balance).
- **FR-005b**: The column MUST start out positive. If the account's first non-zero balance is negative (a debt stored as a negative balance), every balance in the column has its sign inverted; the column shows a negative value only when the balance crosses zero.
- **FR-006**: A period's end MUST be the day before the next period starts, so unequal period lengths are handled. Period 1 starts on the Drawdown date and ends one payment interval later (the day before the next period starts); each later period starts one further interval on; the final row is the single day the mortgage's last interval ends, so it is a single-day period.
- **FR-007**: A period ending before the account's first balance-bearing transaction MUST show a blank cell.
- **FR-008**: When mortgage Details are incomplete (any field the mortgage's own schedule requires is missing, so it cannot be generated), the schedule MUST use monthly periods starting at the date of the account's first balance-bearing transaction; period 1 shows the balance at the end of the first month. Each following period starts on the same day of the month as period 1 (clamped to the month's last day when the month is shorter), and rows continue to the month containing the account's latest balance-bearing transaction, no later. The fallback view MUST show the full schedule column set with every cell left blank except the Period number and the account balance (this includes Date and Bank Schedule, and anything else the mortgage's own schedule would compute).
- **FR-009**: Balances MUST be formatted in the account's currency, like other schedule amounts, and be read-only.
- **FR-010**: Users MUST only see their own accounts and balances.
- **FR-011**: Displayed balances MUST reflect the account's current transactions: after a transaction import or a transaction delete, the schedule MUST show updated balances without a manual page reload.

### Key Entities *(include if feature involves data)*

- **Account**: Unchanged; any of the user's accounts can be linked.
- **Mortgage**: Gains an optional link to one account.
- **Period balance**: Derived, not stored: the account balance at a period's end.

### Constitution Scope

- [x] Stores, changes or deletes data (DOT-002, OPS-001 migrations)
- [x] Creates or reads audit records (AUD-001): unchanged; the existing mortgage create and update audit rows are still written when a link is saved, with no account or balance data in their text
- [x] Adds or changes endpoints, auth or input handling (SEC-001)
- [x] Handles personal, payment or financial data (SEC-003)
- [x] Changes UI in clutch-web (WEB-001, style guide)

## Success Criteria *(mandatory)*

- **SC-001**: After the user chooses an account in the "Mortgage Account" drop-down, the schedule shows the balance column with a loading state within 500 ms and the balances once loaded, with no page reload.
- **SC-002**: For a test account, 100% of period balances equal the last recorded balance on or before each period end.
- **SC-003**: Mortgages without a linked account look and behave exactly as before.
- **SC-004**: For a 360-period mortgage linked to an account with 10,000 transactions, the balance endpoint responds in under 2 seconds on the test database.

## Assumptions

- Balances come from the optional balance field of imported transactions (008); none are calculated.
- Only one account can be linked per mortgage.
- Periods follow the mortgage's Drawdown date and Payment frequency once Details are complete.
- A saved mortgage always has complete Details (existing save validation is unchanged), so the monthly fallback (US3, FR-008) is only seen on a new, unsaved mortgage whose account is picked before the Details are complete. The schedule follows the drop-down's current selection, saved or not.
