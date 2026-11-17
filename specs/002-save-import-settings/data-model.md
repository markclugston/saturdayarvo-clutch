# Data Model: Save Account Import Settings

## Entities

### Account

The account retains its last-successful-import timestamp as account metadata. No completed review identifier is retained. Server-side account-owner authorization remains authoritative for settings reads and import operations.

### Import review

The review holds its mapping directly while active; there is no separate mapping-snapshot table:

| Field | Type | Rules |
|---|---|---|
| SchemaVersion | Integer | Version for the serialized mapping shape |
| MappingJson | JSON text | Serializes the existing import mapping only while the review is active |

The mapping is the one actually used to validate and stage the review. The domain review stores opaque JSON and does not depend on the application/API mapping type. Mapping fields contain no CSV or transaction values and are deleted with the review. Both fields are nullable only to preserve legacy reviews without snapshots; confirmation rejects such reviews and cleans them up.

State transitions remain `Ready -> Confirmed`, `Ready -> Cancelled`, or `Ready -> Expired`. A review that fails validation is not created; canceled, abandoned, rejected, expired, or failed reviews do not update account defaults.

### Account import settings

One current set of defaults per account:

| Field | Type | Rules |
|---|---|---|
| AccountId | UUID | Primary key and required foreign key to the account; enforces at most one record per account |
| SchemaVersion | Integer | Required version for the serialized mapping shape |
| SettingsJson | JSON text | Required; serializes the existing import mapping only |
| SavedAtUtc | UTC timestamp | Required; recorded only when the defaults upsert succeeds |

The mapping contains date and description column indexes, date and number formats, amount mode, and the mode-specific amount/direction columns and sign/value conventions. Validate it through the existing mapping/parser rules before it becomes active. A schema-version or deserialization failure is a retrieval failure, not an empty-default result.

## Relationships and ownership

- An account has zero or one `AccountImportSettings` record.
- A review belongs to one account and contains its temporary mapping while it is `Ready`.
- Every settings read resolves account ownership. Unauthorized or unavailable accounts do not reveal another account's settings.

## Save lifecycle

1. The API reads settings for the selected owned account; an account with no row returns an explicit empty-settings result.
2. The frontend either uses the saved mapping or presents the existing editable mapping form. The API validates the mapping and stores it on the active review.
3. Confirmation saves transactions, settings, the audit event, and review cleanup in one serializable transaction.
4. The account lease and transaction serialize imports so older settings writes cannot overwrite newer confirmations.
5. If persistence fails, the import and settings changes roll back, the failed review is removed, and prior defaults remain unchanged.
6. Terminal reviews and their mappings are deleted. Rejected, canceled, expired, and failed imports never create or change account defaults.

## Validation and integrity

- Persist configuration only; never persist original CSV content, unmapped data, row values, transaction descriptions, or card/account identifiers in settings.
- Enforce account uniqueness and referential integrity in SQL Server.
- Use EF Core async operations; use `AsNoTracking()` for settings reads.
- Save settings atomically with confirmation so a failed write preserves the previous row.
- Preserve existing CSV validation, review, duplicate warnings, explicit confirmation, import lease, and all-or-nothing transaction persistence.
