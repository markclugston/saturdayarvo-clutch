<!--
Sync Impact Report
Version change: 2.4.0 -> 2.4.1
Modified principles: I–VI, Engineering Constraints, and Delivery and Review Workflow (detailed
implementation requirements moved to referenced standards without changing their obligations)
Added sections: Nine standards documents under standards/ (ARC-001, DOT-001, DOT-002, ENG-001,
OPS-001, SEC-001, SEC-002, SEC-003, WEB-001)
Removed sections: None
Deferred TODOs: None
-->

# SaturdayArvo Clutch Constitution

## Core Principles

### I. Tooling, UI, and Architecture
Specifications in `.specify/` and approved task requirements MUST govern implementation; teams MUST
NOT add unrequested features or parameters. Domain and business logic MUST remain decoupled from
HTTP, persistence, and provider-specific infrastructure. The user interface MUST reside in
`clutch-web`; the application MUST NOT introduce a .NET-based UI. Architecture and tooling changes
MUST read and comply with `standards/architecture/architecture-boundaries.md` (ARC-001).

### II. .NET Service Best Practices
Changes to .NET service platforms, APIs, or runtime behavior MUST read and comply with
`standards/dotnet/dotnet-service-practices.md` (DOT-001).

### III. Data Access, Async, and Performance
All application database access MUST comply with
`standards/dotnet/ef-core-data-access-performance.md` (DOT-002).

### IV. Testing and Quality Gates
Quality MUST be verified before acceptance. Project-specific testing and quality gates MUST
comply with `standards/engineering/testing-and-quality-gates.md` (ENG-001) and applicable
technology standards, including `standards/dotnet/ef-core-data-access-performance.md` (DOT-002)
and `standards/web/frontend-engineering.md` (WEB-001).

### V. Security and Error Handling
Security MUST be enforced at system boundaries; protected operations MUST enforce authorization,
and untrusted input MUST be validated. Client-side checks MUST NOT replace server-side controls.
All code changes MUST read and comply with
`standards/security/pci-dss-controls.md` (SEC-001). Changes handling secrets, keys, credentials,
or cryptographic material MUST also comply with
`standards/security/secrets-and-keys.md` (SEC-002).
Changes touching logging, error handling, or payment data MUST comply with
`standards/security/logging-and-pan-handling.md` (SEC-003).

### VI. Frontend Standards (clutch-web)
Changes to `clutch-web` MUST read and comply with
`standards/web/frontend-engineering.md` (WEB-001).

## Standards

Standards MUST be stored under `standards/`, grouped into `security/`, `architecture/`, `dotnet/`
(Clutch.API), `web/` (clutch-web), `engineering/`, and `operations/`. Standards MUST NOT be created
inside `.specify/` or `specs/`. `standards/README.md` MUST index every standard by its unique ID,
applicability trigger, and owner.

The constitution takes precedence over standards. Any conflict MUST be flagged for resolution;
contributors and reviewers MUST NOT silently resolve it in favor of a standard.

Before producing a plan, tasks, or implementation, contributors and agents MUST read
`standards/README.md` and load every standard whose trigger matches the feature. Plans, tasks, and
implementation records MUST reference each applicable standard by its ID and repo-root-relative
path.

Every plan's Constitution Check MUST list every applicable standard and state how the design
complies with each one. If none apply, the check MUST say so explicitly. A plan that omits an
applicable standard is incomplete.

`/speckit.analyze` and `/speckit.checklist` MUST treat violations of any referenced standard as
CRITICAL findings, at the same severity as constitution violations.

The constitution MUST NOT duplicate detailed standards content. It MUST contain only
trigger-bound obligations and pointers to the applicable standards. Every new standard MUST have a
unique ID, a header stating when it applies, and an entry in `standards/README.md`. Standards MAY
change through normal pull request review; changes to this constitution require a formal amendment
under Governance.

## Engineering Constraints

Changes affecting service operations, logging, health checks, migrations, rollback, or backfills
MUST read and comply with `standards/operations/reliability-and-data-changes.md` (OPS-001).

## Delivery and Review Workflow

Every change MUST pass its applicable tests and quality gates. Database-operation changes MUST
follow the independent query review in `standards/dotnet/ef-core-data-access-performance.md`
(DOT-002); security-sensitive changes MUST follow the review and remediation requirements in
`standards/security/pci-dss-controls.md` (SEC-001). Contributors MUST resolve blocking findings
and rerun relevant checks before completion.

## Governance

This constitution governs implementation and review decisions in the repository. Amendments MUST
be made in this file, include a rationale, and update the version and last-amended date. Versioning
uses semantic versioning: MAJOR for incompatible governance changes, MINOR for new principles or
materially expanded requirements, and PATCH for clarifications and non-semantic refinements.
Contributors and reviewers MUST verify compliance with these principles as part of each change.
Exceptions require an explicit amendment; review findings MUST NOT be waived silently.

**Version**: 2.4.1 | **Ratified**: 2026-11-01 | **Last Amended**: 2026-11-07