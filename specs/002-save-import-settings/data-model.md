# Data Model: Save Account Import Settings

## Entities

### Account

Existing account and ownership model remains unchanged, with one additional concurrency token:

| Field | Type | Rules |
|---|---|---|
| LastSuccessfulImportReviewId | UUID, nullable | Opaque token set to the confirmed review ID in the same transaction that saves transactions; used to prevent an older delayed settings write from replacing newer defaults |

The token is not a user-visible account identifier. Existing server-side Family-owner authorization remains authoritative for settings reads and import operations.

### Import review

The existing short-lived review and row state remain unchanged. A related persistence snapshot holds the mapping while the review is active:

| Field | Type | Rules |
|---|---|---|
| ReviewId | UUID | Primary key and foreign key to the review |
| SchemaVersion | Integer | Required version for the serialized mapping shape |
| MappingJson | JSON text | Required; serializes the existing import mapping only while the review is active |

The snapshot records the mapping actually used to validate and stage the review. It is a persistence-layer record, so the domain review does not depend on the application/API mapping type. It contains no CSV, file header text, mapped transaction values, descriptions, account identifiers, or card identifiers, and is deleted when the review transitions to a terminal state.

State transitions remain `Ready -> Confirmed`, `Ready -> Cancelled`, or `Ready -> Expired`. A review that fails validation is not created; canceled, abandoned, rejected, expired, or failed reviews do not update account defaults.

### Account import settings

One current set of defaults per account:

| Field | Type | Rules |
|---|---|---|
| AccountId | UUID | Primary key and required foreign key to the account; enforces at most one record per account |
| SchemaVersion | Integer | Required version for the serialized mapping shape |
| SettingsJson | JSON text | Required; serializes the existing import mapping only |
| SourceImportReviewId | UUID | Required identifier for the successful review whose settings were saved |
| SavedAtUtc | UTC timestamp | Required; recorded only when the defaults upsert succeeds |

The mapping contains date and description column indexes, date and number formats, amount mode, and the mode-specific amount/direction columns and sign/value conventions. Validate it through the existing mapping/parser rules before it becomes active. A schema-version or deserialization failure is a retrieval failure, not an empty-default result.

## Relationships and ownership

- An account has zero or one `AccountImportSettings` record.
- A review belongs to one account and has one temporary mapping snapshot while it is `Ready`.
- Every settings read resolves account ownership through the existing Family ownership query. Unauthorized or unavailable accounts do not reveal another account's settings.

## Save lifecycle

1. The API reads settings for the selected owned account; an account with no row returns an explicit empty-settings result.
2. The frontend either uses the saved mapping or presents the existing editable mapping form. The API validates the mapping and stores a temporary snapshot with the active review.
3. Only after the existing confirmation transaction commits all transactions does the settings service attempt an atomic upsert.
4. The upsert checks that the account's latest-successful-import token still matches the review. A stale completion cannot replace newer defaults.
5. If persistence fails, the transaction import remains successful, the prior defaults remain unchanged, and the response tells the user that settings were not saved.
6. Terminal reviews clear their temporary mapping snapshot. Rejected, canceled, expired, and failed imports never create or change account defaults.

## Validation and integrity

- Persist configuration only; never persist original CSV content, unmapped data, row values, transaction descriptions, or card/account identifiers in settings.
- Enforce account uniqueness and referential integrity in SQL Server.
- Use EF Core async operations; use `AsNoTracking()` for settings reads.
- Apply an atomic, account-token-guarded settings upsert so a failed write preserves the previous row.
- Preserve existing CSV validation, review, duplicate warnings, explicit confirmation, import lease, and all-or-nothing transaction persistence.
