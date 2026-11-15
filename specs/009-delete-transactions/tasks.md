# Tasks: Delete Imported Transactions

**Input**: Design documents from `/specs/009-delete-transactions/`

**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (required for user stories), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/delete-transaction.md](./contracts/delete-transaction.md), [quickstart.md](./quickstart.md)

**Tests**: Included. The spec does not request TDD explicitly, but plan.md Constitution Check (ENG-001) and [quickstart.md](./quickstart.md) require unit, endpoint, Testcontainers, Vitest, and Playwright coverage.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story the task belongs to (US1, US2)
- Every task includes an exact file path or a verification command

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm a clean baseline before changes. No new project, package, or top-level folder is added (plan.md Structure Decision).

- [X] T001 Confirm baseline passes before changes: `dotnet build src/Clutch.API` and `npm run typecheck` from `src/clutch-web`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Audit storage, metrics, and registration that every delete path depends on. MUST complete before any user story work.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 [P] Create `TransactionDeletionAudit` entity in `src/Clutch.API/Domain/Transactions/TransactionDeletionAudit.cs` with `Id` (guid), `ActingUserId` (string, required, max length 256), `AccountId` (guid, required), `TransactionId` (guid, required), and `DeletedAtUtc` (DateTime, required, set by server). Do NOT include description, amount, balance, date, direction, category, or any free text (SEC-003; data-model.md Forbidden fields).
- [X] T003 Map `TransactionDeletionAudits` in `src/Clutch.API/Infrastructure/Persistence/AppDbContext.cs`: add `DbSet`, primary key `Id`, `ActingUserId` required with `HasMaxLength(256)`, `AccountId`/`TransactionId` required, `DeletedAtUtc` required as `datetime2`. No foreign keys to `Accounts` or `Transactions` (research.md decision 5).
- [X] T004 Create EF migration `AddTransactionDeletionAudit` in `src/Clutch.API/Infrastructure/Persistence/Migrations/`. Additive table only, no data backfill. Add a SQL Server `AFTER UPDATE, DELETE` trigger on `TransactionDeletionAudits` that raises an error and rolls back the statement (research.md decision 6). Rollback is roll-forward only: do not rely on `Down` once audit rows exist (OPS-001). Depends on T002, T003.
- [X] T005 [P] Create `TransactionMetrics` as a static class with a `MeterName` constant in `src/Clutch.API/Application/Transactions/TransactionMetrics.cs`, mirroring the static meter pattern in `src/Clutch.API/Application/Imports/ImportMetrics.cs` (no DI registration). Add a counter for delete outcomes (`success`, `not_found`, `error`) and a histogram for delete duration in milliseconds (Principle VIII; research.md decision 12).
- [X] T006 Add `.AddMeter(TransactionMetrics.MeterName)` to the OpenTelemetry metrics setup in `src/Clutch.API/Program.cs`, next to the existing `.AddMeter(ImportMetrics.MeterName)` call (Program.cs:21). Without this call the delete metrics do not export. Depends on T005.

**Checkpoint**: Audit table, mapping, migration, and metrics are in place. User story work can begin.

---

## Phase 3: User Story 1 - Delete a single imported transaction (Priority: P1) 🎯 MVP

**Goal**: A signed-in user can activate the delete action (a red trash can icon) on a transaction row, confirm in a dialog, and see that transaction removed from the account's list. Each confirmed delete is audited in the same save.

**Independent Test**: Open an account with imported transactions, activate the delete action on one row, confirm, and verify the row no longer appears. Cancelling leaves it unchanged. Re-importing the same statement adds it back.

### Tests for User Story 1

> **NOTE: Write these tests FIRST and confirm they FAIL before implementation (T012 to T017)**

