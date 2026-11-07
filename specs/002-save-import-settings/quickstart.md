# Quickstart: Save Account Import Settings

## Prerequisites

- .NET 10 SDK.
- Docker available for the SQL Server Testcontainers integration tests.
- Node.js and npm; dependencies installed for `src/clutch-web`.
- An authenticated user with an owned Family and at least two accounts.

## Apply the migration

The VS Code F5 launch builds the API and applies pending migrations to the configured Development
database before starting it. Other application launches do not automatically apply migrations.
For those launches, apply the migration to the intended database using its protected connection
configuration:

```powershell
dotnet ef database update --project .\src\Clutch.API\Clutch.API.csproj
```

For local development, set `ASPNETCORE_ENVIRONMENT` to `Development` so EF Core loads the
development user secrets. Verify the database target before applying migrations.

## Validation commands

From the repository root in PowerShell:

```powershell
dotnet test .\tests\Clutch.API.Tests\Clutch.API.Tests.csproj --filter Category=SqlServer
npm --prefix .\src\clutch-web run test
npm --prefix .\src\clutch-web run typecheck
npm --prefix .\src\clutch-web run lint
npm --prefix .\src\clutch-web run build
npm --prefix .\src\clutch-web run test:e2e -- e2e/import-settings.spec.ts
```

The browser-level test is added with the feature implementation and uses the existing Playwright setup.

## Migration review and rollback

The `SaveAccountImportSettings` migration is additive: it adds the nullable latest-review token to
`Accounts` and creates the account settings and active-review snapshot tables. It does not update or
delete existing transaction data. Review the generated `Up` and `Down` methods before deployment.

To roll back, first deploy the application version that does not require these schema objects, then
run `dotnet ef database update 20261106231522_ImportWorkflow --project .\src\Clutch.API\Clutch.API.csproj`.
The migration's `Down` method drops both settings tables and the added token column. Any saved
import defaults and active mapping snapshots will be discarded, so export or back them up first if
they must be retained. Existing transactions remain unchanged.

## Acceptance scenarios

1. **First successful import**: Open an account with no saved settings, select a representative CSV, configure its mapping, review it, and confirm the import. Expect all validated rows to import and the account settings read to return the mapping used.
2. **Reuse defaults**: Select the same file for the same account in a later session. Expect a default-settings notice, an option to view/change settings, no mapping form shown by default, and a review produced using the saved mapping. Existing duplicate warnings and explicit confirmation remain active.
3. **Edit, cancel, or fail**: Open the settings form, change a mapping, then cancel or submit an invalid file. Expect the previous saved mapping to remain unchanged.
4. **Update after success**: Change a mapping and successfully confirm the import. Expect that mapping to replace only the selected account's previous defaults.
5. **Account isolation**: Save different mappings for two accounts. Expect each authorized settings read and subsequent import to use only its own account's mapping.
6. **Incompatible or unavailable settings**: Use a saved mapping whose columns do not fit the selected CSV, or simulate a settings retrieval error. Expect a clear user-visible message and an accessible path to the existing editable settings form; do not report defaults as active when retrieval failed.
7. **Defaults-save failure**: Simulate the settings upsert failing after transaction commit. Expect the response/UI to report successful transaction import and failed defaults save separately, with the old defaults unchanged.
8. **Authorization**: Attempt settings reads for another user's account. Expect the existing account authorization behavior and no settings disclosure.

For the API shapes and antiforgery/authentication requirements, see [contracts/openapi.yaml](./contracts/openapi.yaml). For the persistence and review lifecycle, see [data-model.md](./data-model.md).
