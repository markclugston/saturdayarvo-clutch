# Implementation Plan: Top-Banner Theme Selector

**Branch**: `004-theme-selector` | **Date**: 2026-11-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-theme-selector/spec.md`

## Summary

Add a keyboard-operable Light/Dark/System selector to the authenticated shared header. Keep the existing semantic theme tokens and `.dark` class mechanism, derive explicitly selected System appearance from the OS preference, and persist the selected mode in a user-scoped SQL Server preference so it follows the signed-in account across devices. A missing server preference means Light.

## Technical Context

**Language/Version**: TypeScript 5.9 / React 19; C# on .NET 10  
**Primary Dependencies**: React Query, Zod, ASP.NET Core Identity, EF Core SQL Server; no new dependencies planned  
**Storage**: SQL Server, through EF Core; one optional theme preference per Identity user  
**Testing**: Vitest/Testing Library, Playwright and axe; xUnit API integration tests with the existing SQL Server Testcontainers fixture  
**Target Platform**: Responsive web application (`clutch-web`) and its ASP.NET Core API  
**Project Type**: Web application with separate frontend and backend projects  
**Performance Goals**: Apply local Light/Dark choices with a visible appearance update within 500 milliseconds, per SC-002 and the constitution's user-response requirement; reflect OS preference changes within one second, per SC-004. Do not block theme application on persistence.  
**Constraints**: Authenticated user scope only; account preference is loaded on app open/refresh; retain existing light/dark palettes; API writes use existing cookie authentication and antiforgery protection.  
**Scale/Scope**: One small preference record per user; one shared header selector; no new app-wide settings framework.

## Constitution Check

### Pre-Research Gate

- **I. Tooling, UI, and Architecture / ARC-001**: PASS. UI remains in `clutch-web`; API, application behavior, and EF persistence remain in their current projects and layers. No .NET UI or new project boundary is proposed.
- **II. .NET Service Best Practices / DOT-001**: PASS. API/service work targets the existing .NET 10 project, uses DI, async I/O, and cancellation tokens.
- **III. Data Access, Async, and Performance / DOT-002**: PASS WITH REQUIRED IMPLEMENTATION REVIEW. Use EF Core only, no-tracking for preference reads, and a user-keyed write/upsert. The implementation must receive an independent review of generated SQL/query shape and indexing; SQL Server integration tests use the production provider.
- **IV. Testing and Quality Gates / ENG-001**: PASS. Add API, frontend behavior, and critical browser-journey coverage; run the applicable checks before completion.
- **V. Security and Error Handling / SEC-001**: PASS WITH REQUIRED IMPLEMENTATION REVIEW. Derive user identity from the authenticated principal, validate the mode at the API boundary, rely on existing antiforgery enforcement for writes, runtime-validate API responses, and complete an independent OWASP Top 10 review.
- **V. Security and Error Handling / SEC-002, SEC-003**: NOT APPLICABLE. The feature adds no secrets, credentials, payment data, or sensitive diagnostics.
- **VI. Frontend Engineering / WEB-001**: PASS. Use strict TypeScript, React function components/hooks, React Query for server state, Zod at the API boundary, semantic theme tokens, mobile-first layout, and accessible user-observable tests.
- **VII. Performance and Availability**: PASS. Update the client appearance immediately; report save failures visibly and do not make persistence a prerequisite for the current visit.
- **VIII. Observability**: NOT APPLICABLE. Preference operations are short request/response work and do not add a long-running task or transaction-import metric.
- **Service Operations and Data Changes / OPS-001**: PASS. Add a backwards-compatible migration for a new optional preference table, review it for data loss, and retain Light as the fallback for existing users.

**Gate result**: No unresolved constitutional conflicts. Required implementation-time reviews and tests are explicit above.

## Project Structure

### Documentation (this feature)

```text
specs/004-theme-selector/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── theme-preferences.md
```

### Source Code

```text
src/
├── Clutch.API/
│   ├── Api/Endpoints/                 # Authenticated GET/PUT theme preference endpoints
│   ├── Application/                   # Preference read/write service and mode validation
│   ├── Domain/                        # Theme mode value/type, separate from HTTP and EF
│   └── Infrastructure/Persistence/   # User preference entity, EF mapping, migration
└── clutch-web/
    └── src/
        ├── App.tsx                    # Shared authenticated header selector
        ├── components/theme/           # Theme state/provider and OS preference handling
        ├── features/preferences/      # Typed preference API integration, if needed
        └── lib/api/                   # Runtime schemas for the preference contract

tests/Clutch.API.Tests/
├── Integration/                       # SQL Server persistence, auth, and cross-client behavior
└── Unit/                               # Mode validation/service behavior where isolated
src/clutch-web/
├── src/                               # Accessible selector and theme behavior tests
└── e2e/                               # Authenticated responsive theme journey
```

**Structure Decision**: Extend the existing two-project web application and its existing API test project. Keep the preference API in the current endpoint/application/persistence layering; keep the selector in the shared authenticated header and theme behavior in the existing theme component area. Avoid a new project or general-purpose preference framework.

## Complexity Tracking

No constitutional violations or additional complexity require justification.

## Phase 0: Outline & Research

See [research.md](./research.md). Repository patterns resolve the relevant integration questions; no NEEDS CLARIFICATION items remain.

## Phase 1: Design & Contracts

- [data-model.md](./data-model.md) defines the user-scoped preference and effective appearance.
- [contracts/theme-preferences.md](./contracts/theme-preferences.md) defines the authenticated API interface and error behavior.
- [quickstart.md](./quickstart.md) defines runnable validation scenarios and expected outcomes.

### Post-Design Constitution Check

- **I / ARC-001**: PASS. No project boundary changes; service and persistence remain separated from endpoint/UI code.
- **II / DOT-001**: PASS. Existing .NET 10, DI, async, cancellation, and warning-as-error conventions apply.
- **III / DOT-002**: PASS WITH REQUIRED IMPLEMENTATION REVIEW. A primary-key lookup by authenticated user ID and a single-row write are sufficient; use EF Core and validate query/index behavior in the required independent review. SQL Server integration tests verify persistence, authorization, and last-save-wins behavior.
- **IV / ENG-001**: PASS. The validation guide includes backend integration, frontend accessible behavior, end-to-end responsiveness/accessibility, and required quality gates.
- **V / SEC-001**: PASS WITH REQUIRED IMPLEMENTATION REVIEW. The contract does not accept a user ID, write endpoints remain authenticated and antiforgery-protected, values are allow-listed, and frontend boundary data is runtime-validated. An independent OWASP review remains a completion gate.
- **VI / WEB-001**: PASS. Use a native labeled select for keyboard/pointer behavior and narrow layouts; use the existing semantic tokens and React Query boundary. No new dependency is required.
- **VII / Performance and Availability**: PASS. Apply mode changes in the client before awaiting the save; show a visible failure state if synchronization fails.
- **OPS-001**: PASS. The migration only adds a nullable-by-presence user preference table with cascading ownership; existing users read as Light. Review the migration for data loss.

**Post-design gate result**: PASS. No gate failures or unresolved clarifications.
