# Contract Changes: Optional Transaction Balance Field

All changes are additive and backward compatible.

## Import mapping (request bodies and saved-settings responses)

Applies wherever the existing mapping object is sent or returned (start import review, get/save account import settings).

```json
{ "balanceColumn": 5 }
```

- `balanceColumn`: optional integer ≥ 0, or null/omitted for none.
- Invalid (out of range, or same column as another mapping) → 400 `ProblemDetails` with field `Columns`, as for existing mappings.
- Non-numeric balance cell → 400 `ProblemDetails` with `rowNumber` and field `Balance`.

## Transaction list item

`GET` account transactions: each item gains

```json
{ "balance": "1234.56" }
```

- `balance`: string using the same plain decimal formatting as `amount` but allowing a leading `-`; `null` when the transaction has no balance.

## Import review response

Each review row gains `balance` (same format as the transaction `balance`; `null` when absent).

## Unchanged

Duplicate detection, confirm request, cursors and paging.

## Client validation

The `clutch-web` zod schemas accept `balanceColumn` (nullable, optional) and `balance` (nullable string matching `^-?[0-9]+(\.[0-9]+)?$`).
