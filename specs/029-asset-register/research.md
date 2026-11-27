# Research: Asset Register

One entry per decision the spec or code left open.

## R1 Asset page URL

- **Decision**: Use the History API from a small `features/assets/assetRoute.ts` module. Paths: `/assets` (list), `/assets/new` (add), `/assets/{id}` (edit). `App.tsx` reads the path at startup and on `popstate`; choosing another nav item pushes `/`. A Back/Forward that would leave a dirty asset goes through `useUnsavedChanges().run`; if the user stays, the asset path is pushed back.
- **Rationale**: The clarification requires the Asset page to have its own URL. The app has no router today (pages are `App.tsx` state), so a scoped History API module meets the requirement with no new dependency and no change to other pages.
- **Alternatives**: React Router (new dependency, needs a security review, and is an app-wide refactor nobody asked for, ARC-001). State only, with no URL (breaks the clarification).

## R2 Audit description limit

- **Decision** (user direction 2026-11-27: make the audit column unlimited): change `Audit.Description` from `nvarchar(500)` to `nvarchar(max)`, and remove the 500-character check in `Domain/Audit/Audit.cs` (keep the non-blank check). Each operation writes one `Audit` row in the same transaction as the data: `AssetCreate`, `AssetUpdate` (new and old name and description when changed, plus each valuation added or removed with its value and date), `AssetDelete`, `AssetEditRejected` and `AssetEditEnded`. Expiry is not audited, as import expiry is not (FR-020 audits rejected and ended edits only); it is counted in `AssetMetrics`.
- **Why `nvarchar(max)` and not `ntext`**: SQL Server deprecated `ntext`. `LTRIM` and `RTRIM` reject it, so the existing `CK_Audit_NonBlankDescription` constraint (`LEN(LTRIM(RTRIM([Description]))) > 0`) would fail to apply. `nvarchar(max)` gives the same unlimited length and keeps the constraint.
- **Migration**: An `ALTER COLUMN` that widens the column. SQL Server refuses `ALTER COLUMN` on a column a check constraint references, and EF's generated `AlterColumn` does not drop check constraints, so Up must drop `CK_Audit_NonBlankDescription`, alter the column, then recreate the constraint with the same name and expression, in the same migration. Existing rows keep their exact text; SQL Server may move the storage during the type change, but no row's content changes and no DML guard fires (AUD-001). Rollback: Down leaves the column wide, because narrowing would truncate or reject audit rows written after deploy, and audit rows must never be changed.
- **Alternatives**: Splitting long text across several 500-character rows (replaced by this direction). Truncating the text (fails FR-018).

## R3 Edit lease storage and atomicity