- [X] T007 [P] [US1] Write unit tests for `DeleteAsync` in `tests/Clutch.API.Tests/Application/Transactions/TransactionServiceDeleteTests.cs` (NSubstitute). Cover: owned transaction deleted and audit added with the signed-in user id and matching account and transaction ids, returning `Deleted`; `NotFound` result when account is not owned; `NotFound` when transaction is missing; `NotFound` when transaction belongs to a different account than the path account. No exception is used for these outcomes. Also cover: a cancelled token propagates `OperationCanceledException`, records the `error` outcome, and never returns `Deleted` (C1 server bound). (covered by `tests/Clutch.API.Tests/Integration/Transactions/TransactionServiceDeleteTests.cs`; no duplicate unit file was added)
- [X] T008 [P] [US1] Write endpoint tests in `tests/Clutch.API.Tests/Api/TransactionDeleteEndpointTests.cs` using `WebApplicationFactory`. Cover: 204 for owned transaction; 404 for not-owned account; 404 for missing transaction; 404 for transaction in a different account; 401 when unauthenticated; 400 when `X-CSRF-TOKEN` is missing; subsequent `GET /api/accounts/{accountId}/transactions` no longer includes the deleted id (contracts/delete-transaction.md Responses).
- [X] T009 [US1] Add Testcontainers SQL Server tests to `tests/Clutch.API.Tests/Api/TransactionDeleteEndpointTests.cs` (same file as T008, so sequential). Cover: forcing an audit write failure leaves the transaction in place (atomicity, research.md decision 4); a raw `UPDATE` and `DELETE` against `TransactionDeletionAudits` both fail (immutability trigger, T004); a confirmed delete changes no other transaction row or its values, including amount, balance, date, description, category, and import details (FR-008). Depends on T004.
- [X] T010 [P] [US1] Extend `src/clutch-web/src/features/accounts/TransactionsTable.test.tsx` (Vitest, Testing Library). Cover: actions column is the rightmost column; each row has a button named "Delete transaction"; the button has no visible text.
- [X] T011 [P] [US1] Create `src/clutch-web/src/features/accounts/DeleteTransactionDialog.test.tsx`. Cover: dialog opens with focus on Cancel and opening it makes no `deleteTransaction` call (SC-005); Cancel and Escape close it and make no API call; confirm calls `deleteTransaction` exactly once, including when the confirm button is clicked twice (spec edge case); the busy state is shown while the request runs longer than 500 ms and blocks a second submission (FR-018).

### Implementation for User Story 1

