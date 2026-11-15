# Research: Delete Imported Transactions

**Feature**: 009-delete-transactions | **Date**: 2026-11-15

No `NEEDS CLARIFICATION` markers remain. The spec clarifications resolved re-import behaviour and audit logging. The decisions below resolve the design choices.

## 1. Endpoint shape

- **Decision**: `DELETE /api/accounts/{accountId:guid}/transactions/{transactionId:guid}`, returning `204 No Content` on success.
- **Rationale**: Matches the existing `GET /api/accounts/{accountId:guid}/transactions` route in [TransactionEndpoints.cs](../../src/Clutch.API/Api/Endpoints/TransactionEndpoints.cs). Including the account in the path lets the service check ownership of both the account and the transaction in one query.
- **Alternatives considered**: `DELETE /api/transactions/{id}` (no account scope in the URL, so ownership must be derived from the row alone; less consistent with existing routes).

## 2. Ownership and not-found handling

- **Decision**: The service loads the transaction only when its `AccountId` matches the path account and the account's `OwnerUserId` matches the signed-in user. Otherwise it returns a typed `NotFound` result, which the endpoint maps to a ProblemDetails 404. Non-owned and missing records return the same response, so IDs cannot be probed.
- **Rationale**: Same pattern as `TransactionService.GetPageAsync`, which returns 404 when the account is not owned (FR-013). A single response for "not yours" and "not found" avoids leaking existence.
- **Alternatives considered**: 403 for non-owned records (reveals existence); 204 for already-deleted records (hides a real race from the user; the spec's edge case requires the user to see that the transaction no longer exists).

## 3. Concurrent deletion (already deleted elsewhere)

- **Decision**: If the transaction is already gone when the request arrives, the endpoint returns 404 ProblemDetails. The client shows a "no longer exists" message and refreshes the list so the row disappears.
- **Rationale**: Matches the spec's edge case. A generic failure message would be misleading.
- **Alternatives considered**: Idempotent 204 (simpler, but the user is not told the row was already gone).

## 4. Delete and audit atomicity

- **Decision**: Remove the transaction and insert the audit row in the same `SaveChangesAsync` call. If either fails, neither persists.
- **Rationale**: FR-015 requires an audit record for every confirmed deletion. A deletion without an audit record, or an audit record without a deletion, would both be incorrect. EF Core wraps a single `SaveChangesAsync` in a transaction.
- **Alternatives considered**: Two separate saves (not atomic); database triggers (hides logic from the application layer and is harder to test).

## 5. Audit storage

- **Decision**: New entity `TransactionDeletionAudit` in its own table `TransactionDeletionAudits`. Columns: `Id` (guid), `ActingUserId` (string), `AccountId` (guid), `TransactionId` (guid), `DeletedAtUtc` (datetime2). No foreign key to `Transactions`, because the row is removed. No description, amount, balance, or date values (SEC-003).
- **Rationale**: The audit must outlive the deleted row, so it cannot carry an FK to `Transactions`. Keeping it separate from `ImportAuditEvent` avoids mixing deletion events into the import audit trail, whose `EventCode` format is limited to letters, digits, and `._-`.
- **Alternatives considered**: Reuse `ImportAuditEvent` (wrong semantics; its `ReviewId` is null-capable but the table is import-scoped); soft delete with an `IsDeleted` flag on `Transactions` (rejected by the spec: deletion must be permanent and must not change other data, FR-008).

## 6. Audit access and retention

- **Decision**: The table is written by the application only and has no read endpoint or UI (FR-015). Retention is indefinite. Records are immutable: the application has no update or delete code path, and a SQL Server `AFTER UPDATE, DELETE` trigger on `TransactionDeletionAudits` raises an error and rolls back any such statement.
- **Rationale**: The user confirmed indefinite retention and immutability. The trigger enforces immutability in the database, so it also holds for ad-hoc SQL and future code, not only for this application.
- **Alternatives considered**: Database permissions denying UPDATE and DELETE to the app login (also valid, but depends on how each environment provisions logins; the trigger travels with the migration). Time-based purge job (rejected: retention is indefinite).

## 7. Re-import behaviour

- **Decision**: No change to `DuplicateDetector`. Deleted rows are absent from the existing-transaction set, so a re-import adds them back (spec FR-009).
- **Rationale**: The existing detector compares only against stored transactions. Adding a tombstone check would contradict the clarified requirement.
- **Alternatives considered**: Tombstone table that blocks re-import (explicitly rejected in clarification Q1).

## 8. Frontend confirmation dialog

- **Decision**: New `DeleteTransactionDialog.tsx` modelled on [DeleteCategoryDialog.tsx](../../src/clutch-web/src/features/categories/DeleteCategoryDialog.tsx): `role="alertdialog"` semantics, focus on Cancel on open, Escape to close, focus returns to the delete action, `useMutation`, and error display from `ApiError.problem.detail`.
- **Rationale**: Reuses a tested accessible pattern already in the repo rather than inventing one. The repo has no AlertDialog component, so the existing `dialog.tsx` primitive is used.
- **Alternatives considered**: Native `window.confirm` (not styled, poor for theme support, harder to test); a new shadcn AlertDialog install (adds a dependency for one use).

## 9. Icon and button

- **Decision**: `Trash2` icon from `lucide-react` (already a dependency at `package.json:28`) in a red-styled `Button` with `variant="ghost"` or equivalent, `aria-label="Delete transaction"`, `cursor-pointer`, and a visible focus ring. No visible text.
- **Rationale**: Meets FR-003 and FR-004 and the WEB-001 button rules. Uses an existing icon library.
- **Alternatives considered**: Inline SVG (duplicates an existing dependency).

## 10. Client request and response handling

- **Decision**: `deleteTransaction(accountId, transactionId)` in `features/accounts/api.ts` calls `apiRequest` with `method: 'DELETE'` and `EmptyResponseSchema`. CSRF is added automatically for DELETE in `lib/api/client.ts`.
- **Rationale**: Matches the existing delete functions in `features/imports/api.ts` (lines 88-101). No new client plumbing.
- **Alternatives considered**: Raw `fetch` (bypasses CSRF and error handling).

## 11. Cache update after success

- **Decision**: Invalidate `['transactions', accountId]` in `useTransactions.ts` on success. Show a success state only after the server responds.
- **Rationale**: The infinite query already uses this key. Invalidation refreshes pages in order and keeps the cursor state consistent, so filter and sort stay applied (spec edge case).
- **Alternatives considered**: Optimistic removal (risks showing a deleted row again on failure, which violates FR-012).

## 12. Observability

- **Decision**: One counter for delete outcomes (success, not-found, error) and one histogram for duration, added to a new static `TransactionMetrics` class that follows the `ImportMetrics` meter pattern, with its meter name added through `.AddMeter` in `Program.cs`. Duration is compared against the Principle VII 500 ms target.
- **Rationale**: Principle VIII. Gives operators visibility without logging sensitive values (SEC-003).
- **Alternatives considered**: Log lines only (no metrics for dashboards).

## 13. Testing approach

- **Decision**: Unit tests for the service with NSubstitute where it isolates logic. Integration tests against Testcontainers SQL Server for the delete plus audit atomicity and for ownership scoping. WebApplicationFactory tests for the endpoint status codes. Vitest for the dialog and table. Playwright e2e for the full journey.
- **Rationale**: Principle III requires Testcontainers SQL Server for critical database paths. ENG-001 requires xUnit, NSubstitute, and WebApplicationFactory as in the existing test project.
- **Alternatives considered**: EF Core in-memory provider (does not enforce the SQL Server transaction semantics the atomicity test needs).
