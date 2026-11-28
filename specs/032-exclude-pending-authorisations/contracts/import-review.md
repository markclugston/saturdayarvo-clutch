# Contract: Import Review And Confirm

Existing endpoints in `src/Clutch.API/Api/Endpoints/ImportEndpoints.cs`; only the shapes below change.

## Review response (`ImportReviewResponse`)

| Field | Change | Type | Notes |
|---|---|---|---|
| `rowCount` | unchanged | int > 0 | All previewed rows, excluded included. |
| `importRowCount` | new | int ≥ 0 | Rows that are not excluded (FR-008). |
| `duplicateConfirmationRequired` | meaning narrowed | bool | Only non-excluded rows count (FR-006). |
| `rows[].isExcluded` | new | bool | Server decision (FR-007). `true` implies `isPossibleDuplicate` is `false`. |

Zod (`src/clutch-web/src/lib/api/schemas.ts`): `importRowCount: z.number().int().nonnegative()`, `isExcluded: z.boolean()`.

## Confirm (`ConfirmImportResponse`)

- Unchanged shape. `importedCount` counts saved rows only and may be `0` when every row is excluded.
- `DuplicateConfirmationRequired` problem `rowNumbers` never includes excluded rows.

## UI (`ImportReviewTable`)

- Sentence: "{importRowCount} transactions will be imported into this account in {currency}."
- Excluded row: stays in source order; Warning cell shows `StatusChip` with text "Will Not Be Imported" (visible text, so readable by assistive technology).
- Non-excluded rows: no such chip.
