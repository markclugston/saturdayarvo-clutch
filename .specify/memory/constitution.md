<!--
Sync Impact Report
Version change: 4.1.0 -> 4.2.0
Modified principles: IV. Testing and Quality Gates (require agent-executable validation and
  prohibit human manual testing as a completion gate)
Added sections: None
Removed sections: None
Follow-up TODOs: Review existing feature artifacts for requirements that conflict with this
  amendment or the existing prohibition on participant usability studies.
-->

# SaturdayArvo Clutch Constitution

## Core Principles

### I. Tooling, UI, and Architecture
Specifications in `.specify/` and approved task requirements MUST govern implementation; teams MUST
NOT add unrequested features or parameters. Domain and business logic MUST remain decoupled from
HTTP, persistence, and provider-specific infrastructure. The user interface MUST reside in
`clutch-web`; the application MUST NOT introduce a .NET-based UI. Dependencies MUST be registered
through .NET dependency injection with lifetimes appropriate to their use. Modern C# features,
including primary constructors, pattern matching, collection expressions, and immutable record
types, SHOULD be used when they improve clarity, correctness, or maintainability and MUST NOT be
applied mechanically.

### II. .NET Service Best Practices
.NET projects MUST target .NET 10 or newer. The C# language version MUST be the stable version
selected by the target SDK; preview language features require explicit approval. Projects claiming
support for a newer target framework MUST build and pass tests for that target. Every `.csproj`
MUST explicitly enable nullable reference types, implicit usings, code-style enforcement during
build, and warnings as errors.

I/O-bound operations MUST use asynchronous APIs. Asynchronous methods MUST use the `Async` suffix
unless a framework or interface contract fixes the method name. Resources MUST be disposed
deterministically, and asynchronous disposal MUST be awaited when supported. Services MUST support
cancellation and timeouts for I/O. Retries MUST be bounded and used only when retrying is safe.
Allocation-focused techniques such as `ReadOnlySpan<T>` and `Memory<T>` SHOULD be used when
measurement or a clear high-throughput requirement justifies their complexity.

### III. Data Access, Async, and Performance
All application communication with a database MUST use Entity Framework Core; other database
access mechanisms are prohibited. EF Core operations MUST use asynchronous APIs where available.
Read-only entity queries MUST use `AsNoTracking()` when tracking is not needed and the query shape
supports it.

Each database-related change MUST receive a second, independent agent review of the SQL queries or
statements it executes or causes EF Core to generate. The review MUST assess query shape, indexing,
and avoidable round trips. Numeric performance targets are not required by default; when
measurement identifies a performance problem, the affected flow MUST receive measurable targets
and verification. Known SQL-related performance bottlenecks MUST be resolved before acceptance.
Critical API behavior involving database queries and migrations MUST have integration tests using
a disposable container running the production database provider. In-memory fakes MAY be used when
provider-specific behavior is irrelevant.

### IV. Testing and Quality Gates
Every behavior-bearing project MUST have appropriate automated tests, and tests MUST cover
behavior added or changed by a task. Each .NET project with meaningful behavior MUST have an
appropriate test project using xUnit and NSubstitute. Tests MUST use substitutes for boundary
dependencies where isolation is useful and MUST NOT substitute domain entities or internal state
logic. API integration tests SHOULD use `WebApplicationFactory` when appropriate.

A task MUST NOT be declared complete until its relevant tests and checks pass. Review findings
MUST be addressed, and relevant tests and checks MUST be rerun before completion. Reviewers MUST
report material unresolved risks. A task MUST NOT pass its quality gates while a blocking issue
remains unresolved.

Feature, story, task, and test completion MUST NOT require human manual testing or human
confirmation of manual test results. Specifications, plans, tasks, acceptance criteria, and
release gates MUST require only tests and checks that a Copilot agent can execute and evaluate
using available tools. Where appropriate, automated browser, accessibility, integration, or
other executable checks MUST replace manual testing requirements without removing the underlying
behavior or accessibility requirements. Human testing MAY provide optional feedback but MUST NOT
be a completion gate.

If a required agent-executable check cannot run or fails, the agent MUST report the blocker or
failure and MUST NOT claim that the check passed. The agent MUST resolve the blocker or use an
equivalent agent-executable check that verifies the requirement before declaring completion;
inability to run a check MUST NOT silently waive the underlying requirement.

The project MUST NOT conduct participant usability studies. Participant usability studies MUST
NOT be required as acceptance criteria, implementation tasks, or release gates.

### V. Security and Error Handling
Security MUST be enforced at system boundaries; protected operations MUST enforce authorization,
and untrusted input MUST be validated. Client-side checks MUST NOT replace server-side controls.
Changes affecting payment functionality or sensitive financial data MUST identify relevant data
flows and safeguards and review their impact on application security.

