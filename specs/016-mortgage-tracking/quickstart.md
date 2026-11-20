# Quickstart: Validating the Mortgages Screen

Agent-executable only. Details: [data-model.md](data-model.md), [contracts/](contracts/).

## Prerequisites

- .NET 10 SDK, Node.js, Docker (SQL Server fixture), `npm ci` in `src/clutch-web`.

## API

```powershell
dotnet build saturdayarvo-clutch.slnx -v q -clp:ErrorsOnly
```

```powershell
dotnet test tests\Clutch.API.Tests -v q --filter "Category!=SqlServer&FullyQualifiedName~Mortgage"
```

```powershell
dotnet test tests\Clutch.API.Tests -v q --filter "Category=SqlServer&FullyQualifiedName~Mortgage"
```

Expect: final repayment date vectors (1 Jan 2000 × 360 monthly → 1 Dec 2029; 31 Jan monthly clamps
to month end; overflow past 31 Dec 9999 flagged); every FR-007 rule rejected with its field key;
trimmed case-insensitive duplicates refused; 21st mortgage and 61st rate change refused; stale
version → 409 on PUT and DELETE; other user's id → 404; exactly one audit row per create, update,
delete with no amounts in the description; migration applies and rolls back on SQL Server.

## Frontend

```powershell
cd src\clutch-web; npm run lint; npm test -- --reporter=dot; npm run build
```

Expect component tests for: nav order, loading and load-failure states, empty state messages,
add-row gating and 60-row cap, field errors and kept values, Cancel, tab switch guard, delete
dialog focus return, 409 Reload flow, session-expired dialog, toast timing, schedule N + 1 rows
(windowed), chart text alternative.

## Browser

```powershell
cd src\clutch-web; npx playwright test e2e/mortgages.spec.ts --reporter=line
```

```powershell
cd src\clutch-web; npx playwright test --config playwright.style-guide.config.ts --reporter=line
```

Journey: open Mortgages, add a mortgage with two rate changes, see toast and tab, reload and confirm
persistence, sign out and back in and confirm the values are unchanged, add a second, switch tabs, rename, edit with unsaved changes and try to switch (stay,
then discard), delete with cancel then confirm, 320 px and desktop widths, Light/Dark/System, axe clean.

## Review gates

- Independent query and migration review (`clutch-data-access`).
- Independent security review incl. `dotnet list saturdayarvo-clutch.slnx package --vulnerable --include-transitive` and `npm audit --omit=dev`.
- UI compliance checklist from [plan.md](plan.md).
