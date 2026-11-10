# Quickstart: Validating the Balance Field

All checks are agent-executable.

## Prerequisites

- .NET 10 SDK, Node.js, and a container runtime for integration tests.

## Backend

```powershell
dotnet test
```

Expect passing tests for: mapping validation (balance column range/duplicates), CSV parsing (valid, negative, empty, invalid balance, unmapped), review → confirm carrying balance, transaction list returning `balance`, legacy saved settings without `balanceColumn`.

## Frontend

```powershell
cd src\clutch-web
npx tsc --noEmit
npm run lint
npm test -- --run
npm run build
```

Expect passing tests for: optional balance select in the mapping form and saved value restored, Balance column right-most after Amount, column hidden when no listed transaction has a balance, blank cells for missing balances.

## End to end

```powershell
cd src\clutch-web
npx playwright test e2e/import-settings.spec.ts
```

Scenario: import a CSV with a balance column mapped, view the transaction list (Balance right-most), start a second import and confirm the balance mapping is preselected; import a CSV without mapping into another account and confirm no Balance column.

See [contracts/api-changes.md](./contracts/api-changes.md) and [data-model.md](./data-model.md).
