# Quickstart: Validation

Prerequisites: Docker (SQL Server integration fixture), Node, .NET 10 SDK.

```powershell
dotnet build
dotnet test --filter "FullyQualifiedName~Mortgage"
```

```powershell
cd src/clutch-web
npm run typecheck
npm run lint
npm test -- mortgages
npx playwright test e2e/mortgages.spec.ts
```

Expected:

- Domain unit tests: `PeriodBalances` covers weekly, fortnightly, monthly, irregular lengths, blank before the
  first and after the latest balance-bearing transaction, same-day order, and skipped null balances.
- Integration tests (SQL Server): `accountId` save, load, clear, foreign account 400, delete account → null;
  `period-balances` ownership 404, validation 400, fallback, bounded response; migration up and down.
- Component tests: drop-down options and order, dirty/cancel, column position and header, formatting,
  fallback rows, load failure, balances refetched after import and transaction delete (FR-011).
- Browser journey: link an account with seeded balances, see the column right of Bank Schedule; clear it
  and the column disappears; axe passes in both themes.
