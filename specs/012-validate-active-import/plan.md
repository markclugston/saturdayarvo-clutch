# Implementation Plan: Validate Active Transaction Imports

**Branch**: `agents/validate-active-import-on-transactions` | **Date**: 2026-11-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/011-validate-active-import/spec.md`

## Summary

Validate account import availability before file submission, let the owner end a specific
unconfirmed competing preview, and notify that preview's session with a blocking,
actor-identifying modal. Confirmation acceptance is the protection boundary. Both an ended
preview notification and a waiting screen's availability update must arrive within five
seconds in connected foreground sessions.

Reuse account ownership, the account import lease, React Query, Zod, the existing dialog
primitives, and the account-return callback. Add a shared import-state policy and a small
owner-authorized status projection. Make confirmation claim a persisted `Processing` state
before transaction preparation, and make ending a conditional transition of the exact
`Ready` review. Retain only the externally ended review's minimal operational header for
notification after its CSV rows and mapping are deleted. Continue writing audit events
exclusively to the existing append-only `Audit` table; do not restore the identifiers
removed by feature 010 or create a separate audit store.

## Technical Context

**Language/Version**: C# with the stable .NET 10 SDK language version; strict TypeScript
5.9 (existing manifest range).

**Primary Dependencies**: Existing ASP.NET Core, EF Core 10 SQL Server provider, ASP.NET
Core Identity, React 19 function components, TanStack React Query, Zod, Tailwind, and
project-owned shadcn/Base UI dialog primitives. No new runtime package is planned.

**Storage**: SQL Server. Extend `ImportReviews` and its state constraint; preserve
`Accounts.ActiveImportId`, existing account/review indexes, and the immutable `Audit` schema.

**Testing**: xUnit, NSubstitute, WebApplicationFactory, Testcontainers SQL Server;
Vitest/Testing Library and Playwright, including a real-API two-session journey.

**Target Platform**: Existing HTTPS API and responsive browser application.

**Project Type**: Web application with an ASP.NET Core backend and React frontend.

**Performance Goals**: Visible action feedback within 500 ms; connected foreground
notification and conflict clearance within five seconds. Poll status every two seconds
with request cancellation/time bounds that fit the five-second checks; do not let retry
backoff hide a status failure. Validate end-to-end timing rather than just timer settings.

**Constraints**: One active import per account; owner-only access; no user cancellation
after confirmation acceptance; atomic financial writes; stale end requests cannot affect
replacement reviews. No CSV data, credentials, or user names in telemetry. Retain existing
Light/Dark/System preference behavior and WCAG 2.2 AA.

**Scale/Scope**: One additional small status projection per active import screen every two
seconds while visible; no row materialization for status checks. Multiple tabs/devices for
one owner are supported, not shared financial accounts. No new import-history UI,
background job platform, notification service, or resumable cross-device preview.

## Constitution Check

*GATE: Pass the design before research and re-check after Phase 1. Implementation gates
listed below remain mandatory future checks, not claims that unbuilt behavior has passed.*

| Principle / requirement | Design compliance and implementation gate |
|---|---|
| I / ARC-001 | Keep routes in existing endpoints, business transitions in import services/domain, EF coordination in existing infrastructure, and UI in `clutch-web`. Register the shared state service through existing DI. No additional application or speculative framework. |
| II / DOT-001 | Retain .NET 10, stable C#, nullable/implicit-usings/style/warnings-as-errors conventions. Use asynchronous EF operations, cancellation and bounded calls; dispose transactions/scopes. New predictable conflicts use typed outcomes mapped to existing RFC 9457 responses, not exceptions as control flow. |
| III / DOT-002 | Use EF Core exclusively, no-tracking projections for status, conditional updates for claims/ending, and indexed identity/account lookups. A second independent agent must review actual generated SQL, locking order, indexes, round trips, migration, and recovery queries before implementation acceptance. |
| III / AUD-001 | Append events only to existing `Audit`; preserve its update/delete guards, schema and rows. Operational ended-review headers exist only to answer the specific preview's status, not as another audit log. Remove their staged CSV/mapping data immediately. No new audit table or identifier columns in `Audit`. |
| IV / ENG-001 | Add focused automated unit/component, SQL Server race/migration, and real-browser two-session tests. Include failure, recovery, timing and accessibility checks. No manual gate or participant study; report unavailable checks as blockers. |
| V / SEC-001 | Authorize account and watched-review ownership before disclosing status or actor. Require CSRF for ending and existing mutations. Derive actor from authentication, render as text, and keep GET read-only with no-store caching. Obtain an independent OWASP Top 10 code review and dependency scans before acceptance. |
| V / SEC-002 | Preserve existing secure-cookie authentication and protected configuration; no credential storage, new secrets, or auth tokens in browser storage. Test setup uses ephemeral credentials, not committed secrets. |
| V / SEC-003 | Status omits financial rows, mappings, filenames and balances. Actor identity is visible only to the same authorized owner; do not log it or payloads. Metrics use bounded outcome/operation tags, not account/review/user identifiers. |
| VI / WEB-001 | Use React Query for state, Zod for boundary validation, strict TypeScript, shared dialog composition, semantic theme tokens and button navigation. Preserve theme defaults/persistence; test focus trapping, acknowledgement-only dismissal, keyboard and narrow views. Run typecheck, zero-warning lint, tests and build. |
| VII | Preserve service availability obligations; fail closed with busy/error states, bounded requests and retry. Measure 500-ms feedback and both five-second outcomes. Recover abandoned processing claims without interrupting an active write transaction. No availability achievement is claimed from a local planning exercise. |
| VIII | Preserve existing imported-count and transactions-per-minute metrics. Extend existing import instrumentation for status/end/claim outcomes, failures and durations, with no sensitive or high-cardinality labels. Keep health checks intact. |
| Engineering / OPS-001 | Add an additive migration, guarded processing recovery, forward deployment/rollback instructions, sanitized diagnostics and automated upgrade/cleanup tests. Never expire a processing import using preview lifetime rules. |

**Pre-research evaluation**: PASS for planning; no constitutional exception is required.
Database, security, dependency, execution, and performance verification remain implementation
acceptance gates.

**Post-design evaluation**: PASS for planning. [Research](./research.md),
[data model](./data-model.md), [contracts](./contracts/import-coordination.md), and
[validation guide](./quickstart.md) resolve the state, race, cleanup, notification,
ownership and deployment decisions. No unresolved design clarifications remain.

## Project Structure

### Documentation (this feature)

```text
specs/011-validate-active-import/
  spec.md
  plan.md
  research.md
  data-model.md
  quickstart.md
  contracts/import-coordination.md
  checklists/requirements.md
