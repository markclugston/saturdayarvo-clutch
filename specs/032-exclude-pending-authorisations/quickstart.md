# Quickstart: Exclude Pending Authorisations From Imports

Run from the repository root. Integration tests need Docker (SQL Server fixture, `docs/code-map.md`).

```powershell
dotnet build
dotnet test tests/Clutch.API.Tests --filter "FullyQualifiedName~Imports"
```

Expect: `ImportExclusionsTests` cover spec stories 1–2 and every Edge Case; `ImportWorkflowTests` show excluded rows absent after confirm, other rows saved, an all-excluded file confirming with `importedCount` 0, and excluded rows never in duplicate `rowNumbers`.

```powershell
cd src/clutch-web; npm run lint; npm run typecheck; npm test
```

Expect: `ImportReviewTable.test.tsx` shows the "Will Not Be Imported" chip only on excluded rows and "3 transactions will be imported" for 5 rows with 2 excluded (story 3).

```powershell
cd src/clutch-web; npm run test:e2e:style-guide
```

Expect: the import review state with an excluded row passes axe and focus checks in both themes.
