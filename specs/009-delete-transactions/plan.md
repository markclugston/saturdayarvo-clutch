# Implementation Plan: Delete Imported Transactions

**Branch**: `009-delete-transactions` | **Date**: 2026-11-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-delete-transactions/spec.md`

## Summary

Add a per-row delete action to the transactions list on the account details screen. The action is a red trash-can icon in a new rightmost actions column. Confirming it permanently deletes that one transaction through a new owner-scoped `DELETE` endpoint nested under the account. The same database transaction also writes a hidden deletion audit record (FR-015). The web client shows a confirmation dialog, keeps the row on failure, and refreshes the list on success. Re-importing the same statement adds the transaction back, because duplicate detection only compares against stored transactions (see [research.md](./research.md)).

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: C# on .NET 10 (backend `src/Clutch.API`); TypeScript with React (frontend `src/clutch-web`)

**Primary Dependencies**: ASP.NET Core minimal APIs, EF Core with SQL Server provider, OpenTelemetry metrics; React, TanStack Query, shadcn/ui dialog, lucide-react icons, Zod schemas

**Storage**: SQL Server via EF Core. One new audit table (`TransactionDeletionAudits`) plus an EF migration. No schema change to `Transactions`.

**Testing**: Backend xUnit 2.9.3, NSubstitute 6.2.0, Microsoft.AspNetCore.Mvc.Testing 10.0.14, Testcontainers.MsSql 4.16.0. Frontend Vitest, Testing Library, Playwright e2e.

**Target Platform**: Web API on Windows/Linux server; browser UI (desktop and mobile widths)

**Project Type**: Web application (backend API + SPA frontend)

**Performance Goals**: Per constitution Principle VII, the user sees a response within 500 ms. If the action takes longer, the UI shows a busy state.

**Constraints**: Owner-scoped deletion only (FR-013). Delete and audit write must succeed or fail together. Audit records are retained indefinitely and are immutable (never updated or deleted by the application or the database). Accessibility WCAG 2.2 AA. Icon-only control must have an accessible name. Keyboard reachable. Light and dark themes. Error responses use RFC 9457 ProblemDetails. No bulk delete.

**Scale/Scope**: One endpoint, one service method, one audit entity, one UI column, one dialog, one API client function. Expected row counts are per-account transaction lists already served by cursor pagination (page size 50, max 100).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Rule | Applies | How this plan complies |
|------|---------|------------------------|
| ARC-001 Architecture boundaries | Yes | Endpoint in `Api/Endpoints`, logic in `Application/Transactions`, entity in `Domain`, mapping in `Infrastructure/Persistence`. The service returns a typed result (`Deleted` or `NotFound`), so HTTP status mapping stays in the endpoint (Principle I). No new project. One new meter registration: `.AddMeter(TransactionMetrics.MeterName)` in `Program.cs` (T006), alongside `.AddMeter(ImportMetrics.MeterName)`. `TransactionMetrics` is a static class, so it has no DI registration. No other new registrations. |
| DOT-001 .NET service practices | Yes | Async end-to-end, `CancellationToken` passed through and bounded by an explicit 8-second server limit (T012). Expected not-found outcomes return a typed result and are mapped to ProblemDetails 404 in the endpoint. No exceptions for control flow. |
| DOT-002 EF Core data access | Yes | Single ownership-scoped delete query (`ExecuteDeleteAsync` or tracked delete). Audit row added in the same `SaveChangesAsync`. Migration reviewed before merge. An independent second agent reviews the delete query, audit insert, and migration SQL before merge (Principle III; tasks T031). |
| ENG-001 Testing and quality gates | Yes | Unit tests for the service, WebApplicationFactory endpoint tests, Testcontainers SQL Server for delete plus audit atomicity, Vitest for UI, Playwright e2e for the journey. Frontend typecheck and zero-warning lint. All checks are automated (Principle IV). |
| OPS-001 Reliability and data changes | Yes | New EF migration (additive table only, no data backfill). Audit table is append-only: a database trigger rejects UPDATE and DELETE, and audit retention is indefinite. Delete and audit write are atomic. Rollback is roll-forward only: the `Down` method is not a supported rollback because it would destroy audit rows. To back out, revert the endpoint and leave the table in place. The migration is reviewed for data loss before merge (T027). No logging of descriptions or amounts. |
| SEC-001 Application security | Yes | Owner scoping (FR-013) enforced in the query, not only in the UI. Antiforgery header `X-CSRF-TOKEN` is required on DELETE (existing `UseAntiforgery`). Independent security review (OWASP) of the endpoint before merge. |
| SEC-002 Secrets | No | No secrets, keys, or connection strings are added. |
| SEC-003 Logging and sensitive data | Yes | Audit record stores only user id, account id, transaction id, and timestamp. Error logs and ProblemDetails must not echo description, amount, or balance. |
| WEB-001 Frontend engineering | Yes | Button-only control with `cursor-pointer`, no links, `cn()` with Tailwind, WCAG 2.2 AA (FR-017), role-based tests. Theme definition in FR-016 (existing preferences, default Light). Reuses the `DeleteCategoryDialog` pattern. |
| Principle II .NET service practices (I/O timeouts) | Yes | The server bounds the delete with an explicit 8-second linked `CancellationToken` (T012), matching the client limit. The web client sets an 8-second `AbortSignal.timeout`, matching `features/auth/api.ts` (T032). Timeouts and failures show a retryable message (FR-012, User Story 2). |
| Principle III Database safety | Yes | Independent second agent review of the SQL and migration (T031). |
| Principle IV Automated verification | Yes | All acceptance checks are automated (SC-004, SC-006). No usability study is used as a gate. |
| Principle V Error handling | Yes | Expected not-found outcome is a typed result. Other failures use the global ProblemDetails handler with no internal details (T024). |
| Principle V Sensitive data retention | Open risk | Owner: @markclugston (feature author) until the account-deletion feature is planned. Data flow: the authenticated user id (`ActingUserId`) is written to `TransactionDeletionAudit` in the delete save and kept indefinitely. No account-deletion process exists yet, so no removal path is built. Decision trigger: the account-deletion feature must decide how audit rows are handled before it ships (spec.md Assumptions). |
| Principle VI Frontend theme and accessibility | Yes | Theme and accessibility requirements are defined in FR-016 and FR-017. Light and dark contrast and keyboard checks are automated (T025). |
| Principle VII Performance | Yes | Delete by primary key plus owner check. Response within 500 ms, verified by SC-006. Busy state in the UI when longer (FR-018). |
| Principle VIII Observability | Yes | Failure and duration counters for the delete operation, following the existing `ImportMetrics` meter pattern. |

**Result**: PASS. Re-checked after the analysis remediation: the 404 path uses a typed result, the missing principles are listed, and each applicable MUST has a task or requirement. No unjustified violations.

**Re-check after Phase 1 design**: PASS. The contract, data model, and research artifacts match these rules. No new violations were introduced.


## Project Structure

### Documentation (this feature)

```text
specs/009-delete-transactions/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── delete-transaction.md   # Phase 1 output
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/Clutch.API/
├── Api/Endpoints/TransactionEndpoints.cs          # add DELETE route
├── Program.cs                                     # add TransactionMetrics.MeterName via AddMeter, alongside ImportMetrics
├── Application/Transactions/TransactionService.cs # add DeleteAsync (owner-scoped, writes audit)
│   ├── Application/Transactions/TransactionDeleteResult.cs # typed result: Deleted or NotFound
│   └── Application/Transactions/TransactionMetrics.cs      # new meter: delete outcome counter and duration histogram
├── Domain/Transactions/TransactionDeletionAudit.cs # new audit entity (no description/amount)
└── Infrastructure/Persistence/
    ├── AppDbContext.cs                            # DbSet + mapping for audit table
    └── Migrations/<timestamp>_AddTransactionDeletionAudit.cs  # new migration

tests/Clutch.API.Tests/
├── Application/Transactions/TransactionServiceDeleteTests.cs   # unit tests (NSubstitute)
└── Api/TransactionDeleteEndpointTests.cs                       # WebApplicationFactory + Testcontainers

src/clutch-web/src/
├── features/accounts/api.ts                       # deleteTransaction()
├── features/accounts/TransactionsTable.tsx        # actions column + delete action
├── features/accounts/DeleteTransactionDialog.tsx  # new confirmation dialog
├── features/accounts/useTransactions.ts           # invalidation on success
├── features/accounts/TransactionsTable.test.tsx   # extend
└── features/accounts/DeleteTransactionDialog.test.tsx  # new

src/clutch-web/e2e/
└── accounts-transaction-delete.spec.ts            # Playwright journey
```

**Structure Decision**: Extend the existing Clutch.API layers and the existing accounts feature in clutch-web. No new project, package, or top-level folder. The DELETE route nests under the account (`/api/accounts/{accountId}/transactions/{transactionId}`), matching the existing GET route. The audit entity is a separate table, not a reuse of `ImportAuditEvent`, because that entity is import-scoped and its `EventCode` format is limited to letters, digits, and `._-`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No constitution violations. No complexity justification required.