Changed code MUST receive an independent review focused on the OWASP Top 10 before completion.
Every vulnerability found MUST be addressed and verified; unresolved security findings block
completion. Sensitive personal data MUST NOT be embedded in client-side bundles. Dependencies
MUST be checked for known vulnerabilities, and findings MUST be remediated in a timely manner.
Web applications MUST use secure cookies, transport security, and browser security headers.
Cookie-based state-changing requests MUST have appropriate CSRF protections.

Secrets MUST NOT be committed to source control. Secrets MUST use approved secure storage and MUST
be rotated according to applicable operational policy. Credentials, tokens, and cryptographic
secrets MUST NOT be embedded in client-side bundles. Authentication secrets MUST NOT be stored in
browser local or session storage.

Credentials, tokens, sensitive personal data, and payment account data MUST NOT be written to logs
or diagnostic output. Logging MUST use approved redaction or omission for sensitive fields;
structured logging MUST NOT make sensitive values available through message templates or
properties. Sensitive financial and payment data MUST be handled only within approved system
boundaries and protected from unauthorized access and disclosure. Secret material MUST NOT be
written to logs.

Exceptions MUST NOT be used for expected control flow. Predictable validation failures MUST use
typed errors or an established Result pattern. ASP.NET Core applications MUST use standard
exception-handling middleware or `IExceptionHandler` to return appropriate `ProblemDetails`
responses consistent with RFC 9457. Error responses and diagnostics MUST NOT disclose secrets,
tokens, sensitive personal data, or payment account data.

### VI. Frontend Engineering (clutch-web)
`clutch-web` MUST use the current stable React major version with function components and hooks.
Class components MUST NOT be used except for error boundaries when a maintained library is not
used. `useEffect` MUST NOT derive state that can be computed during render. Server state MUST be
managed by a dedicated data-fetching and caching library rather than ad hoc effect-based fetching.
List items MUST use stable identifiers as keys, not array indexes, unless the list is static.
`dangerouslySetInnerHTML` MUST NOT be used with untrusted content; any use MUST be sanitized and
receive the security review required by this constitution.

All frontend code MUST be TypeScript with `strict` and `noUncheckedIndexedAccess` enabled. `any`
MUST NOT be used; use `unknown` and narrow it. `@ts-ignore` MUST NOT be used, and
`@ts-expect-error` requires an explanatory comment. Data crossing a system boundary, including API
responses, URL parameters, and browser storage, MUST be validated at runtime before being treated
as trusted. Generated API types MAY provide compile-time checks but MUST NOT replace runtime
validation. API clients MUST handle RFC 9457 `ProblemDetails` responses as a typed case.

Styling MUST use Tailwind utility classes. Custom CSS is permitted only for global theme tokens and
base layers, or where a documented browser or design requirement cannot be expressed with Tailwind
utilities. Reusable colors, spacing, radii, and typography MUST come from theme tokens (semantic
CSS variables); one-off arbitrary values require a clear design or technical rationale. Class
names MUST NOT be constructed by string concatenation. Conditional and merged classes MUST use the
shared `cn()` helper (`clsx` and `tailwind-merge`). Layouts MUST be mobile-first. Inline `style` is
permitted only for values computed at runtime.

shadcn/ui MUST be the default source for UI primitives. Components MUST be added through the
shadcn CLI into the repository and then reviewed, typed, and tested as project-owned source.
Modifications to generated components SHOULD be avoided in favor of composition via wrappers; the
reason MUST be recorded when a generated component is modified. A competing component library
MUST NOT be introduced without a constitution amendment. Components from third-party or community
registries are untrusted code and MUST receive the independent security review required by this
constitution before being added. Frontend dependencies MUST be covered by dependency vulnerability
checks. shadcn/ui does not by itself satisfy accessibility requirements; each feature remains
responsible for conformance.

Every page MUST support light and dark themes, keyboard access, responsive layouts, and WCAG 2.2
Level AA. Feature specifications MUST define theme selection, default, and persistence behavior,
and any additional accessibility requirements. `clutch-web` MUST include unit and component tests
for meaningful components, hooks, utilities, and state behavior, using the project's established
frontend test tools. UI tests MUST verify user-observable behavior through accessible roles and
names rather than component implementation details. Critical user journeys MUST have
browser-level end-to-end tests. Frontend CI MUST pass type checking, linting with zero warnings,
automated tests, and a production build. The type check MUST run `tsc --noEmit`, and linting MUST
use `typescript-eslint`.

### VII. Performance and Availability
All user-initiated actions MUST provide a user-visible response within 500 milliseconds. If an
action takes longer, the user interface MUST show a busy state and MUST show a progress indicator
when measurable progress is available. Production user-facing services MUST achieve at least
99.99% availability in each calendar month.

### VIII. Observability
Application services MUST use OpenTelemetry to emit failure counts and rates, and duration and
outcome metrics for long-running tasks. Metrics for transaction imports MUST include the number of
transactions successfully imported and the number successfully imported per minute.

