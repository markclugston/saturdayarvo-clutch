# Quickstart: Asset Register validation

Run from the repository root. SQL Server tests need Docker. Behaviour is defined in [contracts/assets-api.md](./contracts/assets-api.md) and [contracts/assets-ui.md](./contracts/assets-ui.md).

## Backend

```powershell
dotnet build saturdayarvo-clutch.slnx -v q -clp:ErrorsOnly
```

```powershell
dotnet test tests/Clutch.API.Tests -v q --filter "Category!=SqlServer&FullyQualifiedName~Assets"
```

```powershell
dotnet test tests/Clutch.API.Tests -v q --filter "Category=SqlServer&FullyQualifiedName~Assets"
```

Expected: all pass. The SqlServer tests prove:
- the list returns only the latest valuation per asset, in created order, with an exact total per currency and no sum across currencies;
- Save is all-or-nothing (a failure stores nothing; valuation add and remove plus rename commit together with their audit rows);
- unique valuation date and cascade delete;
- the lease: one active edit; Save vs End race (exactly one wins); a stale End never ends a newer edit; expiry frees the lease and refuses a late Save; delete blocked while an edit is active;
- owner isolation (404 for another user's asset or edit);
- one audit row appended per operation, including text longer than 500 characters stored in full in `nvarchar(max)`; the migration widens `Audit.Description` and keeps existing rows and the non-blank check constraint.

## Frontend

```powershell
cd src/clutch-web; npm run lint; npm test -- --reporter=dot; npm run build
```

```powershell
cd src/clutch-web; npx playwright test e2e/assets.spec.ts e2e/style-guide.spec.ts --reporter=line
```

```powershell
cd src/clutch-web; npx playwright test -c playwright.integration.config.ts e2e/asset-edit-lease.spec.ts --reporter=line
```

Expected scenarios:
- **assets.spec.ts (mocked)**: Assets nav item sits below Accounts; the list of 100 assets renders within 2 s of selecting Assets (SC-002); empty list with no total row; add an asset with a currency and a valuation (OK, Cancel, Save) and it appears last; the URL is `/assets/new` then `/assets`; edit adds and deletes valuations and the total updates; AUD and USD assets give separate "Total AUD" and "Total USD" rows; a JPY value field accepts no decimals; the dirty-leave prompt appears, including on browser Back; delete confirm and cancel; field errors for missing name, no currency, negative value, future or duplicate date, and no valuations.
- **asset-edit-lease.spec.ts (real API, two contexts)**: B is blocked while A edits; B uses End Other Edit; A sees the "Edit Ended" dialog naming the user within 5 s and returns to the list; B edits within 5 s. Expiry (test clock or short lifetime) sends A to the list with the persistent toast, which stays while other toasts come and go.
- **style-guide.spec.ts**: the persistent toast stack passes axe, focus and layout checks in both themes.

## Completion gates

```powershell
dotnet test tests/Clutch.API.Tests --no-build -v q --logger "console;verbosity=minimal"
```

```powershell
dotnet list saturdayarvo-clutch.slnx package --vulnerable --include-transitive
```

```powershell
cd src/clutch-web; npm audit --omit=dev
```

Also required: independent query review, migration review and OWASP security review, plus the UI compliance checklist in [plan.md](./plan.md).