- **Decision**: Put the lease in `Assets.ActiveEditId`, with an `AssetEdits` row per opened edit, mirroring `Accounts.ActiveImportId` plus `ImportReviews` (`Infrastructure/Imports/AccountImportLease.cs`). Acquire, end and release are conditional `ExecuteUpdate` calls. Save claims the edit (`Active` → `Saved`, `ActiveEditId` cleared) in the same transaction that writes the asset, its valuations and the audit rows. There is no persisted `Processing` state.
- **Rationale**: Imports needed `Processing` because confirmation does long work. An asset Save is a single short transaction, so the row lock on the edit makes Save and End mutually exclusive, and "accepted" means "committed".
- **Alternatives**: Optimistic `Version` only, as mortgages use (does not meet FR-020's one-active-edit and end-other rules). A distributed lock (new infrastructure).

## R4 Expiry handling

- **Decision**: Edits expire 5 minutes after opening (same constant as `ImportReviewService.ReviewLifetime`). Expiry is evaluated lazily: an `Active` edit with `ExpiresAtUtc <= now` counts as expired everywhere, whether or not its row says so yet. Acquire treats it as free and persists the transition (`Expired`, `EndedAtUtc`, `ActiveEditId` replaced) in its conditional update; status reports it as `Expired` and Save returns 409 `AssetEditExpired`, both without writing; Delete treats it as no active edit and the cascade removes it; a holder's release of it persists `Expired`, not `Released`. Read endpoints never write. The client also runs a timer from the server-supplied `expiresAtUtc` and `serverTimeUtc`, so it leaves at expiry even without a poll. Terminal edit rows whose `COALESCE(EndedAtUtc, OpenedAtUtc)` is more than 24 hours old are deleted for that asset when a new edit is acquired. No hosted service.
- **Rationale**: Gives correct behaviour without a background job. Ended and expired headers are kept long enough for a returning session to learn what happened.
- **Alternatives**: Extending `ImportReviewCleanupService` (couples unrelated areas). A new `BackgroundService` (more operational surface for no behavioural gain).

## R5 Persistent expiry toast

- **Decision**: Extend `components/ui/toast.tsx` with a second Base UI toast manager for persistent notices (`timeout: 0`), rendered in its own stack at the toast edge with the regular viewport placed directly above it, so other toasts show above the persistent one as the spec requires. `useToast()` gains `showPersistent(message)`. Regular toasts keep their 3-toast limit and 5-second timeout, and cannot replace or hide persistent ones.
- **Rationale**: With one manager, `limit={3}` would push the expiry toast out when other toasts arrive, which the spec forbids.
- **Alternatives**: Raising the shared limit (still finite). A separate non-toast banner (inconsistent with the clarification).

## R6 List and total query

- **Decision**: One no-tracking projection per owner, ordered by `CreatedAtUtc, Id`, with a correlated `Valuations.OrderByDescending(ValuationDate).Take(1)` sub-select. It is supported by the index `IX_AssetValuations_AssetId_ValuationDate` (unique, `Value` included). The server groups the returned latest values by asset currency, sums each group in `decimal`, and returns `totals` ordered by currency code, each `totalValue` a decimal string with exactly the currency's minor units (R9), because a sum is unbounded and a JavaScript number is exact only to about 15 significant digits. Individual values stay JSON numbers under the established 999,999,999,999.99 cap; the UI turns each into a decimal string with `value.toFixed(minorUnits)` (exact under the cap) before `formatCurrencyAmount`, which takes a decimal string.
- **Rationale**: Meets FR-003 (latest only) in one round trip, and SC-003 (exact to the smallest unit) with no client floating-point sum and no sum across currencies.

## R7 Save payload shape

- **Decision**: Save sends the full desired valuation set. Existing items carry their `id`; new items have no `id`. The server diffs the set to find adds and removes, and rejects unknown or foreign ids as field errors. The request size limit is 64 KB.
- **Rationale**: Validating "at least one" and "unique dates" needs the final set. Diffing gives the exact added and removed items for audit.

## R8 Spec assumption with no matching code

- The spec originally assumed "the last-visited page preference covers Assets". No such preference exists: `Domain/Preferences/NavigationState.cs` stores only Pinned or Unpinned. Nothing is added (ARC-001). `/assets` URLs give the reload behaviour instead. The spec assumption was corrected to match (analysis 2026-11-27).
- The spec also assumed "the user's single display currency". No such setting exists: currency belongs to each account (`Domain/Accounts/Account.cs`). Resolved by R9 (user direction 2026-11-27).

## R9 Asset currency

- **Decision** (user direction 2026-11-27: currency per asset): `Assets.CurrencyCode` is required and limited to `Domain/Shared/Currency.cs` (`Currency.TryGet`), with a `CK_Assets_SupportedCurrency` check constraint matching `CK_Accounts_SupportedCurrency`. The Asset page uses the same `FloatingField as="select"` currency selector as `features/accounts/AccountsPage.tsx`, filled from the existing GET `/api/currencies` (`getCurrencies` in `features/accounts/api.ts`). The currency is chosen when the asset is added and never changes afterwards (user direction 2026-11-27): the edit page shows it as text, and a Save naming a different currency is refused.
- **Decimal places**: a value may have at most the currency's `MinorUnits` decimals (2 for most, 0 for JPY), on the server (`AssetValidator`) and in the UI. `FormattedNumberField`'s `clean` fixes 2 decimals today, so it gains an optional `decimals` prop (default 2, so existing callers are unchanged) that the valuation dialog sets from the asset's currency, keeping WEB-001's rule that the field never displays characters that cannot form a valid value.
- **Totals**: one total per currency, ordered by currency code, labelled "Total {code}"; never summed across currencies (no exchange rates exist). An empty list has no total row.
- **Alternatives**: Always AUD (rejected by the user). One register-wide currency (a new preference nobody asked for, ARC-001).

## R10 End Other Edit eligibility

- **Decision**: `EditStatus.activeEdit` has no `canEnd` flag. Imports needed one because a confirmed import is `Processing` and cannot be ended. An asset Save commits in one transaction (R3), so an `Active`, unexpired edit has never had its Save accepted and can always be ended; a Save that commits first makes the End return 409 `AssetEditChanged`. Whenever the status is `Blocked`, End Other Edit is offered.
