<!--
Sync Impact Report
- Version: 1.6.0 → 1.7.0 (MINOR: new requirement SEC-004)
- Added: SEC-004 Data Validation — dual validation (UI for UX, server at earliest opportunity for
  correctness and security), complete and correct, field-level errors, no information disclosure
- Follow-up: clutch-security-review and clutch-frontend skills should reference SEC-004; run
  .\scripts\sync-agent-config.ps1 -From claude
-->
# SaturdayArvo Clutch Constitution

**Version**: 1.7.0 | **Last Amended**: 2026-11-22

## Governance
Source of truth: the running code, its lint rules and its automated tests define implementation (design tokens, components, patterns, conventions). This constitution defines obligations, governance and process. Specifications define intent.
Precedence for obligations: 1. Constitution 2. `clutch-*` skills and path-scoped instructions 3. Reference documentation. Guidance documents must reference implementation in code, not restate it; `docs/code-map.md` locates it.
Conflicts between code and guidance, or between guidance documents, must be raised and must not be silently waived or resolved by picking a side. Constitutional violations are CRITICAL findings.
Each heading names the skill holding the process for that requirement. The procedure for applying this constitution is in `clutch-constitution-check`.

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

## SEC-004 Data Validation · `clutch-security-review`, `clutch-frontend`
- All data must pass two independent forms of validation; neither may be omitted.
- Data entered through the UI must be validated in the UI, with validation errors shown in the UI, for user experience.
- All data must also be validated on the server at the earliest opportunity, for data correctness and security. UI validation never substitutes for server validation.
- Validation must be complete and correct: every field and rule that defines valid data is enforced, in both places.
- Failed server validation must return an error to the caller that identifies each failing field and why it failed.
- Validation errors must not disclose server-side implementation details or anything the OWASP guidance prohibits exposing (stack traces, internal paths, types, queries, framework or version information).

## WEB-001 Frontend · `clutch-frontend`, `clutch-ui-style`
- TypeScript required.
- Accessibility required: WCAG 2.2 AA.
- Frontend tests and quality gates required.
- Third-party UI code requires independent security review.
- Visible labels, headings and button text must use Title Case.
- Percentage (%) and currency ($) entry controls must never display characters that cannot form a valid value, and must show the formatted value when focus leaves the field. They reuse the established implementation (`docs/code-map.md`).
- All numbers and currency amounts must be right aligned: numeric and currency table cells and their column headers, numeric entry controls, and displayed amounts and rates. Enforced by the `clutch/numeric-align` lint rule and the `FloatingField` primitive (`docs/code-map.md`).
- UI work must apply the style guide: the design system implemented in code and its enforcing lint rule and browser tests. Plans must identify the applicable style guide sections, and its compliance checklist must appear in the Constitution Check and completion review.
- Style-guide rule changes are made in code first (tokens, primitives, lint rule, browser tests); guidance that references them is updated in the same change.

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
