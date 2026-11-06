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

## Spec-Kit Integration & Workflow

Spec-Kit MUST be used as the authoritative tool for feature development and governance:

- **Specification Phase** (`/speckit-specify`): Every new feature MUST have a formal spec.md
  created or updated with clear requirements and acceptance criteria.
- **Planning Phase** (`/speckit-plan`): Before implementation, create a plan.md. The plan MUST
  include a Constitution Check listing every applicable standard (from `standards/README.md`),
  with explicit statements of how the design complies with each one. If a conflict is discovered,
  it MUST be flagged and resolved before proceeding.
- **Task Generation** (`/speckit-tasks`): All implementation work MUST be defined as ordered,
  dependent tasks in tasks.md. Each task MUST reference applicable standards and describe
  completion criteria.
- **Implementation** (`/speckit-implement`): Execute tasks through Spec-Kit. When Copilot agents
  are used, they MUST follow this constitution and all applicable standards.
- **Convergence Check** (`/speckit-converge`): Before declaring a feature complete, verify that
  all tasks are done and no standards have been missed.

GitHub Copilot agents (in VS Code Copilot) MUST read and enforce this constitution and all
applicable standards. When Copilot generates code, it MUST comply with the standards referenced
in the active plan; violations MUST be reported as blocking issues.

## Best Practice Enforcement

Best practices are embodied in this constitution and the nine standards documents:

| Standard ID | Area | File | Enforces |
|---|---|---|---|
| ARC-001 | Architecture | `standards/architecture/architecture-boundaries.md` | Dependency injection, modern C# features, decoupling |
| DOT-001 | .NET Services | `standards/dotnet/dotnet-service-practices.md` | Service platform and runtime best practices |
| DOT-002 | Data Access | `standards/dotnet/ef-core-data-access-performance.md` | EF Core queries, performance, migrations |
| ENG-001 | Testing & Quality | `standards/engineering/testing-and-quality-gates.md` | Test coverage, xUnit, NSubstitute, quality gates |
| OPS-001 | Operations | `standards/operations/reliability-and-data-changes.md` | Reliability, logging, migrations, rollback |
| SEC-001 | Application Security | `standards/security/pci-dss-controls.md` | PCI DSS, auth, authz, input validation |
| SEC-002 | Secrets & Keys | `standards/security/secrets-and-keys.md` | Credential handling, cryptography |
| SEC-003 | Logging & PAN | `standards/security/logging-and-pan-handling.md` | Payment data, diagnostics, error handling |
| WEB-001 | Frontend | `standards/web/frontend-engineering.md` | React/Vue/Vite best practices, testing |

Every code change MUST comply with applicable standards. Violations MUST be identified during
planning (Constitution Check in plan.md) and remediated before implementation. Spec-Kit's
`/speckit-analyze` and `/speckit-checklist` tools treat standard violations as CRITICAL.

## Standards Compliance & Templates

### Templates and Examples

When producing code, plans, or specifications, contributors and agents MUST reference applicable
templates and examples:

- **API Endpoint Template**: For new ASP.NET Core endpoints, reference ARC-001 and DOT-001 for
  dependency injection and error handling patterns.
- **Data Access Query Pattern**: For new EF Core queries, reference DOT-002 for correct async
  usage, N+1 prevention, and performance requirements.
- **Test Project Structure**: For new test projects, reference ENG-001 for xUnit project naming,
  WebApplicationFactory setup, and substitute patterns.
- **Security Review Checklist**: For any code change, reference SEC-001's checklist items.
- **Frontend Component Template**: For new clutch-web components, reference WEB-001 for Vite,
  testing, and accessibility requirements.

Templates MUST NOT override standards—they MUST implement them. If a template and a standard
conflict, the standard takes precedence and the conflict MUST be reported.

### Continuous Governance

- Before each planning session, load `standards/README.md` and identify applicable standards.
- During planning, verify that the design addresses every applicable standard.
- During implementation, run targeted quality gates for each standard area (e.g., linters, test
  coverage checks, security scanners).
- During review, verify that all tests pass and applicable standards have been checked.
- If standards are found to be incomplete or in conflict with the constitution, flag them for
  amendment; do not silently work around them.

## Delivery and Review Workflow

Every change MUST pass its applicable tests and quality gates. Database-operation changes MUST
follow the independent query review in `standards/dotnet/ef-core-data-access-performance.md`
(DOT-002); security-sensitive changes MUST follow the review and remediation requirements in
`standards/security/pci-dss-controls.md` (SEC-001). Contributors MUST resolve blocking findings
and rerun relevant checks before completion.

All changes MUST verify:
- Applicable standards from `standards/README.md` are referenced and complied with.
- Spec-Kit plan.md includes a Constitution Check confirming compliance.
- All relevant tests and quality gates pass.
- Any security findings are resolved and documented.

## Governance

This constitution governs implementation and review decisions in the repository. Amendments MUST
be made in this file, include a rationale, and update the version and last-amended date. Versioning
uses semantic versioning: MAJOR for incompatible governance changes, MINOR for new principles or
materially expanded requirements, and PATCH for clarifications and non-semantic refinements.
Contributors and reviewers MUST verify compliance with these principles as part of each change.
Exceptions require an explicit amendment; review findings MUST NOT be waived silently.

### Amendment Process

1. Propose amendment with rationale and version bump reasoning.
2. Update this file and the version/date footers.
3. Include Sync Impact Report as an HTML comment at the top of the file (removed after commit).
4. Commit with message format: `docs: amend constitution to vX.Y.Z (description)`.
5. Tag commit with `constitution-vX.Y.Z`.

**Version**: 2.5.0 | **Ratified**: 2026-11-01 | **Last Amended**: 2026-11-07