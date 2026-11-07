# Implementation Plan: Save Account Import Settings

**Branch**: `002-save-import-settings` (planned; current checkout is `main`) | **Date**: 2026-11-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-save-import-settings/spec.md`

## Summary

Persist the exact CSV mapping used by each successful import as that account's sole default. Reuse it for later imports, with an explicit way to inspect or change it; keep the existing validation, review, duplicate, confirmation, and account-authorization flow. Store configuration only, and save it after transaction persistence so a settings-write failure cannot undo an otherwise successful import.

## Technical Context

**Language/Version**: C# on .NET 10; TypeScript 5.9 with strict mode and `noUncheckedIndexedAccess`.

**Primary Dependencies**: Existing ASP.NET Core minimal API and Identity cookie authentication, EF Core 10 with SQL Server, OpenTelemetry hosting and OTLP metrics export, React 19, TanStack Query, Zod, PapaParse, and existing Tailwind/shadcn components.

**Storage**: SQL Server through EF Core. Add one account-scoped saved-settings record and retain the mapping snapshot only while its import review is active.

**Testing**: xUnit, NSubstitute, WebApplicationFactory, and disposable SQL Server integration tests; Vitest and Testing Library for frontend behavior; Playwright for the critical browser journey. Use the existing TypeScript typecheck, lint, test, and production build scripts.

**Target Platform**: Same-origin browser SPA and ASP.NET Core 10 API.

**Project Type**: Web application (`src/Clutch.API`, `src/clutch-web`).

**Performance Goals**: The specification sets no additional latency target. Each import requires at most one small settings read and one conditional settings write, in addition to the existing import operations.

**Constraints**: Settings are account-scoped configuration only. Save only after successful transaction confirmation; keep old defaults if the save fails; prevent a delayed save from an older successful import replacing newer defaults. Preserve existing file/transaction validation, review, duplicate warnings, confirmation, concurrency, and owner authorization. The UI follows the operating-system light/dark preference with no application override or theme persistence, supports keyboard access and WCAG 2.2 AA, and responds within 500 ms or shows a busy/progress state. Preserve or add required import outcome and duration metrics without sensitive dimensions.

**Scale/Scope**: One current import mapping per account; CSV transaction imports only. Named profiles, sharing settings between accounts, standalone settings management, and bank connections remain out of scope.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Constitution requirements**: Keep import rules in the existing application/domain layers, persistence in EF Core infrastructure, HTTP behavior in API endpoints, and UI in `clutch-web` (Principle I). Enforce account ownership at the server boundary, validate untrusted input, keep transaction and defaults-save outcomes distinct, and omit sensitive values from logs (Principle V). Use async EF Core and appropriate no-tracking reads, test database behavior with SQL Server integration tests, and obtain an independent query review (Principle III). Cover API, UI, and browser behavior with tests; meet responsive, keyboard, WCAG 2.2 AA, theme, TypeScript, and frontend CI requirements (Principles IV and VI). Meet the 500 ms response/busy-state requirement and preserve required import outcome metrics (Principles VII and VIII). Review the migration and rollback approach (Engineering Requirements: Service Operations and Data Changes).
- **Applicable constitutional requirements**: `.specify/memory/constitution.md` is the authoritative source; its Requirement Applicability Index identifies the relevant IDs:
  - **ARC-001** — Principle I: preserve project/layer boundaries and register services through dependency injection.
  - **DOT-001** — Principle II: remain on .NET 10 and use cancellable asynchronous I/O.
  - **DOT-002** — Principle III: use async EF Core, appropriate no-tracking reads, SQL Server integration coverage, and an independent query review.
  - **ENG-001** — Principle IV: test changed behavior and pass relevant quality gates.
  - **OPS-001** — Engineering Requirements: Service Operations and Data Changes: review migration data-loss risk and retain a rollback approach.
  - **SEC-001** — Principle V: enforce authorization, perform an independent OWASP review, and check dependencies for known vulnerabilities and remediate findings.
  - **SEC-003** — Principle V: report transaction success separately from defaults-save failure and omit sensitive mapping, transaction, account, and file data from logs and diagnostics.
  - **WEB-001** — Principle VI: use strict TypeScript, runtime-validated API schemas, accessible responsive UI, existing frontend patterns, and component/browser tests.
  - **SEC-002** does not apply because this feature does not handle secrets, credentials, keys, certificates, or cryptographic material.
- **Conflicts**: None identified. The separate post-import settings write preserves imported transactions if saving defaults fails.
- **Gate status before research**: Pass. The constitution is the authoritative requirements source; all applicable indexed requirements are identified above. Existing API, persistence, import, and frontend patterns establish the technical context.

## Project Structure

### Documentation (this feature)

```text
specs/002-save-import-settings/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── openapi.yaml
└── tasks.md                 # Created by /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── Clutch.API/
│   ├── Api/Endpoints/ImportEndpoints.cs
│   ├── Application/Imports/
│   ├── Domain/Imports/ImportReview.cs
│   ├── Infrastructure/Persistence/
│   │   ├── AppDbContext.cs
│   │   ├── Entities/
│   │   └── Migrations/
│   └── Infrastructure/DependencyInjection.cs
└── clutch-web/
    ├── src/features/imports/
    ├── src/lib/api/schemas.ts
    └── e2e/
tests/
└── Clutch.API.Tests/
    ├── Integration/Imports/
    └── Unit/Imports/
```

**Structure Decision**: Extend the existing import API, application services, EF Core persistence, and `clutch-web` import feature. Keep the mapping format shared with the existing import flow, add account-scoped persistence through the existing database context and DI, and do not add projects or a separate settings-management surface.

## Phase 0: Research

Findings are in [research.md](./research.md). Research confirms the existing EF Core settings and account-ownership patterns, the review/confirmation lifecycle, and a post-commit, account-version-guarded settings upsert to preserve the specified failure and concurrency behavior.

## Phase 1: Design

- Entity and state definitions: [data-model.md](./data-model.md).
- External API, authorization, antiforgery, and response semantics: [contracts/openapi.yaml](./contracts/openapi.yaml).
- End-to-end setup and verification: [quickstart.md](./quickstart.md).
- Theme behavior is unchanged: follow the system light/dark preference without an application override or stored theme.
- **Post-design Constitution Check**: Pass. The data model is account-scoped and stores configuration only; the API preserves owner authorization and the existing import review/confirmation contract; and the separate, guarded save reports failure without rolling back transactions. Acceptance must include a reviewed EF migration and rollback approach, SQL Server integration tests, independent query and security reviews, and required import metrics.

## Complexity Tracking

No constitution violations or unjustified architectural complexity identified.