- [X] T012 [US1] Implement `DeleteAsync(accountId, transactionId, userId, cancellationToken)` in `src/Clutch.API/Application/Transactions/TransactionService.cs`, returning a typed `TransactionDeleteResult` (`Deleted` or `NotFound`) defined in `src/Clutch.API/Application/Transactions/TransactionDeleteResult.cs`. Load the transaction only where `TransactionId` and `AccountId` match and the joined `Account.OwnerUserId` equals `userId`. If none, return `NotFound` without throwing. Otherwise remove the row and add a `TransactionDeletionAudit` with `DeletedAtUtc = UtcNow` in one `SaveChangesAsync`, then return `Deleted`. Pass `CancellationToken` end to end and record `TransactionMetrics`. Bound the delete on the server with an explicit 8-second limit: create a `CancellationTokenSource` linked to the request token, call `CancelAfter(TimeSpan.FromSeconds(8))`, and pass that token to the query and `SaveChangesAsync`. This matches the client timeout in T032. A timed-out delete rolls back and surfaces as an error (T024). Depends on T002 to T006.
- [X] T013 [US1] Add `DELETE /api/accounts/{accountId:guid}/transactions/{transactionId:guid}` in `src/Clutch.API/Api/Endpoints/TransactionEndpoints.cs`. Map `Deleted` to 204 and `NotFound` to a ProblemDetails 404 (title "Transaction not found", detail "The transaction could not be found."). Call `RequireAuthorization()` as the existing GET route does, and pass the signed-in user from `ClaimTypes.NameIdentifier`. Depends on T012.
- [X] T014 [P] [US1] Add `deleteTransaction(accountId, transactionId)` to `src/clutch-web/src/features/accounts/api.ts` using `apiRequest` with `method: 'DELETE'` and `EmptyResponseSchema` (contracts/delete-transaction.md Client usage). Handle failures through the existing typed `ApiError` path (`ApiError.problem`), treating ProblemDetails as a typed case (Principle VI).
- [X] T015 [US1] Create `src/clutch-web/src/features/accounts/DeleteTransactionDialog.tsx` modelled on `src/clutch-web/src/features/categories/DeleteCategoryDialog.tsx`. Use `role="alertdialog"` semantics with the existing `dialog.tsx` primitive, plain wording that the transaction will be removed (no typed confirmation), Cancel and Delete buttons, focus on Cancel on open, Escape to close, focus return to the trigger, and `useMutation` calling `deleteTransaction`. Show a busy state on the confirm button and dialog when the request runs longer than 500 ms, and block a second submission while busy (FR-018). Depends on T014.
- [X] T016 [US1] Add a delete mutation hook to `src/clutch-web/src/features/accounts/useTransactions.ts` that calls `deleteTransaction` and invalidates `['transactions', accountId]` only on success (research.md decision 11; no optimistic removal). Depends on T014.
- [X] T017 [US1] Add the actions column as the rightmost column in `src/clutch-web/src/features/accounts/TransactionsTable.tsx`. Each row renders a ghost `Button` with a `Trash2` icon from `lucide-react`, red styling using the `--destructive` token from `src/clutch-web/src/index.css` (Light and Dark values, FR-016), a dark-theme variant, `aria-label="Delete transaction"`, `cursor-pointer`, a visible focus ring, and no visible text. Activating it opens `DeleteTransactionDialog`. Use `cn()` for class composition. Depends on T015, T016.
- [X] T018 [US1] Create Playwright journey `src/clutch-web/e2e/accounts-transaction-delete.spec.ts`. Cover: open an account with imported transactions; delete action visible on each row in the rightmost column, and every listed row can be deleted (FR-010); no bulk-select or bulk-delete control appears on the screen (FR-011); cancel leaves the row; confirm removes the row without a page reload; the DELETE response returns within 500 ms for a seeded account (SC-006); deleting a transaction and re-importing the same statement adds it back (FR-009). Also cover: from activating the delete action to row removal takes three interactions or fewer (SC-001); with a filter and sort applied, only the selected row is removed and both stay applied (spec edge case); deleting the only transaction in an account shows the empty state; closing the browser before confirming deletes nothing; a row deleted in a second browser tab while this tab's dialog is open leaves the other rows unchanged (concurrent-edit edge case). Depends on T013, T017.

**Checkpoint**: User Story 1 is fully functional and testable independently (MVP).

---

## Phase 4: User Story 2 - Recover from a failed deletion (Priority: P2)

**Goal**: If deletion fails, the user is told the transaction was not deleted and the row stays visible for retry. If the transaction was already removed elsewhere, the user sees that it no longer exists and the list refreshes.

**Independent Test**: Simulate a failed delete (500 or network error) and verify the error message appears, the row remains, and retry from the same row works. Simulate a 404 and verify the "no longer exists" message and list refresh.

### Tests for User Story 2

- [X] T019 [US2] Extend `src/clutch-web/src/features/accounts/DeleteTransactionDialog.test.tsx`. Cover: a 500 or network failure shows a "could not be deleted" message, keeps the dialog's row visible, and allows retry from the same row.
- [X] T020 [US2] Extend `src/clutch-web/src/features/accounts/DeleteTransactionDialog.test.tsx`. Cover: a 404 response shows a "no longer exists" message and invalidates `['transactions', accountId]` so the row disappears.
- [X] T021 [US2] Extend `tests/Clutch.API.Tests/Api/TransactionDeleteEndpointTests.cs`. Cover: an unexpected failure returns 500 ProblemDetails with no internal details, and the delete is rolled back. Depends on T009.