```

`tasks.md` is produced by `/speckit-tasks`, not this planning command.

### Source Code (repository root)

```text
src/Clutch.API/
  Api/Endpoints/ImportEndpoints.cs
  Application/Imports/
    ImportStateService.cs                 (new shared state/coordination service)
    ImportReviewService.cs
    ConfirmImportService.cs
    ImportMetrics.cs
  Domain/Imports/ImportReview.cs
  Infrastructure/
    DependencyInjection.cs
    Imports/AccountImportLease.cs
    Imports/ImportAuditWriter.cs
    Imports/ImportReviewCleanupService.cs
    Persistence/AppDbContext.cs
    Persistence/Migrations/
src/clutch-web/
  src/features/imports/
    api.ts
    ImportPage.tsx
    ImportPage.test.tsx
    useImportStatus.ts                    (new React Query coordination hook)
    ImportEndedDialog.tsx                 (new composition of existing dialog)
  src/lib/api/schemas.ts
  src/components/ui/dialog.tsx            (reuse, no generated-source edits planned)
  e2e/active-import.spec.ts               (new real-backend journey)
  playwright.active-import.config.ts      (extend existing real-backend setup)
tests/Clutch.API.Tests/
  Unit/Imports/
  Integration/Imports/ImportWorkflowTests.cs
  Integration/Persistence/
```

**Structure Decision**: Extend existing projects and reuse their boundary/testing
patterns. Add only the shared coordination service, query hook and modal where they remove
duplicated state/side-effect logic. Reuse `ImportPage.onBack` to return to the selected
account's transactions, and invalidate account/transaction queries before that navigation.

## Delivery Sequence and Traceability

1. Add state/operational-header fields and migration, domain transition tests, and shared
   status evaluation (FR-001 through FR-007, FR-012, FR-013).
2. Integrate exact-target ending, persisted confirmation claim, all terminal paths, and
   cleanup/recovery so no legacy path can clear a processing lease (FR-002, FR-004 through
   FR-007, FR-012). Cover SQL races before relying on UI behavior.
3. Add the status/ending contracts, runtime schemas and query lifecycle; replace unsafe
   account-only recovery and handle malformed-create-response recovery consistently
   (FR-001 through FR-006, FR-013, FR-014, FR-018).
4. Compose the blocking notification and restoration guards, preserving account navigation
   and theme behavior (FR-008 through FR-011, FR-015, FR-016).
5. Execute focused and release gates, independent query/security reviews and dependency
   checks, then resolve findings and rerun affected checks (FR-017; SC-001 through SC-007).

## Complexity Tracking

No constitutional violations or new infrastructure are proposed. A committed processing
claim is necessary because the existing ready-to-deleted confirmation transaction cannot
expose a protected stage. Its bounded recovery is directly coupled to avoiding permanent
account locks after a crash. Retaining an ended operational header is necessary because
existing cancellation deletes the only record the affected session can identify.
