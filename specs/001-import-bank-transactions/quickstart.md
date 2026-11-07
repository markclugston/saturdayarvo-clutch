# Quickstart: Import Bank Transactions

This guide describes the planned end-to-end validation workflow. It assumes implementation of the API, database, test projects, and scripts defined by [plan.md](./plan.md).

## Prerequisites

- .NET 10 SDK and Node.js supported by the frontend toolchain.
- SQL Server 2022 or newer for local development and a disposable SQL Server container for integration tests.
- Docker-compatible container runtime for database integration tests.
- Frontend dependencies installed with `npm install` in `src/clutch-web`.
- A securely provisioned administrator account and an application database connection string. Use .NET user-secrets locally; never commit credentials.

## Configure the local SQL Server connection

The API reads `ConnectionStrings:Clutch` from .NET user-secrets in Development. Set it to the local SQL Server instance; this value is stored outside the repository:

```powershell
dotnet user-secrets set "ConnectionStrings:Clutch" 'Data Source=.;Initial Catalog=Clutch;Integrated Security=True;Persist Security Info=False;Pooling=False;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=True;Command Timeout=0' --project .\src\Clutch.API
```

Configure the administrator bootstrap email and password in the same user-secrets store (or an approved secret manager); never place credentials in `appsettings*.json`, browser storage, logs, or committed files. The design-time DbContext factory loads user-secrets and environment variables, with environment variables taking precedence.

For integration tests, the test fixture starts a disposable SQL Server 2022 container with Testcontainers. Ensure the Docker daemon is running before invoking SQL Server integration tests.

## Run locally

1. Apply or inspect migrations from the repository root:

   ```powershell
   dotnet ef migrations list --project .\src\Clutch.API --startup-project .\src\Clutch.API
   dotnet ef database update --project .\src\Clutch.API --startup-project .\src\Clutch.API
   ```

   Use an EF Core CLI version compatible with the project's EF Core 10.0.14 packages. Review the generated migration SQL and take a database backup before applying schema changes to a shared or production database.

2. Verify Identity, Family, account, import-review, transaction, audit, and import-limit tables exist.
3. Use the repository's **API + Frontend** VS Code launch configuration, or start the API with `dotnet run --project .\src\Clutch.API --launch-profile https` and start Vite separately. Vite proxies `/api` requests to `https://localhost:7180` using the local development certificate; restart Vite after changing its configuration. Both use the local Development connection string.
4. Register or sign in with an ordinary user, create their one Family, and create an AUD account in it.
5. Upload a representative CSV. Map date, description, amount and optional direction fields; confirm the date/number conventions; review all rows and possible-duplicate warnings; confirm the import.
6. Verify transactions appear only in the selected account and the account page shows the UTC successful-import timestamp localized for the viewing user.
7. Cancel a review and verify `Accounts.ActiveImportId` is null and its `ImportReviewRows` are gone. For expiry, wait for the cleanup service's next one-minute pass, then verify the same conditions; audit events should contain only safe event metadata.
8. Sign in with an administrator and change one import limit. Verify the setting takes effect immediately without restarting the API. Sign in as an ordinary user and verify administrator settings are inaccessible.

If a review response is lost, retrying the import may report an active review. Choose
**Discard active review** only when the pending review is no longer needed, including in
other tabs, then retry. Discarding does not delete imported transactions. A ready review
otherwise holds the account lease until confirmation, cancellation, or its 15-minute expiry.
Failures before the review is saved roll back lease acquisition and staged data together.

## Roll back the import migration

The latest `ImportWorkflow` migration adds the transaction, import review, review-row, audit, and account-lease schema. Rolling back it drops these tables and therefore destroys imported transaction history and related import data. Back up the database and export any data that must be retained before running a rollback; do not use this as a routine deployment recovery strategy.

To return to the migration immediately before `ImportWorkflow`:

```powershell
dotnet ef database update 20261106224005_FamilyAccounts --project .\src\Clutch.API --startup-project .\src\Clutch.API
```

Verify the target and generated SQL with the database owner before applying this destructive rollback. To restore, reapply the latest migration with `dotnet ef database update`.

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

Playwright tests require a disposable application database and protected browser storage-state files supplied through `PLAYWRIGHT_STORAGE_STATE` (owner), `PLAYWRIGHT_OTHER_STORAGE_STATE` (different user), and `PLAYWRIGHT_ADMIN_STORAGE_STATE` (administrator). Keep these files outside the repository. The tests create an account, import duplicate rows, and temporarily update an import limit; they must not run against production data.

## Acceptance scenarios

- Create two accounts with different currencies; update a description without changing its currency.
- Reject account/transaction descriptions containing each identifier pattern without echoing the value in UI, API errors, or logs.
- Import signed amounts, separate incoming/outgoing columns, and explicit direction values; for separate columns verify positive and negative source values both import with the column's direction and positive magnitude. Validate date ambiguity and amount separator mismatch flows.
- Submit malformed, invalid, oversized, over-row-limit, cancelled, and concurrent imports; verify no partial writes and no retained source file.
- Confirm duplicate warnings are scoped to one account and require explicit confirmation.
- Verify a user can create only one Family, owns every account within it, and can view, import, and edit those accounts. A different signed-in user cannot access that Family, its accounts, transactions, or import reviews; no member-invitation or account-grant flow is available.
- Verify locale-specific transaction date/currency rendering, system light/dark theme changes, keyboard navigation, and WCAG 2.2 AA in browser tests.
- Verify admin-only limit settings, defaults (10 MiB, 10,000 rows, 5 attempts/user/minute), and runtime updates.

API shapes and error behavior are defined in [contracts/openapi.yaml](./contracts/openapi.yaml); entity fields and review transitions are defined in [data-model.md](./data-model.md).