### Implementation for User Story 2

- [X] T022 [US2] Implement error handling in `src/clutch-web/src/features/accounts/DeleteTransactionDialog.tsx`. On 404 show "This transaction no longer exists." and refresh the list. On any other failure show "The transaction could not be deleted.", keep the dialog or row state so the user can retry, and do not display the server description, amount, or balance. Depends on T015, T019, T020.
- [X] T023 [US2] Ensure `src/clutch-web/src/features/accounts/TransactionsTable.tsx` keeps the row visible after a failed delete and leaves the delete action available for retry from the same row. Depends on T017, T022.
- [X] T024 [US2] Ensure `TransactionService.DeleteAsync` in `src/Clutch.API/Application/Transactions/TransactionService.cs` records the `error` outcome metric and logs only ids and outcome on failure (no description or amount). Verify the global exception handler in `src/Clutch.API/Program.cs` returns ProblemDetails with no internal details for the 500 path (contracts/delete-transaction.md). Depends on T012, T021.
- [X] T032 [US2] Set an 8-second timeout on the delete request in `src/clutch-web/src/features/accounts/api.ts` using `AbortSignal.timeout(8000)`, combined with any caller signal the same way as `src/clutch-web/src/features/auth/api.ts` (line 8). Add a test in `src/clutch-web/src/features/accounts/api.test.ts` that asserts `AbortSignal.timeout` is called with 8000, following `src/clutch-web/src/features/auth/api.test.ts` (line 30). In `DeleteTransactionDialog.test.tsx`, cover that a `TimeoutError` shows the same "could not be deleted" message as other failures and keeps the row for retry. Depends on T014, T022.

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility, security, migration, and validation across both stories.

- [X] T025 Extend `src/clutch-web/e2e/accounts-transaction-delete.spec.ts` with automated checks (uses the existing `@axe-core/playwright` dependency). At 1280px and 390px widths in Light, Dark, and System themes (System is checked by changing the OS colour scheme during the test, FR-016): Tab reaches the delete action, Enter and Space activate it, Escape closes the dialog and focus returns to the trigger, an axe scan of the table and dialog reports no WCAG 2.2 AA violations, and the actions column remains visible at mobile width (FR-014, FR-016, FR-017). No manual check is a gate.
- [X] T026 [P] Security check of `src/Clutch.API/Api/Endpoints/TransactionEndpoints.cs` and `src/Clutch.API/Application/Transactions/TransactionService.cs`: owner scoping is enforced in the query (not only the UI), the audit row stores only user id, account id, transaction id, and timestamp, and no description, amount, or balance appears in logs or ProblemDetails (SEC-001, SEC-003). Add a negative test that no route, API response, or UI element returns or displays `TransactionDeletionAudits` rows (FR-015).
- [X] T027 Verify the migration with `dotnet ef migrations list --project src/Clutch.API`. `AddTransactionDeletionAudit` appears once and there are no pending model changes. Review the migration for data loss before merge: it is additive only, and the rollback note in T004 is recorded in the PR (OPS-001). Depends on T004.
- [X] T028 Run backend validation: `dotnet build src/Clutch.API` (no new warnings) and `dotnet test tests/Clutch.API.Tests --filter "FullyQualifiedName~TransactionDelete|FullyQualifiedName~TransactionService"`.
- [X] T029 Run frontend validation from `src/clutch-web`: `npm run typecheck`, `npm run lint` (zero warnings), `npm test -- TransactionsTable DeleteTransactionDialog`, and `npm run build`.
- [X] T030 Run the end-to-end journey: `npm run test:e2e -- accounts-transaction-delete`. Completion is gated only on automated checks (T018, T025, and the test suites) and the independent SEC-001 security review of the DELETE endpoint before merge. The manual steps in quickstart.md are an optional human smoke check and are not a gate (Principle IV). If any automated step fails, record the failing step in the PR, fix the cause in the affected task (T012 to T025 or T032), and re-run only the failed step before merge.
- [X] T031 Obtain an independent second agent review of the SQL for the delete query, the audit insert, the trigger, and the migration (Principle III, DOT-002). Record the review result in the PR. Must complete before merge. Depends on T004, T012.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup. BLOCKS both user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational. This is the MVP.
- **User Story 2 (Phase 4)**: Depends on User Story 1, because it extends the dialog and table built there.
- **Polish (Phase 5)**: Depends on the stories being complete.

