# Data Model: Optional Transaction Balance Field

## ImportMapping (saved settings / review snapshot JSON)

| Field | Type | Notes |
|---|---|---|
| `balanceColumn` | integer, nullable | Zero-based file column holding the balance. Null/absent = no balance mapping. Must be in range and distinct from every other mapped column. |

All other fields unchanged. Settings schema version stays 1; absent property deserializes as null.

## ParsedImportRow (in-memory)

| Field | Type | Notes |
|---|---|---|
| `Balance` | decimal, nullable | Parsed value with sign preserved; null when cell empty or unmapped. |

## ImportReviewRow (table `ImportReviewRows`)

| Column | Type | Notes |
|---|---|---|
| `Balance` | decimal (same precision/scale as `Amount`), nullable | New. No non-negative constraint. |

## Transaction (table `Transactions`)

| Column | Type | Notes |
|---|---|---|
| `Balance` | decimal (same precision/scale as `Amount`), nullable | New. Existing rows null. Not part of duplicate fingerprint. Must be representable with the account currency's minor units when present. |

## Validation rules

- Balance column optional; unset is valid.
- Non-empty balance cell must parse under the selected number format and currency rules; otherwise the row fails with the existing invalid-amount error (field `Balance`).
- Balance may be negative or zero.
- Balance is never calculated or derived.

## Migration

Additive: add two nullable columns. Rollback: drop both columns (only balance data lost). No backfill.
