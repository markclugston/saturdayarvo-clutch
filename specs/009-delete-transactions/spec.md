# Feature Specification: Delete Imported Transactions

**Feature Branch**: `009-delete-transactions`

**Created**: 2026-11-15

**Status**: Draft

**Input**: User description: "on the account details screen i want the ability to delete transactions that have been imported in to the account. in the transactions list create a column on the far right for actions. the first action will be a delete button that is visible on each transaction. no text visible simply a red trash can. when you click the red trash can it will popup a confirmation. upon yes it will delete the transaction. there will be no bulk delete at this stage."

## Clarifications

### Session 2026-11-15

- Q: If a user deletes a transaction and later re-imports the same statement file, should that transaction be added back? → A: Yes. Re-import adds it back; deletion removes only the stored transaction record, and deletion history is not used to block re-import.
- Q: Should each deletion be recorded in an audit log? → A: Yes. Each confirmed deletion is recorded in a separate audit table (user, transaction identifier, timestamp) that is not shown in the UI.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Delete a single imported transaction (Priority: P1)

A signed-in user viewing an account's details wants to remove a transaction that was imported into that account by mistake or that no longer belongs there. Each transaction row in the transactions list shows a delete action (a red trash can icon) in a dedicated actions column on the far right. The user activates the delete action, reviews a confirmation prompt, and confirms. The transaction is removed from the account and disappears from the list.

**Why this priority**: This is the entire requested capability and the minimum needed to deliver value. Users cannot clean up imported data without it.

**Independent Test**: Open an account that has imported transactions, activate the delete action on one transaction, confirm, and verify that the transaction no longer appears in the list and no longer counts toward the account.

**Acceptance Scenarios**:

1. **Given** the account details screen shows a list of imported transactions, **When** the user looks at the list, **Then** an actions column appears as the rightmost column and each transaction row shows a delete action (a red trash can icon) in that column.
2. **Given** a transaction row shows the delete action, **When** the user looks at the row, **Then** no text label is shown next to or inside the icon; the icon alone is visible.
3. **Given** the user activates the delete action on a transaction, **When** the action is triggered, **Then** a confirmation prompt appears and the transaction is not yet deleted.
4. **Given** the confirmation prompt is showing, **When** the user confirms, **Then** the transaction is deleted, the prompt closes, and the transaction no longer appears in the transactions list.
5. **Given** the confirmation prompt is showing, **When** the user cancels or dismisses it, **Then** the prompt closes and the transaction remains unchanged in the list.
6. **Given** a transaction has been deleted, **When** the user views the account's transactions again later, **Then** the deleted transaction does not reappear, unless the user imports the same source data again.

---

### User Story 2 - Recover from a failed deletion (Priority: P2)

If the deletion cannot be completed, for example because of a connection problem or because the transaction was already removed elsewhere, the user is told that the deletion did not happen and the transaction remains visible so they can try again.

**Why this priority**: Clear failure feedback prevents users from assuming data was removed when it was not. It is secondary to the core deletion.

**Independent Test**: Simulate a failed deletion and verify that an error message is shown and the transaction remains in the list.

**Acceptance Scenarios**:

1. **Given** the user has confirmed a deletion, **When** the deletion fails, **Then** the user sees a message stating the transaction could not be deleted and the transaction remains in the list.
2. **Given** a deletion has failed, **When** the user tries again, **Then** they can retry the deletion from the same row.

---

### Edge Cases

