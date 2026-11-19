# SaturdayArvo Clutch Constitution

## Governance Hierarchy
1. Constitution
2. Path-scoped Instructions
3. Reference Documentation

This constitution governs all implementation and review decisions. Conflicts must be raised and must not be silently waived.

## ARC-001 Architecture Boundaries
- Specifications govern implementation.
- Do not add unrequested features.
- Domain logic must remain independent from HTTP, persistence and providers.
- UI belongs in clutch-web.
- .NET UI applications are prohibited.

## DOT-001 .NET Services
- Target .NET 10 or newer.
- Projects must build and pass tests for supported targets.

## DOT-002 Data Access
- EF Core is the only database access mechanism.
- Database changes require independent query review.
- Critical database behaviour requires provider-backed integration tests.

## AUD-001 Audit Data
- Audit data must be stored only in the Audit table.
- Audit records are append-only.
- Existing audit rows must never be updated or deleted.

## ENG-001 Testing And Quality Gates
- Behaviour changes require automated tests.
- Completion requires all applicable tests and checks to pass.
- Blocking findings prevent completion.
- Manual testing is not a required gate.
- Agent-executable validation is required.
- Failed or blocked checks must be reported.

## OPS-001 Operations
- Structured logging required.
- Appropriate health checks required.
- Migration reviews required.
- Rollback or backfill planning required when applicable.

## SEC-001 Security
- Security enforced at system boundaries.
- Authorization required for protected operations.
- Untrusted input validation required.
- Independent OWASP Top 10 review required.
- Security findings block completion until remediated and verified.
- Dependency vulnerability review required.

## SEC-002 Secrets
- Secrets must not be committed.
- Approved secret storage is required.

## SEC-003 Sensitive Data
- Sensitive information must not be logged.
- Error responses must not disclose sensitive information.
- Payment and financial information requires approved handling controls.

## WEB-001 Frontend Governance
- TypeScript required.
- Accessibility required.
- WCAG 2.2 AA required.
- Frontend tests and quality gates required.
- Third-party UI code requires independent security review.
- UI implementation standards are defined in instruction files and style guide.

## Performance & Observability
- User initiated actions must provide visible feedback within 500ms or show progress.
- OpenTelemetry metrics required.

## Spec Kit Workflow
- /speckit-specify required.
- /speckit-plan required.
- Plans must include Constitution Check covering all applicable requirement IDs.
- /speckit-tasks required.
- /speckit-implement must follow constitution.
- /speckit-converge required before completion.
- /speckit.analyze and /speckit.checklist treat constitutional violations as CRITICAL.

## Requirement Applicability Index
ARC-001 Architecture
DOT-001 .NET
DOT-002 EF Core and database
AUD-001 Audit immutability
ENG-001 Testing and quality
OPS-001 Operations
SEC-001 Security
SEC-002 Secrets
SEC-003 Sensitive data
WEB-001 Frontend

## Continuous Governance
- Identify applicable requirement IDs before planning.
- Verify compliance during planning.
- Execute relevant quality gates.
- Verify compliance during review.

## UI Governance
- UI work must read docs/style-guide.md.
- Plans must identify applicable style guide sections.
- Compliance checklist from style guide section 11 must appear in Constitution Check and completion review.
- Style-guide rule changes require synchronized updates.

## Delivery Gates
- Applicable requirements identified.
- Constitution Check completed.
- Tests pass.
- Required database and security reviews completed.

## Amendments
Amendments require rationale, version update and review.
Semantic versioning applies.
