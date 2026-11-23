# Research: Preserve Import Order For Same-Date Transactions

No NEEDS CLARIFICATION items remained after the spec's clarifications; these entries record the design
decisions the plan depends on.

## R1 Storage of the order

- **Decision**: `Transactions.Sequence int NOT NULL`, chronological within a date (1 = earliest), unique per
  `(AccountId, TransactionDate, Sequence)`. Gaps are allowed (left by deletes).
- **Rationale**: Ordering is needed only within a date (dates already order across days); a per-date integer
  gives a deterministic total order `(TransactionDate, Sequence)` that the index serves directly and that
  every feature can use (FR-010). The unique index makes the order unambiguous and guards against races.
- **Alternatives**: Account-wide global sequence (importing an older statement later would renumber
  everything); `CreatedAtUtc` plus row number (does not encode the file's direction); storing only
  `SourceRowNumber` and import id (does not encode direction).

## R2 Direction inference (FR-012)

- **Decision**: Pure function over rows in file order. A pair `(earlier, later)` reconciles when
  `later.Balance == earlier.Balance + signed(later)`, `signed` = `+Amount` incoming, `−Amount` outgoing
  (FR-011). Oldest-first reconciles when every adjacent file pair reconciles as `(row i, row i+1)`;
  newest-first when every pair reconciles as `(row i+1, row i)`. A pair with a missing balance reconciles in
  neither direction (FR-011), so any missing balance sends the file to the date rule. A direction is chosen
  by balances only if exactly one direction reconciles and at least one pair was compared. Otherwise
  compare first and last row dates (first later → newest first; first earlier → oldest first); equal →
  newest first.
- **Rationale**: Matches the spec's ordered rules exactly; all-pairs is deterministic and cannot pick a
  direction from a partly broken file. A single row, no Balance column, or zero comparable pairs reconcile
  "both" vacuously and fall through to dates, as the spec's edge cases require.
- **Alternatives**: Majority vote of pairs (ambiguous ties, could pick a direction a broken file does not
  support); per-account direction setting (spec rules it out).
- **Note**: Accounts whose files report balances with the opposite sign convention (e.g. a debt shown as a
  positive balance that falls on incoming payments) reconcile in neither direction and fall back to dates.
  This follows FR-011 as written.

## R3 Chronological group per date (FR-003)

- **Decision**: Rows ordered by `SourceRowNumber`, grouped by date keeping file order; newest-first files
  reverse each group, oldest-first keep it. Non-monotonic files use the same per-date rule with the direction
  from R2.
- **Rationale**: FR-003 defines position within a date only; dates already order across days.

## R4 Placement among saved same-date transactions (FR-002)

- **Decision**: Always append. For a date with saved transactions, the import's chronological group for that
  date takes `max(Sequence) + 1 .. max(Sequence) + m`; for a date with none it takes `1..m`. Balances are not
  compared with saved rows.
- **Rationale**: The user's direction: an import's rows are more recent than anything already saved on that
  date, in file order. Saved rows are never renumbered, so their order cannot change.
- **Alternatives**: Placing the group before or between saved rows where balances reconcile (rejected by
  the user as unnecessary complexity; it needed a mid-day shift `UPDATE`).

## R5 Applying placement in SQL Server

- **Decision**: Sequences are assigned in memory on the new `Transaction`s and inserted with the existing
  `SaveChanges`, inside the existing confirm transaction. No `UPDATE` of saved rows.
- **Rationale**: Confirm already holds the account import lease, so no concurrent import writes the same
  account; deletes only leave gaps, which `max + 1` tolerates. The unique index guards any race.
- **Data loaded**: the existing same-range duplicate query is widened to project `Sequence` alongside the
  fingerprint, so `max(Sequence)` per date needs no extra read.

## R6 List cursor and migration

- **Decision**: Cursor content becomes `yyyy-MM-dd|<sequence>`; list orders by date desc, `Sequence` desc.
  Old and malformed cursors fail decode and get a 400 with a field-level `errors.cursor` entry that says the
  cursor is not valid and to request the first page, without revealing its format or internals (SEC-004,
  contracts/transaction-order.md); clients restart from page one. Migration adds the
  column with default 0, backfills `ROW_NUMBER() OVER (PARTITION BY AccountId, TransactionDate ORDER BY
  CreatedAtUtc, Id)` for any existing rows, drops the default, adds the check and the unique index, and drops
  the old index. Down reverses it.
- **Rationale**: The database is cleared (FR-008), so the backfill is only a guard that lets the unique
  index be created on any non-empty database (e.g. a developer's); it does not claim a correct legacy order.
- **Alternatives**: Keep `Id` in the cursor as a tiebreak (redundant with the unique index).
