# Data Model: Asset Register

Three new tables and one change to `Audit`. Migration `AddAssets` creates the tables and widens `Audit.Description`. Down drops the three tables (losing only asset data created after deploy) and leaves `Audit.Description` wide (research R2).

## Audit (`Audit`, changed)

| Column | Before | After |
|---|---|---|
| Description | `nvarchar(500)`; domain check ≤ 500 | `nvarchar(max)`; domain check: not blank only. `CK_Audit_NonBlankDescription` kept. |

Existing rows keep their exact content. The migration drops `CK_Audit_NonBlankDescription`, alters the column and recreates the constraint, because SQL Server refuses `ALTER COLUMN` on a column a check constraint references (research R2).

## Asset (`Assets`)

| Column | Type | Rules |
|---|---|---|
| Id | uniqueidentifier PK | |
| OwnerUserId | nvarchar(450) | required; FK to Identity user |
| Name | nvarchar(100) | required, trimmed, 1–100 (FR-007) |
| Description | nvarchar(500) NULL | trimmed; empty → NULL; ≤ 500 |
| CurrencyCode | nvarchar(3) | required; set at creation and never changed (FR-007); one of `Currency.All`; check constraint `CK_Assets_SupportedCurrency` with the same list as `CK_Accounts_SupportedCurrency` (research R9) |
| CreatedAtUtc | datetimeoffset | list order (FR-002) |
| ActiveEditId | uniqueidentifier NULL | lease pointer to `AssetEdits.Id`; not an FK (mirrors `Accounts.ActiveImportId`) |

Index: `IX_Assets_OwnerUserId_CreatedAtUtc` (OwnerUserId, CreatedAtUtc, Id).

## AssetValuation (`AssetValuations`)

| Column | Type | Rules |
|---|---|---|
| Id | uniqueidentifier PK | |
| AssetId | uniqueidentifier FK → Assets, cascade delete | |
| Value | decimal(18,2) | ≥ 0, ≤ 999,999,999,999.99, no more decimal places than the asset currency's `MinorUnits` (FR-008, research R9) |
| ValuationDate | date | not in the future, using the same UTC+14 latest-date rule as `MortgageValidator` (disbursal date). The UI checks against the user's local date (`localToday`, as `loanDraft.ts` does), which is never later than the server limit, so anything the UI accepts the server also accepts. |

- Unique index `IX_AssetValuations_AssetId_ValuationDate` (AssetId, ValuationDate DESC) INCLUDE (Value): unique dates (FR-009) plus the latest-valuation lookup (FR-003/004).
- Asset invariant: one or more valuations at Save.
- Existing valuations are immutable (delete and re-add).

## AssetEdit (`AssetEdits`)

| Column | Type | Rules |
|---|---|---|
| Id | uniqueidentifier PK | the edit token the client holds |
| AssetId | uniqueidentifier FK → Assets, cascade delete | |
| OwnerUserId | nvarchar(450) | |
| State | varchar(16) + check constraint | `Active`, `Saved`, `Released`, `Ended`, `Expired` |
| OpenedAtUtc | datetimeoffset | |
| ExpiresAtUtc | datetimeoffset | OpenedAtUtc + 5 min |
| EndedByUserId | nvarchar(450) NULL | set only on the transition to `Ended`; NULL in every other state |
| EndedAtUtc | datetimeoffset NULL | the time the edit left `Active` by `Ended` or `Expired` (for `Expired`, when acquire or release persisted the transition, not `ExpiresAtUtc`); NULL for `Active`, `Saved` and `Released` |

Index: `IX_AssetEdits_AssetId_State`.

### State transitions (all conditional updates in one transaction)

```text
(none) --acquire: asset.ActiveEditId null OR its edit terminal/expired--> Active  [asset.ActiveEditId = id]
Active --save (unexpired, asset.ActiveEditId = id)--> Saved     [ActiveEditId = null; data + audit committed]
Active --release by holder (unexpired)--> Released             [ActiveEditId = null]
Active --release by holder, now >= ExpiresAtUtc--> Expired     [EndedAtUtc = now; ActiveEditId = null if it is this id]
Active --end by other session (exact id, unexpired)--> Ended    [ActiveEditId = null; EndedBy/At; audit AssetEditEnded]
Active --now >= ExpiresAtUtc, persisted by the next acquire--> Expired [EndedAtUtc = now; ActiveEditId = new edit id]
```

- **Effective expiry**: an `Active` row with `ExpiresAtUtc <= now` is expired everywhere, whether or not the row has been marked yet. Acquire treats it as free and persists `Expired` in the same conditional update that takes the lease. Status reports it as `Expired` and Save refuses it with 409 `AssetEditExpired`; neither writes (read endpoints never write). Delete treats it as no active edit, and the cascade removes it. Expiry is not audited (imports do not audit expiry); it is counted in `AssetMetrics`.
- **Release**: the holder's release of an unexpired `Active` edit persists `Released`. A release of an effectively expired `Active` edit persists `Expired` instead (never `Released`), so expiry stays distinguishable from release (012 FR-012). A release of an edit already terminal changes nothing and returns 204.
- **Expired-edit metric**: incremented exactly once per edit, by whichever conditional update persists `Expired` (acquire or release). An expired edit removed by asset delete before either runs is not counted.
- Terminal states never change again. End requests naming a terminal or non-current edit return `AssetEditChanged` (never end a newer edit).
- Acquire also deletes terminal edits of that asset whose `COALESCE(EndedAtUtc, OpenedAtUtc)` is more than 24 h before now (research R4). `Ended` and `Expired` edits are therefore kept 24 h from when they left `Active`, including an `Expired` persisted by the same acquire; `Saved` and `Released` edits (which have no `EndedAtUtc`) are kept 24 h from opening, at most 5 minutes before they finished.
- **`Unavailable`** is not a stored state. Status returns it in `watchedEdit` when the requested `editId` has no row for this asset (cleaned up, or never existed for it).
- Asset delete: allowed only when there is no `Active` edit with `ExpiresAtUtc > now` (an edit that has expired but is still marked `Active` does not block); cascades valuations and edits. A delete refused with 409 `AssetEditActive` writes nothing, including no audit row (imports audit only a refused concurrent start); it is counted in `AssetMetrics` as a delete with outcome `EditActive`.

## Audit events (rows in `Audit`)

One row per operation:

| Event | Description text contains |
|---|---|
| `AssetCreate` | asset id, name, description (if any), currency, each valuation added (value and date) |
| `AssetUpdate` | asset id, old and new name when changed, old and new description when changed, each valuation added and each removed (value and date) |
| `AssetDelete` | asset id, name, description (if any), currency, each valuation removed with the asset (value and date) |
| `AssetEditRejected` | asset id, the rejected session's user, the active edit id |
| `AssetEditEnded` | asset id, ended edit id, the user who ended it |

Text built by `Domain/Assets/AssetAuditText.cs`; values formatted with the asset currency's minor units followed by the currency code (for example `12000.00 AUD`, `5000 JPY`), and dates as ISO `yyyy-MM-dd`.
