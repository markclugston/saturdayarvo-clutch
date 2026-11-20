---
name: "clutch-data-access"
description: "Clutch EF Core, audit, query review and migration review rules (DOT-002, AUD-001). Use for any database, migration or audit-record work."
metadata:
  author: "saturdayarvo-clutch"
  governs: "DOT-002, AUD-001, OPS-001 (migrations)"
---

# Clutch Data Access

## EF Core

- EF Core is the only database access mechanism.
- Use asynchronous EF Core APIs.
- Use `AsNoTracking` for read-only queries when suitable.

## Audit (AUD-001)

- Audit records are stored only in the Audit table.
- Audit records are append-only. Never update or delete existing Audit rows.
- Corrections are made by writing new Audit records.

## Independent query review (required for every database change)

Perform as a separate review pass over the changed queries, not as part of writing them. For each
changed or new query, record the outcome:

- [ ] Query shape reviewed (projection, filtering, includes, client evaluation)
- [ ] Generated SQL reviewed
- [ ] Indexing impact reviewed
- [ ] Avoidable round-trips removed (N+1, per-row lookups)
- [ ] Known performance bottlenecks resolved before acceptance
- [ ] No audit row is updated or deleted

## Migration review (required for every migration)

- [ ] Data-loss risk reviewed (drops, narrowing type changes, non-null columns on existing data)
- [ ] Rollback plan documented, or backfill plan when data must be moved or derived
- [ ] Audit table remains append-only

## Testing

- Critical database behaviour requires integration tests against the production database provider (not the in-memory provider).
- Rerun tests after fixes and report results honestly.