## Engineering Requirements

### Service Operations and Data Changes
Services MUST use structured logs and expose health checks appropriate to their operation. Log
content MUST comply with this constitution's security and sensitive-data requirements. Database
migrations MUST be reviewed for data loss. Changes requiring rollback or data transformation MUST
include an appropriate rollback or backfill plan.

### Requirement Applicability Index
The identifiers below label requirements embedded in this constitution; they are retained for
traceability and do not refer to separate policy documents.

| ID | Area | Applies when | Owner |
|---|---|---|---|
| ARC-001 | Architecture boundaries | A change alters project boundaries, dependency registration, or application architecture, or uses modern C# language features. | Repository maintainers |
| DOT-001 | .NET service practices | A change targets or modifies a .NET project, service, or runtime behavior. | Clutch.API maintainers |
| DOT-002 | EF Core data access and performance | A change accesses a database, changes an EF Core query or migration, or affects database performance. | Clutch.API maintainers |
| ENG-001 | Testing and quality gates | A change adds or modifies behavior, tests, or delivery quality gates. | Repository maintainers |
| OPS-001 | Reliability and data changes | A change affects service operations, logging, health checks, database migrations, rollback, or backfills. | Repository maintainers |
| SEC-001 | Application security | Any code change requiring an independent security review; also changes affecting security controls, authentication, authorization, untrusted input, or dependencies. | Repository maintainers |
| SEC-002 | Secrets and keys | A change handles secrets, credentials, keys, certificates, or cryptographic material. | Repository maintainers |
| SEC-003 | Logging and payment-data handling | A change touches logging, error handling, payment data, or sensitive data in diagnostics. | Repository maintainers |
| WEB-001 | Frontend engineering | A change creates or modifies `clutch-web`, its UI, frontend dependencies, or frontend tests. | clutch-web maintainers |

This constitution governs all project requirements. Conflicts MUST be flagged for resolution and
MUST NOT be silently waived.

`/speckit.analyze` and `/speckit.checklist` MUST treat violations of this constitution as CRITICAL.

## Spec-Kit Integration & Workflow

Spec-Kit MUST be used as the authoritative tool for feature development and governance:

- **Specification Phase** (`/speckit-specify`): Every new feature MUST have a formal spec.md
  created or updated with clear requirements and acceptance criteria.
- **Planning Phase** (`/speckit-plan`): Before implementation, create a plan.md. The plan MUST
  include a Constitution Check listing every applicable principle and requirement identifier,
  with explicit statements of how the design complies with each one. If a conflict is discovered,
  it MUST be flagged and resolved before proceeding.
- **Task Generation** (`/speckit-tasks`): All implementation work MUST be defined as ordered,
  dependent tasks in tasks.md. Each task MUST reference applicable constitutional requirements and describe
  completion criteria.
- **Implementation** (`/speckit-implement`): Execute tasks through Spec-Kit. When Copilot agents
  are used, they MUST follow this constitution and all applicable requirements.
- **Convergence Check** (`/speckit-converge`): Before declaring a feature complete, verify that
  all tasks are done and no constitutional requirements have been missed.

GitHub Copilot agents (in VS Code Copilot) MUST read and enforce this constitution. Generated
code MUST comply with applicable requirements in this constitution and those identified in the
active plan; violations MUST be reported as blocking issues.

## Best Practice Enforcement

Requirements are embodied in this constitution and indexed by their applicability above:

See the Requirement Applicability Index above for requirement IDs, triggers, and owners.

Every code change MUST comply with applicable requirements in this constitution. Violations MUST
be identified during planning and remediated before implementation.
`/speckit-analyze` and `/speckit-checklist` MUST treat violations of this constitution as
CRITICAL findings.

## Templates and Examples

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

Templates MUST NOT override this constitution. If a template conflicts with this constitution,
the conflict MUST be reported and resolved before proceeding.

### Continuous Governance

- Before each planning session, identify applicable requirements in this constitution.
- During planning, verify that the design addresses every applicable requirement.
- During implementation, run targeted quality gates for each applicable requirement area,
  including linters, test coverage checks, and security scanners.
- During review, verify that all tests pass and applicable requirements have been checked.
- If requirements are incomplete or conflict with this constitution, flag them for amendment; do
  not silently work around them.

## Delivery and Review Workflow

Every change MUST pass its applicable tests and quality gates. Database-operation changes MUST
receive the independent query review required by Principle III; security-sensitive changes MUST
receive the review and remediation required by Principle V. Contributors MUST resolve blocking
findings and rerun relevant checks before completion.

All changes MUST verify:
- Applicable constitutional requirements are identified and complied with.
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

**Version**: 4.2.0 | **Ratified**: 2026-11-01 | **Last Amended**: 2026-11-09