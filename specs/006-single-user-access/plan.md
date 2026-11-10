# Implementation Plan: Single-Person Data Access

**Branch**: `agents/remove-multi-user-support` | **Date**: 2026-11-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-single-user-access/spec.md`

## Summary

Remove the single-owner `Family` container and its setup flow, and associate each financial account directly with its one authorized individual. Preserve existing account ownership by migrating each account's current Family owner to the account; retain accounts whose owner cannot be established but leave them inaccessible. Keep account, transaction, and import behavior available to the owning individual, including access from multiple sessions and management of multiple accounts. This feature covers financial accounts and their associated transaction and import data; authentication identities and unrelated user preferences remain unchanged.

## Technical Context

**Language/Version**: C# 14 / .NET 10; TypeScript 5.9

**Primary Dependencies**: ASP.NET Core minimal APIs; ASP.NET Core Identity; EF Core 10 with SQL Server; React 19; TanStack Query; Zod

**Storage**: SQL Server, accessed through EF Core

**Testing**: xUnit and Testcontainers for API/integration tests; Vitest and Testing Library for frontend tests; Playwright for browser-level journeys

**Target Platform**: ASP.NET Core web API and browser-based `clutch-web`

**Project Type**: Web application with API and frontend

**Performance Goals**: No new numeric targets. Preserve existing response behavior; any database query changes must avoid unnecessary round trips and retain owner-filtered access.

**Constraints**: Preserve existing account and account-related data during schema changes. An account whose individual owner cannot be established must remain inaccessible to ordinary users until an authorized out-of-band data repair assigns a valid owner; do not add a user-facing owner-resolution workflow. Enforce ownership at the API/service boundary; do not rely on frontend visibility. The existing Family model has one owner and no membership or shared-access records; remove that obsolete grouping without adding or migrating shared access. Preserve theme choices (Light, Dark, System), Light default while a preference loads, signed-in user preference persistence, and System-mode response to operating-system changes. No new dependencies or user-facing account-sharing flows.

**Scale/Scope**: One individual owner per account; each individual may own multiple accounts and use multiple devices or sessions. Remove family setup and shared-access concepts, not multi-account support.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Requirement | Gate | Plan compliance |
|---|---|---|
| ARC-001 / Principle I | Pass | Keep the API, domain, persistence, and `clutch-web` boundaries. Remove the family abstraction rather than introduce a new application layer or unrelated capability. |
| DOT-001 / Principle II | Pass | Continue using the existing .NET 10 service conventions, nullable types, asynchronous EF Core operations, cancellation, and existing dependency injection. |
| DOT-002 / Principle III | Pass | Use EF Core for the ownership query changes and migration. Review generated SQL/query shape, preserve indexes and avoid extra round trips; verify migrations and ownership behavior using SQL Server integration tests. |
| ENG-001 / Principle IV | Pass | Add/update API, migration, frontend, and browser tests for changed behavior. Validation is agent-executable; no manual test gate is introduced. |
| OPS-001 / Service Operations and Data Changes | Pass | Backfill account owner identifiers before removing family relationships, preserve account-related records, and provide a safe migration rollback strategy. |
| SEC-001 / Principle V | Pass | Enforce per-account owner authorization on every protected operation and test cross-user denial. Review changed code for OWASP Top 10 issues before completion. |
| SEC-003 / Principle V | Pass | Preserve transaction/import data while ensuring account ownership filters also protect related records. Keep sensitive financial information out of logs and diagnostics. |
| WEB-001 / Principle VI | Pass | Remove the obsolete family onboarding screen; retain keyboard-accessible account flows, React Query/Zod usage, and the specified Light/Dark/System theme choices, default, persistence, and System behavior. Update strict TypeScript schemas, component tests, and Playwright coverage. |
| Principles VII–VIII | Pass | No availability, performance, or observability behavior is intentionally changed. Retain existing action feedback and metrics; verify changed database paths do not add avoidable latency. |

No constitution conflicts or unjustified complexity are identified.

## Project Structure

### Documentation (this feature)

```text
specs/005-single-user-access/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── account-ownership.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── Clutch.API/
│   ├── Api/Endpoints/                 # Account APIs; remove family endpoint mapping
│   ├── Application/                   # Account, transaction, and import ownership checks
│   ├── Domain/Accounts/               # Account owner identity
│   └── Infrastructure/Persistence/    # EF model and ownership-preserving migration
└── clutch-web/
    ├── src/App.tsx                    # Remove family setup gate
    ├── src/features/accounts/         # Account experience remains available
    └── src/lib/api/schemas.ts         # Account response validation
tests/
└── Clutch.API.Tests/
    ├── Integration/                   # Ownership, migration, API and related-data coverage
    └── Unit/                          # Account domain coverage
```

**Structure Decision**: Retain the existing API/frontend solution layout. Remove the family domain/service/endpoint and frontend feature, update account ownership across the API and data services, and keep tests in the existing API test project and frontend test suites.

## Phase 0: Outline & Research

The existing code and project standards resolve all technical-context questions; there are no new technology choices or external integrations to research.

1. The existing `Family` is a one-owner record with a unique owner and no membership/invitation model. Its removal eliminates a misleading grouping layer; no multi-person permission records currently exist to remove or migrate.
2. `Account.FamilyId` is the current ownership path used by account, transaction, import, and import-settings services. Replace those ownership joins with a direct account-owner comparison and keep the authenticated identity as the authority.
3. The existing family-accounts migration establishes a required Family relationship and each Family has one required Identity owner. Backfill account owners only when the Family owner identifier resolves to an Identity user, preserve accounts with unresolved owners as inaccessible, then remove the Family relationship. The SQL Server migration test will simulate a legacy constraint violation by inserting a Family with a non-resolving Identity owner while retaining a valid account-to-Family relationship. Account-linked transactions, settings, and import records remain associated by account ID. A downgrade can recreate family rows for known owners; it must fail without changing data if unresolved ownerless accounts remain.
4. The project already uses ASP.NET Core Identity, SQL Server/EF Core, React/TypeScript, xUnit/Testcontainers, Vitest, and Playwright. Continue with these established technologies and validation patterns.

**Gate**: No `NEEDS CLARIFICATION` items remain.

## Phase 1: Design & Contracts

1. Model an account as owned by one Identity user, with an explicit unassigned legacy state for records whose owner cannot be resolved.
2. Keep the existing account routes and account operations; remove family setup and family routes. The account response no longer exposes `FamilyId`.
3. Validate owner-preserving migration and safe downgrade behavior, cross-user denial, and account-linked data preservation with API integration tests; validate onboarding/account flows with frontend and browser tests.

**Gate**: The proposed schema migration retains account and related records, and every user-facing account operation is scoped to the authenticated individual.

**Post-design Constitution Check**: PASS. The direct ownership model preserves the established architecture; EF Core remains the only database access path; migration backfill and guarded downgrade protect existing data; owner checks remain server-enforced; API, frontend, integration, and browser tests cover the changed behavior; theme behavior is explicitly preserved; and separate tasks require independent SQL/query and OWASP reviews. No constitutional deviations were introduced.

## Complexity Tracking

No constitution violations require justification.
