# Validation: Asset Register (2026-11-27)

## Quality gates (T064)

| Gate | Result |
|---|---|
| `dotnet build saturdayarvo-clutch.slnx` | 0 warnings, 0 errors |
| `dotnet test tests/Clutch.API.Tests` (all, including Docker SQL Server) | 576 passed |
| `dotnet list package --vulnerable --include-transitive` | No vulnerable packages |
| `npm run lint` | Passed |
| `npm test` | 998 passed |
| `npm run build` | Passed |
| `npm audit --omit=dev` | 0 vulnerabilities |
| Mocked browser journeys (`playwright test`) | 60 passed and 1 failed (keyboard order did not expect Assets); `navigation.spec.ts` updated and rerun, 36 passed |
| Real-API browser journeys (`playwright.integration.config.ts`) | 38 passed |
| Style-guide browser states | 308 passed and 2 failed (sideways scroll at 320 px); fixed in `AssetsPage.tsx`, Assets and toast states rerun, 36 passed |

Screenshot comparison (`STYLE_SCREENSHOTS=1`) is opt-in. Baselines for the new Assets states were
added. Older baselines no longer match: the one inspected (accounts, Light) predates the current
logo, navigation and Title Case labels. They were not regenerated.

Tests-first: the foundational backend tests were run and seen to fail before implementation. Later
tests were written before or alongside their code without a recorded failing run.

## Query review (T060, DOT-002)

A separate pass by the implementing agent over the generated SQL.

| Query | Outcome |
|---|---|
| List | One statement; each latest value is a seek on `IX_AssetValuations_AssetId_ValuationDate` (covering). Plan checked with 100 own assets, 2,000 others and 100,000 valuations. Assets themselves were scanned by clustered index at that size. |
| Edit status | **Fixed**: the first version numbered rows over all of `AssetEdits` on every 2 s poll. Now one statement joining only this asset's active and watched rows by `AssetId`. |
| Delete | **Fixed**: was one `DELETE` per valuation. Now one statement with database cascade. |
| Acquire, save, end, release | Keyed seeks. Each writer locks the asset row first, so lease operations are serialized per asset in one lock order. No N+1. |

No query updates or deletes an audit row.

## Migration review (T061, OPS-001, AUD-001)

- `AddAssets` runs in one transaction: drop `CK_Audit_NonBlankDescription`, widen
  `Audit.Description` to `nvarchar(max)`, recreate the constraint, create three tables and indexes.
- Data loss: none. The migration test confirms an existing audit row is unchanged, blank text is
  still refused and updates are still blocked.
- Operational note: widening to `nvarchar(max)` rewrites `Audit` and holds a schema lock while it
  does. Apply during a quiet period if the table is large.
- Rollback: Down drops the three asset tables (asset data created since deploy is lost) and leaves
  the column wide. The previous application version works against the wide column.
- No pending model changes after the migration.

## Security review (T062, SEC-001..004)

A separate pass by the implementing agent over the diff, not a second reviewer. No blocking findings.

- Every endpoint requires sign-in; every query is scoped to the owner before any edit is touched;
  foreign and unknown assets and edits return 404.
- Antiforgery on every mutation; 64 KB limit on POST and PUT, declared or chunked.
- Every field is validated on the server before database work; UI rules match.
- Logs and metric tags carry ids, operations and outcomes only. Errors are ProblemDetails.
- Names and descriptions render as text. Persistent toasts are cleared when the sign-in ends.
- No new packages, secrets or third-party UI code.

## UI compliance (T063, plan §11)

All checklist items hold: lint (tokens, borders, motion, numeric alignment), component tests
(formatted field, alignment), and browser states in both themes (axe WCAG 2.2 AA, focus ring,
surfaces, no pure black or white, no sideways scroll, toast layout).

## Fixed asset currency (T069..T073)

A saved asset's currency can no longer change. The new integration test and the two edit-page
component tests were seen to fail before the code changed.

| Gate | Result |
|---|---|
| `dotnet build saturdayarvo-clutch.slnx` | 0 warnings, 0 errors |
| `dotnet test tests/Clutch.API.Tests` (all) | 576 passed |
| `npm run lint` | Passed |
| `npm test` | 999 passed |
| `npm run build` | Passed |
| `assets.spec.ts` (mocked) | 10 passed |
| `asset-edit-lease.spec.ts` (real API) | 2 passed |
| Style-guide Assets states, with screenshots | 32 passed; edit-page baselines regenerated |
| Dependency scans | Not rerun: no dependency changed |

- Query review: no new or changed query. The comparison is made in memory on the asset Save already
  loads, `CurrencyCode` is no longer updated, and there is no migration or model change.
- Security review (self, separate pass): the server refuses the change after the owner-scoped lock,
  rolls the edit claim back and returns only a field message.
- UI compliance: the currency line uses existing text tokens as `AccountDetails` does; the Assets
  states pass in both themes.

## Notes

- `GET /api/currencies` now returns `minorUnits`, which the UI contract relies on.
- The build writes its files under `/assets/`, which is also the new page URL. `vite preview` serves
  the page correctly at `/assets` and below. No hosting configuration is in the repository, so the
  production web server must fall back to `index.html` for those paths.
