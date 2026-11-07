# Data Model: Import Bank Transactions

## Entities

### Application user

ASP.NET Core Identity user.

| Field | Type | Rules |
|---|---|---|
| Id | Identity key | Primary key |
| UserName / Email | Identity fields | Unique according to Identity configuration |
| Roles | Identity role relation | `Administrator` is required for global import-limit settings |

Authentication credentials are managed by Identity and are never exposed to the browser as persistent JavaScript-readable tokens. Initial administrator provisioning uses protected deployment/bootstrap configuration.

### Family

| Field | Type | Rules |
|---|---|---|
| Id | UUID | Primary key |
| OwnerUserId | Identity key | Required, unique for this feature; creator is the non-removable owner |

One Family contains many accounts. An authenticated user can create at most one Family in this feature; invitations and other members are out of scope. Future multi-Family membership and per-account view/edit grants require a separate design and must not be enabled by this feature.

### Account

| Field | Type | Rules |
|---|---|---|
| Id | UUID | Primary key |
| FamilyId | UUID | Required foreign key to the owner's Family |
| Description | String | Required, non-blank, bounded length; financial identifier validation on every write |
| CurrencyCode | ISO 4217 code | Required at creation; immutable |
| LastSuccessfulImportAtUtc | UTC timestamp | Nullable; updated only when an import commits successfully |
| ActiveImportId | UUID, nullable | Database-coordinated single active import lease; lease expires with its review |

Relationships: one Family; many transactions. The Family owner can view and edit every account and import transactions; all other users are denied. Every access check is server-side and resolves account ownership through the Family.

### Transaction

| Field | Type | Rules |
|---|---|---|
| Id | UUID | Primary key |
| AccountId | UUID | Required foreign key |
| TransactionDate | Date-only | Source date interpreted using the confirmed import format |
| Description | String | Required, bounded length; financial identifier validation; no raw unmapped columns |
| Amount | Decimal | Non-negative monetary magnitude, currency-appropriate precision |
| Direction | Enum | `Incoming` or `Outgoing` |
| CreatedAtUtc | UTC timestamp | Persistence timestamp; not a substitute for transaction date |

Currency is inherited from the immutable account currency; imports do not perform conversion.

### Import review

Short-lived server-side review state. It contains only normalized mapped values, never the original upload or unmapped fields.

| Field | Type | Rules |
|---|---|---|
| Id | UUID | Opaque review identifier |
| AccountId | UUID | Required; one active review/lease per account |
| ActingUserId | Identity key | Family owner who started the import |
| State | Enum | `Ready`, `Confirmed`, `Cancelled`, `Expired` |
| CreatedAtUtc / ExpiresAtUtc | UTC timestamps | Expiry releases the account import lease |
| DuplicateConfirmationRequired | Boolean | True when any proposed row matches an existing or same-file row |
| Rows | Review row collection | Valid mapped data only; all-or-nothing validation before review creation |

State transitions: `Ready -> Confirmed`, `Ready -> Cancelled`, or `Ready -> Expired`. Terminal reviews cannot be confirmed again. Confirmation rechecks Family ownership, lease ownership, and duplicates before one atomic transaction insert. Cancellation, expiry, or failed confirmation leaves transactions and `LastSuccessfulImportAtUtc` unchanged.

### Import review row

| Field | Type | Rules |
|---|---|---|
| ReviewId | UUID | Parent review |
| RowNumber | Integer | Source row locator; does not retain the row |
| TransactionDate | Date-only | Validated |
| Description | String | Validated and safe to show in authorized review |
| Amount | Decimal | Validated non-negative magnitude |
| Direction | Enum | `Incoming` or `Outgoing` |
| IsPossibleDuplicate | Boolean | Exact match on date, description, amount, direction within the selected account or same import |

Delete staged review rows when the review becomes terminal or expires. Invalid input returns row/mapping identifiers without the sensitive value.

### Import settings

One shared, administrator-managed settings record.

| Field | Type | Rules |
|---|---|---|
| Id | Fixed singleton key | Exactly one active settings record |
| MaxFileSizeBytes | Integer | Positive; default `10 * 1024 * 1024` |
| MaxRowsPerImport | Integer | Positive; default `10000` |
| MaxImportAttemptsPerUserPerMinute | Integer | Positive; default `5` |
| UpdatedByUserId | Identity key | Administrator who last changed settings |
| UpdatedAtUtc | UTC timestamp | Required |

Runtime defaults apply when no persisted administrator setting exists. Validate all settings as one unit and reject invalid updates without replacing the last valid values. Enforce file size before parsing, row count during streaming parse, and per-user rate on import attempts.

### Import rate window

| Field | Type | Rules |
|---|---|---|
| UserId | Identity key | Part of primary key |
| WindowStartedAtUtc | UTC timestamp | Fixed one-minute UTC window start |
| AttemptCount | Integer | Atomically incremented for each import attempt |

Use the shared database as the source of truth so application instances cannot each grant a separate request allowance. Expire completed windows. The configured per-user maximum applies to attempts, including rejected uploads.

### Import audit event

| Field | Type | Rules |
|---|---|---|
| Id | UUID | Primary key |
| AccountId | UUID | Required |
| ActingUserId | Identity key | Required |
| OccurredAtUtc | UTC timestamp | Required |
| Outcome | Enum | Started, succeeded, cancelled, expired, or failed |

Audit records MUST NOT contain account/transaction descriptions, amounts, uploaded content, or rejected identifiers. Structured operational logs follow SEC-003 and may include safe identifiers such as review ID and row number only when approved by the security review.

## Validation and integrity

- Account currency and transaction direction use closed enumerations/references; client-supplied values are validated at the API boundary.
- Use exact decimal arithmetic and persist currency code through the account relationship.
- Database uniqueness/constraints and a transaction provide all-or-nothing import persistence and account-scoped concurrency.
- Enforce one Family per owner with a database uniqueness constraint and prevent clients assigning accounts to another user's Family.
- Apply maximum description and field lengths before identifier pattern checks to bound processing.
- Validate every account description at create/update and every mapped transaction description before review or persistence.
- Review data is short-lived; cleanup must release active account leases and remove staged descriptions on cancel, expiry, success, and failed processing.
