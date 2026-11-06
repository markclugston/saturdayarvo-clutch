# Standards Index

Standards are detailed implementation requirements governed by the repository constitution.
Read this index before producing a plan, tasks, or implementation, then load every standard whose
trigger matches the work. If a standard conflicts with the constitution, the constitution wins and
the conflict must be flagged.

| ID | Standard | Applies when | Owner |
|---|---|---|---|
| ARC-001 | [Architecture Boundaries](architecture/architecture-boundaries.md) | A change alters project boundaries, dependency registration, or application architecture, or uses modern C# language features. | Repository maintainers |
| DOT-001 | [.NET Service Practices](dotnet/dotnet-service-practices.md) | A change targets or modifies a .NET project, service, or runtime behavior. | Clutch.API maintainers |
| DOT-002 | [EF Core Data Access and Performance](dotnet/ef-core-data-access-performance.md) | A change accesses a database, changes an EF Core query or migration, or affects database performance. | Clutch.API maintainers |
| ENG-001 | [Testing and Quality Gates](engineering/testing-and-quality-gates.md) | A change adds or modifies behavior, tests, or delivery quality gates. | Repository maintainers |
| OPS-001 | [Reliability and Data Changes](operations/reliability-and-data-changes.md) | A change affects service operations, logging, health checks, database migrations, rollback, or backfills. | Repository maintainers |
| SEC-001 | [PCI DSS and Application Security](security/pci-dss-controls.md) | Any code change (for the required independent security review); also changes affecting security controls, authentication, authorization, untrusted input, dependencies, or PCI DSS scope. | Repository maintainers |
| SEC-002 | [Secrets and Keys](security/secrets-and-keys.md) | A change handles secrets, credentials, keys, certificates, or cryptographic material. | Repository maintainers |
| SEC-003 | [Logging and PAN Handling](security/logging-and-pan-handling.md) | A change touches logging, error handling, payment data, or sensitive data in diagnostics. | Repository maintainers |
| WEB-001 | [Frontend Engineering](web/frontend-engineering.md) | A change creates or modifies `clutch-web`, its UI, frontend dependencies, or frontend tests. | clutch-web maintainers |