- What happens when the user activates the delete action and then closes the browser before confirming? The transaction must not be deleted.
- What happens when the same transaction is deleted in another browser session before this one confirms? The user sees that the transaction no longer exists, and the list refreshes without it rather than showing a generic failure.
- What happens when the account has only one transaction and it is deleted? The list shows its empty state.
- What happens when the user double-clicks the confirm button? The transaction is deleted once and no error is shown for the second click.
- What happens when a transaction is part of a list that is filtered or sorted? Only the selected transaction is removed, and the current filter and sort remain applied.
- What happens when a transaction is deleted while another transaction on the same screen is being viewed or edited? The other transaction is unaffected.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The transactions list on the account details screen MUST include an actions column as the rightmost column.
- **FR-002**: Every transaction row in the transactions list MUST display a delete action in the actions column.
- **FR-003**: The delete action MUST be presented as a red trash can icon with no visible text label.
- **FR-004**: The delete action MUST have an accessible name (for example, "Delete transaction") so it can be identified by screen readers and automated tests, even though no text is visible.
- **FR-005**: Activating the delete action MUST open a confirmation prompt before any data is changed.
- **FR-006**: The confirmation prompt MUST offer a clear way to confirm the deletion and a clear way to cancel it.
- **FR-007**: Cancelling or dismissing the confirmation prompt MUST leave the transaction unchanged.
- **FR-008**: Confirming the deletion MUST permanently remove only the selected transaction record from the database. Deletion MUST NOT change any other transaction or its data (including its amount, balance, date, description, category, and import details). No other record is modified as a side effect.
- **FR-009**: Deleted transactions MUST NOT appear in the transactions list or any other account view after deletion is confirmed. A deleted transaction MAY reappear only if the user later imports the same source data again; the audit log in FR-015 is not used to hide or block imports.
- **FR-010**: Every transaction shown in the account details transactions list MUST be deletable. The list shows only transactions imported into the account, so no other transactions are deletable from this screen.
- **FR-011**: The system MUST NOT provide any way to delete multiple transactions at once on this screen.
- **FR-012**: If a deletion fails, the system MUST inform the user that the transaction was not deleted and MUST keep the transaction visible in the list.
- **FR-013**: Deletions MUST be limited to the signed-in user's own accounts and transactions.
- **FR-014**: The action column and delete action MUST remain usable with keyboard navigation (the delete action can be reached by Tab and activated with Enter or Space).
- **FR-015**: Each confirmed deletion MUST be recorded in an audit log that stores the acting user (`ActingUserId`, the signed-in user), the account identifier, the deleted transaction's identifier, and the time of deletion, as defined in data-model.md. The audit log MUST NOT be shown in the user interface and MUST NOT prevent the same source data from being re-imported.
- **FR-016**: The delete action and confirmation prompt MUST follow the signed-in user's theme choice (Light, Dark, or System) from the existing preferences feature. This feature adds no theme setting. The default is Light, as set by the existing theme provider. The theme choice is read from and saved through the existing preferences API (`src/clutch-web/src/features/preferences/api.ts`), so it persists across sessions for the signed-in user. The red trash can icon of the delete action MUST use the existing `--destructive` theme token (`src/clutch-web/src/index.css`), which has separate Light and Dark values that meet the contrast requirements in FR-017.
- **FR-017**: The account details transactions list, the delete action, and the confirmation prompt MUST meet WCAG 2.2 AA. This includes non-text contrast of at least 3:1 for the trash can icon and focus ring, a visible focus indicator, an accessible name for the icon-only control (FR-004), and no content that depends on hover alone. The layout MUST remain usable at mobile and desktop widths.
- **FR-018**: When a confirmed deletion takes longer than 500 ms, the UI MUST show a busy state on the confirmation prompt until the request completes. The busy state MUST prevent a second submission.

### Key Entities *(include if feature involves data)*

- **Account**: A bank account the signed-in user tracks. Owns a set of transactions.
- **Transaction**: A single financial entry imported into an account. Has an amount, balance, date, description, and category, all imported with the record. Deleting it removes only that record and its values.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can delete a transaction in three interactions or fewer (activate delete action, confirm, done) from the account details screen.
- **SC-002**: 100% of confirmed deletions remove the transaction from the list without requiring a page reload.
- **SC-003**: 100% of cancelled or dismissed confirmations leave the transaction unchanged.
- **SC-004**: Every transaction row exposes exactly one delete control whose accessible name is "Delete transaction" and that has no visible text. This is verified by automated role-based tests (Testing Library and Playwright), not by usability studies.
- **SC-005**: No transaction is deleted by accident from a single click: every deletion requires an explicit confirmation step.
- **SC-006**: In the automated end-to-end journey, the delete request returns within 500 ms for a seeded account. Responses that take longer show the busy state required by FR-018.

## Assumptions

- Deletion is permanent. The transaction record is removed from the database, and there is no undo, trash, or restore feature in this release. Deletion history is not used to block re-import, so re-importing the same source data adds the transaction back.
- Deleting a transaction removes only that record. Other transactions and their data are left exactly as they were, and account settings are not changed.
- The balance is imported for each transaction alongside its amount. No balances or totals are calculated or recalculated, so deleting a transaction does not affect any other transaction's balance.
- Only the transactions list on the account details screen gets the actions column; other screens that display transactions are out of scope.
- The confirmation prompt uses plain wording describing that the transaction will be removed, and does not require the user to type anything to confirm.
- Editing imported transactions is out of scope for this feature and is tracked separately in the roadmap.
- Import review screens are out of scope; this feature applies only to transactions already saved to an account.
- Single-user access rules already in place apply, so users can only delete transactions in accounts they are allowed to see.
- Audit rows store the signed-in user's identifier (`ActingUserId`), which is personal data. Audit rows are retained indefinitely (data-model.md). Removing audit rows when a user account is deleted is out of scope for this feature and needs a decision before the account-deletion process is built. This is recorded as an open risk in plan.md (Principle V).
- The delete action is the icon-only control in the actions column, shown as a red trash can icon. The spec, plan, and tasks all use the term "delete action" for it.
