# Quickstart: Validate Single-Person Data Access

## Prerequisites

- .NET 10 SDK.
- Node.js and npm for `clutch-web`.
- Docker available to run the SQL Server Testcontainers integration tests.
- Dependencies restored for the API, test, and frontend projects.

## Validation scenarios

Run API and SQL Server integration tests from the repository root:

```powershell
dotnet test tests/Clutch.API.Tests/Clutch.API.Tests.csproj
```

Expected outcomes:

- An authenticated individual can create, list, read, and update multiple accounts without creating a family, and can read their transaction pages.
- An authenticated individual can retrieve import settings, create CSV import reviews, and confirm or cancel reviews for their accounts.
- A different individual cannot read or change those accounts, transactions, import settings, or reviews.
- The migration retains accounts and their linked data, maps known owners to the same individuals, and leaves accounts whose legacy Family owner does not resolve to an Identity user inaccessible. The migration test simulates this inconsistent state by disabling the Family-to-Identity foreign key for fixture insertion while keeping the account-to-Family reference valid.
- No user-facing owner-resolution flow is added. An authorized out-of-band data repair can assign a valid owner; verify only that owner can access the repaired account and linked data.
- A downgrade preserves mapped ownership and refuses to proceed if ownerless accounts cannot be represented by the prior schema.
- Removed family routes are no longer part of the application.

Run frontend checks from `src/clutch-web`:

```powershell
npm run typecheck
npm run lint
npm test
```

Expected outcomes:

- Strict TypeScript checks and lint complete without errors or warnings.
- Component tests cover direct account access without a family setup screen.
- Runtime API schemas accept the account response without `familyId`.

Run browser-level tests from `src/clutch-web`:

```powershell
npm run test:e2e
```

Run the real API-backed account privacy journey independently:

```powershell
npm run test:e2e:ownership
```

This command requires Docker and the .NET 10 SDK. It starts an isolated SQL Server container with a temporary password, applies the API migrations, starts the API and frontend, and removes the container when the browser test exits. It does not use or create Playwright storage-state files. Expected outcomes are that two users are registered and signed in through the API, the first user creates and reads an account, and the second user receives `404` without seeing the account data.

The broader `npm run test:e2e` suite continues to use the configured local API and optional owner/other-user storage states for its authenticated import journey.

Run dependency vulnerability checks:

```powershell
dotnet list src/Clutch.API/Clutch.API.csproj package --vulnerable --include-transitive
dotnet list tests/Clutch.API.Tests/Clutch.API.Tests.csproj package --vulnerable --include-transitive
npm audit
```

Run the npm command from `src/clutch-web`. Address reported vulnerabilities or record unresolved findings as blockers; unavailable or failing checks are not considered passed.

## Related design

See [account-ownership.md](contracts/account-ownership.md) for user-visible API and authorization behavior and [data-model.md](data-model.md) for the account ownership and legacy-data rules.
