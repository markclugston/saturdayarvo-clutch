# DOT-002 / AUD-001 Instructions

- EF Core is mandatory.
- Use asynchronous APIs.
- Use AsNoTracking for read-only queries when suitable.
- Review query shape.
- Review indexing impact.
- Review avoidable round-trips.
- Review generated SQL.
- Resolve known performance bottlenecks before acceptance.
- Use production-provider integration testing for critical behaviour.
- Store audit records in Audit table only.
- Never update or delete Audit rows.
- Corrections require new Audit records.
- Review migrations for data-loss risk.
- Include rollback/backfill planning when required.
