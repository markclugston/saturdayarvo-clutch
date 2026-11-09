# Account Ownership Contract

## Authentication and authorization

- Existing account routes continue to require an authenticated session.
- The server derives the owning individual from the authenticated identity; clients cannot choose or override the owner.
- Account reads and writes, including transaction and import operations, are limited to accounts whose owner matches the authenticated individual.
- An account with no resolved owner is unavailable to ordinary users until an authorized out-of-band data repair assigns a valid owner; this feature provides no user-facing owner-resolution workflow.
- Requests for another individual's account do not disclose the account or its related data.

## Account routes

The existing `/api/accounts` collection and account detail routes remain the user-facing account interface. Account creation no longer requires a prior family-creation request.

The account response contains:

| Field | Meaning |
|---|---|
| `id` | Account identifier. |
| `description` | User-facing account description. |
| `currencyCode` | Account currency code. |
| `lastSuccessfulImportAtUtc` | Optional successful-import timestamp. |

`familyId` is removed from the response and from the frontend runtime schema. The owner identifier is not exposed as a client-selectable field.

## Removed routes and behavior

- `/api/families` is removed; clients must not create or retrieve family containers.
- The frontend no longer presents a family-creation step before account access.
- No invitation, membership, or shared-access route is supported.
