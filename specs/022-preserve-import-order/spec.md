# Feature Specification: Preserve Import Order For Same-Date Transactions

**Feature Branch**: `022-preserve-import-order`

**Created**: 2026-11-23

**Status**: Draft

**Input**: User description: "on the transaction import sometimes there can be multiple transactions on the say date.  it is important that the order of these transactions the order maintained as the order they are in the import file."

<!--
  Builds on 001-import-bank-transactions (import, review, confirm) and 008-transaction-balance-field
  (per-transaction balance). Today transactions sharing a date are ordered by a random identifier,
  so their relative order is arbitrary in the Transactions list and in any "last balance of the day"
  lookup (e.g. the mortgage period balances). This feature makes that order follow the import file.
-->

## Clarifications

### Session 2026-11-23

- Q: Within a date, show rows latest-first or exactly top-to-bottom as in the file? → A: Latest first, matching the list's direction. This is not only a display issue: balances reconcile from one transaction to the next, so the order must be the true chronological order for all future calculations.
- Q: Direction for a file whose rows all share one date? → A: Newest first.
- Q: When the file has a Balance column, should balances decide the file's direction before dates? → A: Yes. Use the direction in which consecutive balances reconcile; fall back to dates when balances are absent or reconcile in neither or both directions; newest first if dates cannot decide.
- Q: Where do a later import's transactions go on a date that already has saved transactions? → A: Always after the saved ones, as more recent transactions, in the import's own file order (FR-003). Balance reconciliation is used only to order transactions within one import's data (to infer the file's direction), never to place them among saved transactions. (Revised: an earlier answer placed them where balances reconciled.)
- Q: Should transactions saved before this feature be reordered once from their balances? → A: Not applicable: the database was cleared, so no transactions exist before this feature; every transaction will have a sequence.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Same-Date Transactions Keep Their File Order (Priority: P1)

A user imports a bank file in which several transactions share a date; after confirming, the Transactions list shows those transactions in the chronological sequence the file defines (FR-003), latest first like the rest of the list (FR-004), every time the list is viewed.

**Why this priority**: The file's sequence is the only record of the order the bank processed same-day transactions. Each balance reconciles from the transaction before it, so a wrong order breaks the list and every calculation that depends on transaction order, now and in future.

**Independent Test**: Import a file with three or more transactions on one date whose balances only make sense in file order, then open the Transactions list and check their sequence and that it is unchanged after reloading and paging.

**Acceptance Scenarios**:

