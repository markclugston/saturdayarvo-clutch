# DOT-002 — EF Core Data Access and Performance

**Applies when:** A change accesses a database, changes an EF Core query or migration, or affects
database performance.

**Owner:** Clutch.API maintainers

## Data access

- All application communication with a database MUST use Entity Framework Core. Other database
  access mechanisms are prohibited.
- EF Core operations MUST use asynchronous APIs where available.
- Read-only entity queries MUST use `AsNoTracking()` when tracking is not needed and the query
  shape supports it.

## Query review and performance

- Each database-related change MUST receive a second, independent agent review of the SQL queries
  or statements it executes or causes EF Core to generate.
- The review MUST qualitatively assess query shape, indexing, and avoidable round trips.
- Numeric performance targets are not required by default. When measurement identifies a
  performance problem, the affected flow MUST receive measurable targets and verification.
- Known SQL-related performance bottlenecks MUST be resolved before acceptance.

## Database verification

- Critical API behavior involving database queries and migrations MUST have integration tests.
- Tests for critical database behavior MUST use a disposable container running the production
  database provider. In-memory fakes MAY be used when provider-specific behavior is irrelevant.
