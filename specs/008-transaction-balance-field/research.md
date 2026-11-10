# Research: Optional Transaction Balance Field

## Settings persistence

- **Decision**: Add optional `BalanceColumn` to the `ImportMapping` record; keep `CurrentSchemaVersion = 1`.
- **Rationale**: Settings and review snapshots are stored as JSON (`SettingsJson`, `MappingJson`) deserialized with web defaults, so a missing property reads as null. Old saved settings remain valid (FR-006) and no data migration is needed.
- **Alternatives**: Bump schema version with upgrader (unnecessary churn); separate settings column (breaks "saved with the other fields").

## Balance parsing

- **Decision**: Reuse the parser's decimal parsing (number format, currency code handling, minor-unit limits) for the balance; keep the sign (overdrawn balances). Empty cell → null; invalid → existing invalid-amount error for that row, with field `Balance`.
- **Rationale**: Matches spec FR-003/FR-004 and the "same rules as amounts" assumption. Amounts use absolute values with a direction; balances must retain their sign.
- **Alternatives**: Lenient parse that ignores bad values (hides data errors); calculating balances (explicitly out of scope).

## Mapping validation

- **Decision**: If `BalanceColumn` is set, it must be within the column count and distinct from all other mapped columns, via the existing `Columns` validation.
- **Rationale**: Consistent with existing duplicate-column handling (spec edge case).

## Storage

- **Decision**: Nullable `decimal` column `Balance` on `Transactions` and `ImportReviewRows`, same precision/scale as `Amount`, no check constraint (negative allowed), no index.
- **Rationale**: Review rows hold parsed data until confirmation, so they must carry the balance. Balance is not used in filtering, sorting, or duplicate detection, so no index and the duplicate fingerprint is unchanged.
- **Alternatives**: Store balance as string (loses numeric validity).

## API and list display

- **Decision**: Add nullable `balance` string (same formatting as `amount`) to transaction list items. The client hides the Balance column when no item on the displayed list has a balance, and shows blank cells for rows without one.
- **Rationale**: Clarification: show column only if any listed transaction has a balance. Evaluating over loaded items keeps the API simple; paginated lists may show the column once a later page loads a balance — accepted.
- **Alternatives**: Server-side "account has balances" flag (extra query/contract for marginal benefit).

## Import review table

- **Decision**: The review response exposes `balance` (string or null) and the review table shows a right-aligned Balance column last, after Amount, only when any row has a balance. Amount and balance use the narrow currency symbol (`$`, not `A$`) and are right-aligned in both the review table and the transaction list.
- **Rationale**: Avoid unrequested features (constitution I).