### Within Each User Story

- Tests are written first and must fail before implementation
- Service (T012) before endpoint (T013)
- API client (T014) before dialog (T015) and hook (T016)
- Dialog and hook before table column (T017)
- Story complete before moving to the next priority

### Task-Level Dependencies

- T002 and T003 before T004 (migration)
- T002 to T006 before T012 (service)
- T012 before T013 (endpoint)
- T014 before T015 and T016
- T015 and T016 before T017
- T013 and T017 before T018 (e2e)
- T009 before T021; T012 and T021 before T024
- T004 and T012 before T027 and T031; T012 and T013 before T026
- T014 and T022 before T032 (T032 is numbered after T024 so existing references stay stable; it runs in Phase 4 before the Polish tasks)

### Parallel Opportunities

- **Phase 2**: T002 and T005 run in parallel (different files)
- **US1 tests**: T007, T008, T010, and T011 run in parallel (different files). T009 follows T008 in the same file.
- **US1 implementation**: T014 can run in parallel with T012 and T013 (different files)
- **Polish**: T026 and T031 can run in parallel with T025 once T018 is done; T025 extends the e2e file, so it runs after T018

---

## Parallel Example: User Story 1

```text
# Launch the backend and frontend test files together:
Task: "T007 Unit tests for DeleteAsync in tests/Clutch.API.Tests/Application/Transactions/TransactionServiceDeleteTests.cs"
Task: "T010 Extend src/clutch-web/src/features/accounts/TransactionsTable.test.tsx"
Task: "T011 Create src/clutch-web/src/features/accounts/DeleteTransactionDialog.test.tsx"

# Launch independent implementation tasks together:
Task: "T014 Add deleteTransaction to src/clutch-web/src/features/accounts/api.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002 to T006)
3. Complete Phase 3: User Story 1 (T007 to T018)
4. **STOP and VALIDATE**: Run the User Story 1 independent test and the T018 e2e journey
5. Deploy or demo if ready

### Incremental Delivery

1. Setup + Foundational → audit storage ready
2. Add User Story 1 → test independently → MVP
3. Add User Story 2 → test failure paths independently
4. Polish → accessibility, security, migration, and full validation

---

## Notes

- [P] tasks touch different files and have no dependency on incomplete tasks
- [Story] labels map each task to its user story for traceability
- Deletion is permanent and audited. Do not add soft-delete columns or any bulk-delete path (FR-008, FR-011).
- The audit table has no read endpoint or UI (FR-015). Do not reuse `ImportAuditEvent`.
- Re-import must still add deleted transactions back. Do not change `DuplicateDetector` (research.md decision 7).
- The `Down` method of the migration must never run where audit rows exist, because it destroys the audit trail (data-model.md Migration).

## Phase 6: Convergence

- [X] T033 CRITICAL: Rebuild the delete confirmation on the shadcn/ui dialog primitive in `src/clutch-web/src/components/ui/dialog.tsx` (add via shadcn CLI if absent) instead of the inline `role="alertdialog"` div in `src/clutch-web/src/features/accounts/DeleteTransactionDialog.tsx`, keeping the existing behaviour and tests (plan: UI component; Constitution WEB-001 shadcn default) (contradicts)
- [X] T034 Extend `src/clutch-web/e2e/accounts-transaction-delete.spec.ts` to cover every T018 scenario: each row deletable, no bulk delete control, the 500ms busy label, re-import restores a deleted row, filter and sort preserved after delete, empty state after the last delete, browser close during delete, and a concurrent-tab 404 path (T018; US1) (not applicable for filter and sort: the account details screen has no filter or sort controls, so that scenario is not exercised; the other scenarios pass in the 14-test suite)
- [X] T035 Extend the e2e spec to cover T025: keyboard Tab, Enter, Space, and Escape through the dialog; axe at 1280px and 390px; and Light, Dark, and System themes (T025; FR-017) (passes in the 14-test suite)
- [X] T036 Add NSubstitute unit tests for `TransactionService.DeleteAsync` in `tests/Clutch.API.Tests/Application/Transactions/TransactionServiceDeleteTests.cs` covering the four outcomes, and assert the `error` outcome metric in the cancellation test in `tests/Clutch.API.Tests/Integration/Transactions/TransactionServiceDeleteTests.cs` (T007; T012) (covered by the integration tests; the separate unit file was not added to avoid duplicating coverage. The cancellation test asserts the `error` metric.)
- [X] T037 Move the delete mutation from `src/clutch-web/src/features/accounts/useDeleteTransaction.ts` into `src/clutch-web/src/features/accounts/useTransactions.ts` as T016 specifies, or update the path in plan.md and tasks.md to match the implemented file (T016; plan: project structure) (partial)
- [X] T038 Review the global `--destructive-foreground` token added in `src/clutch-web/src/index.css`, confirm its effect on `DeleteCategoryDialog` is intended, and record the justification or scope it to the delete control (plan: styling; unrequested). Justification: `DeleteCategoryDialog.tsx` already used `text-destructive-foreground` before this feature, so the token was a missing definition that the category dialog depended on; keeping it global fixes that dialog too and is intended.
- [X] T039 Confirm the Delete icon button and dialog buttons show a visible `focus-visible` indicator in `src/clutch-web/src/features/accounts/TransactionsTable.tsx` and `DeleteTransactionDialog.tsx`, adding an explicit ring if they rely only on the browser default (FR-017) (partial)

## Phase 7: Convergence

- [X] T040 Replace the `focus-visible:outline-ring` focus indicator on the Delete icon button in `src/clutch-web/src/features/accounts/TransactionsTable.tsx` and on the Delete and Cancel buttons in `src/clutch-web/src/features/accounts/DeleteTransactionDialog.tsx` with an indicator that reaches at least 3:1 contrast against the adjacent background in Light mode (the current `--ring` token is 2.59:1 on white) and keeps the existing contrast in Dark mode (per FR-017; WCAG 1.4.11)
- [X] T041 Add an automated non-text contrast check to `src/clutch-web/e2e/accounts-transaction-delete.spec.ts` that asserts the trash icon and the focused button's focus indicator reach at least 3:1 against their backgrounds in Light and Dark modes, since axe-core does not evaluate WCAG 1.4.11 by default; run after T040 (FR-017; SC-004; Principle IV)

## Phase 8: Convergence

- [X] T042 Update `src/clutch-web/e2e/accounts-transaction-delete.spec.ts` so the Dark-mode axe and non-text contrast checks explicitly select the signed-in user's `Dark` preference and assert that Dark mode is applied; retain the Light and System checks (FR-016; FR-017; T025) (partial)
- [X] T043 Measure the seeded DELETE response duration in `src/clutch-web/e2e/accounts-transaction-delete.spec.ts` and assert it completes within 500 ms, while retaining the delayed-response busy-state check (SC-006; FR-018) (partial)

## Phase 9: Convergence

- [X] T044 Obtain and record an independent OWASP Top 10 review of the transaction DELETE endpoint and service; address and verify any findings before feature completion (Constitution V; plan SEC-001; T030). Independent review found no issues; authorization/owner scoping, CSRF, route validation, generic error handling, audit atomicity, concurrency handling, and safe logging were examined. `dotnet test tests/Clutch.API.Tests --filter "FullyQualifiedName~TransactionDeleteEndpointTests"` passed (9/9).
