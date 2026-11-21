<!--
Sync Impact Report
- Version: 1.3.0 → 1.4.0 (MINOR: new binding input-validation rule)
- Modified: WEB-001 Frontend — added restricted-entry and format-on-blur rule for percentage and
  currency fields
- Added/removed sections: none
- Follow-up: add input-restriction detail and checklist item to `clutch-frontend` and
  `clutch-ui-style`, then run .\scripts\sync-agent-config.ps1 -From claude
-->
# SaturdayArvo Clutch Constitution

**Version**: 1.4.0 | **Last Amended**: 2026-11-21

## Governance
Precedence: 1. Constitution 2. `clutch-*` skills and path-scoped instructions 3. Reference documentation.
Conflicts must be raised and must not be silently waived. Constitutional violations are CRITICAL findings.
Implementation detail for each requirement lives in the skill named in its heading. The procedure for applying this constitution is in `clutch-constitution-check`.

## ARC-001 Architecture Boundaries
- Specifications govern implementation.
- Do not add unrequested features.
- Domain logic must remain independent from HTTP, persistence and providers.
- UI belongs in clutch-web.
- .NET UI applications are prohibited.

## DOT-001 .NET Services · `clutch-dotnet-service`
- Target .NET 10 or newer.
- Projects must build and pass tests for supported targets.

## DOT-002 Data Access · `clutch-data-access`
- EF Core is the only database access mechanism.
- Database changes require independent query review.
- Critical database behaviour requires provider-backed integration tests.

## AUD-001 Audit Data · `clutch-data-access`
- Audit data must be stored only in the Audit table.
- Audit records are append-only; existing audit rows must never be updated or deleted.

## ENG-001 Testing And Quality Gates · `clutch-constitution-check`
- Behaviour changes require automated tests.
- Every feature explicitly requests tests: tasks.md must include test tasks for every behaviour change.
- Completion requires all applicable tests and checks to pass; blocking findings prevent completion.
- Agent-executable validation is required; manual testing is not a required gate.
- Failed or blocked checks must be reported.

## OPS-001 Operations · `clutch-dotnet-service`, `clutch-data-access`
- Structured logging and appropriate health checks required.
- Migration reviews required, with rollback or backfill planning when applicable.

## SEC-001 Security · `clutch-security-review`
- Security enforced at system boundaries.
- Authorization required for protected operations.
- Untrusted input validation required.
- Independent OWASP Top 10 review and dependency vulnerability review required.
- Security findings block completion until remediated and verified.

## SEC-002 Secrets · `clutch-security-review`
- Secrets must not be committed; approved secret storage is required.

## SEC-003 Sensitive Data · `clutch-security-review`
- Sensitive information must not be logged or disclosed in error responses.
- Payment and financial information requires approved handling controls.

## WEB-001 Frontend · `clutch-frontend`, `clutch-ui-style`
- TypeScript required.
- Accessibility required: WCAG 2.2 AA.
- Frontend tests and quality gates required.
- Third-party UI code requires independent security review.
- Visible labels, headings and button text must use Title Case.
- Percentage (%) and currency ($) entry controls, including those on the mortgages screen, must accept only valid values: characters that cannot form a valid value must be rejected at entry and never displayed in the field. When focus leaves the field, the entered text must be reformatted to the correct percentage or currency format.
- UI work must apply the style guide. Plans must identify the applicable style guide sections, and its compliance checklist must appear in the Constitution Check and completion review.
- Style-guide rule changes require synchronized updates.

## Performance & Observability
- User-initiated actions must provide visible feedback within 500ms or show progress.
- OpenTelemetry metrics required.

## Workflow and Delivery Gates
- Spec Kit is mandatory: /speckit-specify, /speckit-plan, /speckit-tasks, /speckit-implement (following this constitution), and /speckit-converge before completion.
- Plans must include a Constitution Check covering all applicable requirement IDs.
- tasks.md must include a task for every gate the Constitution Check requires (tests, query and migration reviews, security review, UI compliance checklist, quality gates).
- Delivery requires: applicable requirements identified, Constitution Check completed, tests pass, and required database and security reviews completed.

## Amendments
Amendments require rationale, version update and review. Semantic versioning applies.
