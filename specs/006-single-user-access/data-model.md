# Data Model: Single-Person Data Access

## Account

Represents one financial account managed through the application.

| Field | Type | Constraints and meaning |
|---|---|---|
| `Id` | Guid | Unique account identifier. |
| `OwnerUserId` | Identity user identifier, nullable for legacy records | Identifies the one individual authorized to access this account. New accounts require the authenticated user's identifier. A null value represents retained legacy data whose owner cannot be resolved; user-facing account operations must not return or modify it. |
| `Description` | String | Required, nonblank, maximum 200 characters; existing validation remains in effect. |
| `CurrencyCode` | String | Required supported currency code; existing validation remains in effect. |
| `LastSuccessfulImportAtUtc` | Nullable date/time | Existing successful import timestamp. |
| `LastSuccessfulImportReviewId` | Nullable Guid | Existing link to the last successful import review. |
| `ActiveImportId` | Nullable Guid | Existing import-in-progress association. |

### Relationships

- Each owned account references exactly one Identity user. One individual may own zero or more accounts.
- An unassigned legacy account has no user access until an authorized out-of-band data repair assigns a valid owner. This feature does not add a user-facing owner-resolution workflow.
- Transactions, import settings, reviews, review rows, and audit records remain associated with their account through their existing account relationships. Their ownership is enforced through the owning account.
- Deleting an Identity user must not cascade-delete account or financial data; preserve restrictive deletion behavior.

### State and validation rules

- **Owned**: `OwnerUserId` identifies the individual. Reads and writes are allowed only when it matches the authenticated individual.
- **Unassigned legacy**: `OwnerUserId` is null. It remains stored and is excluded from all ordinary user account and related-data operations. An authorized out-of-band data repair may assign a valid owner; after repair, the normal owner checks apply, and other users remain denied.
- New accounts cannot be created without an authenticated owner.
- The schema migration backfills owner IDs only when the existing Family owner identifier resolves to an Identity user before dropping that relation. An inconsistent legacy Family owner reference that does not resolve is migrated as `OwnerUserId = null`; the migration must not delete accounts or account-linked data.
- A downgrade recreates one family per resolved owner and maps that owner's accounts to it. It must stop before changing data if any account has no owner, because the prior schema cannot represent unassigned accounts.

## Removed entity

`Family` is removed. It currently represents only a single owner's grouping record and is not needed to express account ownership or support multiple accounts.
