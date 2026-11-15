# Quickstart: Delete Imported Transactions

**Feature**: 009-delete-transactions | **Spec**: [spec.md](./spec.md) | **Contract**: [delete-transaction.md](./contracts/delete-transaction.md)

Use this guide to validate the feature after implementation. It does not contain implementation code.

## Prerequisites

- .NET 10 SDK
- Node.js and npm (version per `src/clutch-web/package.json`)
- Docker running (Testcontainers SQL Server)
- A signed-in test user with at least one account that has imported transactions

## 1. Backend validation

From the repository root:

```powershell
dotnet build src/Clutch.API
dotnet test tests/Clutch.API.Tests --filter "FullyQualifiedName~TransactionDelete|FullyQualifiedName~TransactionService"
```

Expected outcome:

- Build succeeds with no new warnings.
- Delete tests pass: 204 on owned transaction, 404 on not-owned, 404 on missing, 404 when the transaction belongs to a different account.
- Atomicity test passes: forcing an audit write failure leaves the transaction in place.

Apply the migration review checklist (OPS-001) before merging:

```powershell
dotnet ef migrations list --project src/Clutch.API
```

The new `AddTransactionDeletionAudit` migration must appear once, with no pending model changes.

## 2. Frontend validation

From `src/clutch-web`:

```powershell
npm run typecheck
npm run lint
npm test -- TransactionsTable DeleteTransactionDialog
npm run build
```

Expected outcome:

- Typecheck and zero-warning lint pass.
- Table tests confirm the actions column is rightmost, each row has a button named "Delete transaction", and the button has no visible text.
- Dialog tests confirm cancel and Escape leave the row unchanged, confirm calls the API once, and errors keep the row.

## 3. End-to-end journey

```powershell
npm run test:e2e -- accounts-transaction-delete
```

Manual check (optional, for review):

1. Open an account with imported transactions.
2. Confirm each row shows a delete action (red trash can icon) in the rightmost column with no text.
3. Click the icon. The confirmation dialog opens with focus on Cancel.
4. Press Escape. The dialog closes and the row remains.
5. Click the icon again and confirm. The row disappears.
6. Re-import the same statement. The transaction is added back (spec FR-009).
7. Switch to dark theme and repeat steps 2 to 3. Contrast and focus ring remain visible.
8. Tab to the delete action and activate it with Enter, then with Space.

## 4. Security checks

- Call the endpoint with a different user's account id. Expect 404.
- Call the endpoint without the `X-CSRF-TOKEN` header. Expect 400.
- Confirm audit rows contain only user id, account id, transaction id, and timestamp (no description or amount).

## 5. Done criteria

- All commands above pass.
- The security review (SEC-001) finds no unresolved issues.
- Performance check: a confirmed delete gives the user a response within 500 ms (constitution Principle VII). This is verified automatically by SC-006 in the Playwright journey (T018). Otherwise the busy state is visible.
- Immutability check: an UPDATE or DELETE against `TransactionDeletionAudits` fails.