1. **Given** a file listing transactions A, B, C (in that order) on the same date, **When** the import is confirmed, **Then** the Transactions list shows A, B, C adjacent to each other in the order defined by FR-004.
2. **Given** confirmed same-date transactions, **When** the list is reloaded, paged or revisited later, **Then** their sequence is identical each time.
3. **Given** same-date transactions that straddle a page boundary of the Transactions list, **When** the next page is loaded, **Then** no transaction is repeated or skipped and the sequence continues unbroken.
4. **Given** saved transactions X, Y on a date, **When** a later import adds transactions P, Q on that date (P before Q in the import's FR-003 order), **Then** the chronological order is X, Y, P, Q, whatever the balances are.

---

### User Story 2 - The Day's Closing Balance Is The Chronologically Last Transaction (Priority: P2)

Wherever Clutch takes "the balance at the end of a day or period" from transactions (for example, the mortgage period balances), it uses the balance of the transaction that is chronologically last for that date (FR-003), whichever direction the file was in.

**Why this priority**: With an arbitrary same-day order, a period-end balance can come from a mid-day transaction and show a wrong figure.

**Independent Test**: Import a mortgage account file whose period ends on a date with several transactions; the period-end balance equals the balance on the chronologically last of them.

**Acceptance Scenarios**:

1. **Given** a period ending on a date with transactions whose balances are 1,000, 900 and 800 in chronological file order (the second and third each an outgoing 100, so they reconcile per FR-011), **When** the period balances are shown, **Then** that period shows 800.

---

### User Story 3 - The Review Screen Matches The File (Priority: P3)

Before confirming, the import review shows rows in the same order as the file, so what the user checks is what will be saved.

**Why this priority**: Supports trust in Story 1 but does not change saved data on its own.

**Independent Test**: Upload a file with same-date rows and check the review lists them in file order.

**Acceptance Scenarios**:

1. **Given** an uploaded file, **When** the review is shown, **Then** rows appear in file order, including rows flagged as possible duplicates.

---

### Edge Cases

- File lists newest first or oldest first → the direction is inferred per FR-012 (balances first, then dates) and same-date rows are sequenced accordingly (FR-003).
- Every row in the file has the same date → if balances reconcile in exactly one direction, that direction is used; otherwise the file is treated as newest first (the top row is the latest of the day).
- File has no Balance column, or its balances reconcile in neither direction (or in both, e.g. a single row) → the direction is taken from the dates.
- File whose dates are not consistently ascending or descending and whose balances do not decide the direction → the direction is taken from the first and last dates in the file, and rows within each date are sequenced from their file positions per FR-003 using that direction.
- Two imports both contain transactions on the same date (non-overlapping rows) → the later import's rows for that date go after the saved rows, as more recent, in their own FR-003 sequence (FR-002). Balances are not compared with saved rows.
- An older statement is imported after a newer one (filling a gap) → its rows on shared dates still go after the saved rows (FR-002); the day's balances may then not reconcile across the two imports, and that is accepted.
- File whose balances use the opposite sign convention (e.g. a loan balance shown as a positive amount owed that falls on incoming payments) → balances reconcile in neither direction under FR-011, so the direction comes from the dates (FR-012).
- Identical same-date rows the user confirms as intended (possible duplicates) → each keeps its own file position.
- Deleting a transaction → the remaining same-date transactions keep their relative order.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST use each imported row's position in the source file to determine the saved transaction's same-date sequence (FR-003).
- **FR-002**: System MUST place a confirmed import's transactions for a date after all of the account's already-saved transactions on that date, as more recent transactions, in their FR-003 sequence (later import after earlier). Balances MUST NOT be used to place an import's transactions relative to saved transactions. Saved transactions' sequences and relative order MUST NOT change.
- **FR-003**: System MUST derive a chronological sequence for same-date transactions, using the file direction inferred per FR-012: in a newest-first file the row nearer the top is later; in an oldest-first file the row nearer the top is earlier.
- **FR-004**: The Transactions list MUST order transactions by date (newest first, as today), then by the FR-003 sequence (latest first), so each date's rows read in the same direction as the rest of the list; same-date rows from an oldest-first file therefore appear reversed relative to the file.
- **FR-005**: Paging through the Transactions list MUST honour the same ordering, with no repeats or gaps across page boundaries.
- **FR-006**: Every calculation that takes the last balance on or before a date (including mortgage period balances) MUST use the FR-003 sequence to pick the last transaction of a date.
- **FR-007**: The import review MUST list rows in file order.
- **FR-008**: Every saved transaction MUST have a same-date sequence; a transaction without one MUST NOT exist. No ordering or backfill for transactions saved before this feature is required, because none exist; a migration guard that assigns deterministic unique sequences (by creation time, then identifier) only so the schema can be applied to a non-empty database is permitted and claims no correct order.
- **FR-009**: Ordering MUST NOT change the transactions' dates, descriptions, amounts, directions or balances, nor duplicate detection.
- **FR-010**: The FR-003 sequence MUST be the single authoritative chronological order of an account's transactions, used by every current and future feature that depends on transaction order (not only for display).
- **FR-011**: A transaction's balance reconciles with the one before it when the previous balance plus an incoming amount, or minus an outgoing amount, equals its own balance; a missing balance never reconciles. Reconciliation is used only to infer a file's direction (FR-012), which orders transactions within one import's data; it is never used to order transactions across imports.
- **FR-012**: System MUST infer a file's direction (newest or oldest first) in this order: (1) if the file has a Balance column and every pair of consecutive rows reconciles (per FR-011) in one direction but not in the other, use that direction (a single row, or any missing balance, does not decide); (2) otherwise use the dates, comparing the first and last rows; (3) if the first and last rows' dates are equal (including when every date is equal), treat the file as newest first.

### Key Entities *(include if feature involves data)*

- **Transaction**: gains a same-date sequence derived from its import and its position in the source file.
- **Import (confirmed)**: its inferred file direction (newest or oldest first) orders its own same-date rows; its confirmation order within an account puts its rows after saved same-date transactions.

### Constitution Scope

Tick each that applies, so plan can pick requirement IDs without rereading the spec:

- [x] Stores, changes or deletes data (DOT-002, OPS-001 migrations)
- [ ] Creates or reads audit records (AUD-001)
- [x] Adds or changes endpoints, auth or input handling (SEC-001, SEC-004)
- [x] Handles personal, payment or financial data (SEC-003)
- [ ] Changes UI in clutch-web (WEB-001, style guide)

## Success Criteria *(mandatory)*

- **SC-001**: For every tested file (newest-first, oldest-first and all-same-date), same-date transactions appear in the Transactions list in the order defined by FR-004, verified by automated tests covering newest-first, oldest-first and all-same-date files.
- **SC-002**: Viewing the same account's transactions repeatedly (reloads, paging, new sessions) yields an identical order every time.
- **SC-003**: Every period-end balance taken from transactions equals the balance of the chronologically last transaction for that date in the tested files.
- **SC-004**: In the tested files with reconciling balances, 100% of consecutive same-date transactions from one import reconcile in the stored order (previous balance ± amount equals the next balance), for both newest-first and oldest-first files.

## Assumptions

- Import, review, confirmation, duplicate detection, ownership and audit behave as implemented today (`src/Clutch.API/Application/Imports/`); this feature changes only ordering.
- The Transactions list remains newest-first by date (`src/Clutch.API/Application/Transactions/TransactionService.cs`); the UI shows rows in the order the server returns, so no UI change is needed.
- "File order" means the order of data rows in the uploaded file, top to bottom, excluding the header row.
- File direction is inferred from the file's own balances and dates (FR-012), not from a per-account setting, so no new user input is needed.
- Balances reconcile only under the FR-011 convention (incoming adds, outgoing subtracts); no per-account sign convention is inferred or configured.
- No transactions exist before this feature: the database has been cleared, so there is no legacy data to order or backfill.
- No new endpoints; existing endpoints return the new order. Transaction data is financial (SEC-003), so no row content is logged for ordering.
