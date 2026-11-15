# Contract: Delete Transaction

**Feature**: 009-delete-transactions | **Date**: 2026-11-15

## Endpoint

```http
DELETE /api/accounts/{accountId}/transactions/{transactionId}
```

| Parameter | Location | Type | Required | Notes |
|-----------|----------|------|----------|-------|
| accountId | path | guid | Yes | Account that contains the transaction |
| transactionId | path | guid | Yes | Transaction to delete |
| X-CSRF-TOKEN | header | string | Yes | Antiforgery token. Added automatically by `apiRequest` for DELETE. |

**Authentication**: Required (`.RequireAuthorization()`, same as the existing transaction route).

**Request body**: None.

## Responses

| Status | When | Body |
|--------|------|------|
| 204 No Content | Transaction deleted and audit row written | None |
| 401 Unauthorized | No valid session | ProblemDetails (RFC 9457) |
| 400 Bad Request | Missing or invalid antiforgery token | ProblemDetails (RFC 9457) |
| 404 Not Found | Account not owned by user, transaction not found, or transaction not in this account | ProblemDetails with `detail` that does not reveal ownership or existence |
| 500 Internal Server Error | Unexpected failure. The delete is rolled back. | ProblemDetails with no internal details |

### Example 404 body

```json
{
  "type": "about:blank",
  "title": "Transaction not found",
  "status": 404,
  "detail": "The transaction could not be found."
}
```

The same body is returned for "not owned" and "does not exist" (FR-013).

## Behavioural guarantees

- Only the targeted row is removed. No other transaction, account, or import record changes (FR-008).
- The audit row is written in the same save. If the audit write fails, the delete is rolled back, and the endpoint returns 500 (research decision 4).
- A subsequent `GET /api/accounts/{accountId}/transactions` does not include the deleted id (FR-009).
- Re-importing the same source file may create a new row with the same business values. This is intended (FR-009).
- Response time: the user sees a response within 500 ms (constitution Principle VII). If slower, the client shows a busy state.
- Audit rows are immutable and retained indefinitely (data-model.md).

## Client usage

```ts
// features/accounts/api.ts
deleteTransaction(accountId: string, transactionId: string): Promise<void>
// internally: apiRequest(`/api/accounts/${accountId}/transactions/${transactionId}`, EmptyResponseSchema, { method: 'DELETE' })
```

On 404, the client shows that the transaction no longer exists and refreshes `['transactions', accountId]`. On 500 or network error, it keeps the row and shows a "could not be deleted" message (FR-012).
