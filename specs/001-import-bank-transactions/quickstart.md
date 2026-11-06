# Quickstart: Import Bank Transactions

This guide describes the planned end-to-end validation workflow. It assumes implementation of the API, database, test projects, and scripts defined by [plan.md](./plan.md).

## Prerequisites

- .NET 10 SDK and Node.js supported by the frontend toolchain.
- SQL Server 2022 or newer for local development and a disposable SQL Server container for integration tests.
- Docker-compatible container runtime for database integration tests.
- Frontend dependencies installed with `npm install` in `src/clutch-web`.
- A securely provisioned administrator account and an application database connection string. Use .NET user-secrets locally; never commit credentials.

## Run locally

1. Configure the API database connection and secure initial administrator provisioning through local user-secrets or an approved secret store.
2. Apply EF Core migrations with the repository's documented migration command; verify Identity and feature tables exist.
3. Start the API and frontend using the repository's **API + Frontend** VS Code launch configuration, or run the API and Vite development server separately.
4. Register or sign in with an ordinary user, create their one Family, and create an AUD account in it.
5. Upload a representative CSV. Map date, description, amount and optional direction fields; confirm the date/number conventions; review all rows and possible-duplicate warnings; confirm the import.
6. Verify transactions appear only in the selected account and the account page shows the UTC successful-import timestamp localized for the viewing user.
7. Sign in with an administrator and change one import limit. Verify the setting takes effect immediately without restarting the API. Sign in as an ordinary user and verify administrator settings are inaccessible.

## Validation commands

Run from the repository root after implementation has added the test projects and scripts:

```powershell
dotnet test .\saturdayarvo-clutch.slnx
npm --prefix .\src\clutch-web run typecheck
npm --prefix .\src\clutch-web run lint
npm --prefix .\src\clutch-web run test
npm --prefix .\src\clutch-web run build
npm --prefix .\src\clutch-web run test:e2e
```

Database integration tests must start a disposable SQL Server instance and exercise migrations, one-Family-per-owner enforcement, Family/account authorization, per-account import serialization, atomic confirmation/rollback, review expiry, and current-transaction duplicate detection against the production provider.

## Acceptance scenarios

- Create two accounts with different currencies; update a description without changing its currency.
- Reject account/transaction descriptions containing each identifier pattern without echoing the value in UI, API errors, or logs.
- Import signed amounts, separate incoming/outgoing columns, and explicit direction values; validate date ambiguity and amount separator mismatch flows.
- Submit malformed, invalid, oversized, over-row-limit, cancelled, and concurrent imports; verify no partial writes and no retained source file.
- Confirm duplicate warnings are scoped to one account and require explicit confirmation.
- Verify a user can create only one Family, owns every account within it, and can view, import, and edit those accounts. A different signed-in user cannot access that Family, its accounts, transactions, or import reviews; no member-invitation or account-grant flow is available.
- Verify locale-specific transaction date/currency rendering, system light/dark theme changes, keyboard navigation, and WCAG 2.2 AA in browser tests.
- Verify admin-only limit settings, defaults (10 MiB, 10,000 rows, 5 attempts/user/minute), and runtime updates.

API shapes and error behavior are defined in [contracts/openapi.yaml](./contracts/openapi.yaml); entity fields and review transitions are defined in [data-model.md](./data-model.md).
