# OPS-001 — Reliability and Data Changes

**Applies when:** A change affects service operations, logging, health checks, database migrations,
rollback, or backfills.

**Owner:** Repository maintainers

## Observability and operations

- Services MUST use structured logs.
- Services MUST expose health checks appropriate to their operation.
- Log content MUST comply with SEC-003.

## Safe data changes

- Database migrations MUST be reviewed for data loss.
- Changes requiring rollback or data transformation MUST include an appropriate rollback or
  backfill plan.
