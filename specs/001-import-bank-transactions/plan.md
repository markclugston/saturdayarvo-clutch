# Implementation Plan: Import Bank Transactions

**Branch**: `001-import-bank-transactions` (planned; current checkout is `main`) | **Date**: 2026-11-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-import-bank-transactions/spec.md`

## Summary

Deliver an owner-only Family, authenticated multi-currency accounts, safe CSV transaction review/import, duplicate warnings, and runtime-configurable import limits. Add an ASP.NET Core Identity cookie-authenticated .NET 10 API, EF Core persistence on SQL Server, and a React/TypeScript same-origin frontend. Stream and validate uploads on the server, use a version-controlled currency-format registry for deterministic strict parsing, discard source files after parsing, stage only mapped rows in short-lived reviews, and atomically persist all rows after explicit confirmation.

## Technical Context

**Language/Version**: C# on .NET 10; TypeScript with strict mode and `noUncheckedIndexedAccess`.

**Primary Dependencies**: ASP.NET Core Identity cookie endpoints, EF Core 10 with Microsoft SQL Server provider, CsvHelper (server-side CSV parsing); React 19, Vite, PapaParse for client-side header-only inspection, Tailwind CSS 4 and existing shadcn/ui primitives.

**Storage**: SQL Server for Identity, owner-only Families, accounts, transactions, short-lived normalized import reviews, administrator import settings, and safe import audit events. Uploaded source files are not retained after parsing.

**Testing**: xUnit, NSubstitute and WebApplicationFactory; SQL Server disposable-container integration tests; frontend unit/component tests with Vitest and Testing Library; browser-level critical journeys with Playwright. Frontend linting must use typescript-eslint; type-check with `tsc --noEmit`.

**Target Platform**: Same-origin browser SPA and ASP.NET Core 10 API; deployment hosting is configured by the application environment.

**Project Type**: Web application (`src/Clutch.API`, `src/clutch-web`).

**Performance Goals**: Support the configured defaults of 10 MiB and 10,000 rows using streaming parsing and bounded request processing; preserve all-or-nothing imports. The spec defines no separate latency objective.

**Constraints**: One active import per account; acquire a database-coordinated lease before review and use current transaction state for duplicate checks and confirmation. Imports require authorization, complete validation, and explicit confirmation. Currency import parsing uses a version-controlled registry keyed by ISO 4217 code, with strict separator validation and explicit user selection for multiple or ambiguous conventions; display formatting remains locale-aware. Defaults are 10 MiB/file, 10,000 rows/import, and five attempts/user/minute; administrators can persistently change them at runtime. Reject sensitive identifier patterns without echoing or logging values. Follow system light/dark preference without an application override. Inherit application availability/recovery targets.

**Scale/Scope**: One owner-only Family per user, account-scoped transactions and bounded CSV imports up to the configured limits. Family invitations, additional members, account-access grants, multiple Family membership, direct bank connections, currency conversion, transaction editing, and automatic duplicate removal are outside this feature.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Constitution requirements: Keep domain behavior independent of HTTP and persistence; keep UI in `clutch-web`; use Identity/DI and async I/O; validate and authorize on the server; verify all behavior with relevant tests; never expose or log credentials, PAN, rejected identifiers, raw CSV data, or sensitive error values.
- Applicable standards:
  - **ARC-001** — `standards/architecture/architecture-boundaries.md`: preserve API/domain/infrastructure/UI boundaries; register services and providers through DI; use modern C# features only when they improve clarity.
  - **DOT-001** — `standards/dotnet/dotnet-service-practices.md`: target .NET 10, enable nullable/implicit usings/code-style enforcement/warnings-as-errors, use cancellable async I/O, dispose upload/database resources deterministically.
  - **DOT-002** — `standards/dotnet/ef-core-data-access-performance.md`: use EF Core async access, no-tracking reads where appropriate, migrations, production-provider integration tests, and an independent SQL/query-shape review.
  - **ENG-001** — `standards/engineering/testing-and-quality-gates.md`: test behavior in each project; use xUnit/NSubstitute and applicable WebApplicationFactory tests; resolve findings and pass quality gates.
  - **OPS-001** — `standards/operations/reliability-and-data-changes.md`: structured safe logs, health checks, reviewed migrations, and rollback plan for schema changes.
  - **SEC-001** — `standards/security/pci-dss-controls.md`: enforce authenticated account authorization and validation server-side; perform independent OWASP Top 10/dependency review; document PCI scope impact and where approved control evidence is recorded.
  - **SEC-002** — `standards/security/secrets-and-keys.md`: keep identity secrets out of source, browser storage, bundles, and logs; provision administrators through protected configuration.
  - **SEC-003** — `standards/security/logging-and-pan-handling.md`: typed validation failures and RFC 9457 `ProblemDetails`; never log or echo credentials, PAN, identifiers, descriptions, amounts, or raw file content.
  - **WEB-001** — `standards/web/frontend-engineering.md`: strict TypeScript and runtime boundary validation, accessible responsive light/dark UI following system preference, Tailwind/shadcn patterns, component and browser-level tests, typecheck/lint/build CI.
- Conflicts: None identified. The feature extends the spec with the user's runtime limit configuration clarification and records it as FR-029.
- **Gate status**: Design is consistent with the constitution and standards. The PCI evidence location is `compliance/pci/`, established per user direction. **Acceptance prerequisite**: Complete the preliminary [PCI scope assessment](../../compliance/pci/001-import-bank-transactions-scope.md) against the implemented deployment and record its evidence before implementation acceptance. It identifies potentially affected components but does not make a final scope determination. The feature must not persist cardholder data.

## Project Structure

### Documentation (this feature)

```text
specs/001-import-bank-transactions/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/openapi.yaml
└── tasks.md                 # Created by /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── Clutch.API/
│   ├── Api/                     # Endpoint groups, auth and antiforgery boundaries
│   ├── Application/             # Family, account, transaction and import use cases
│   ├── Domain/                  # Account, transaction, review and settings rules
│   ├── Infrastructure/          # Identity, EF Core, migrations, CSV parser, audit
│   └── Program.cs
└── clutch-web/
    ├── src/
    │   ├── features/families/
    │   ├── features/accounts/
    │   ├── features/imports/
    │   ├── features/admin/
    │   ├── lib/api/
    │   └── components/
    └── e2e/
tests/
└── Clutch.API.Tests/
    ├── Unit/
    └── Integration/
```

**Structure Decision**: Keep the existing API and frontend projects. Introduce clear application/domain/infrastructure/API boundaries inside `Clutch.API` so CSV, authorization, and transaction rules remain independent of HTTP and EF Core. Add an xUnit test project and browser-level frontend tests; the solution currently contains only the API and has no test projects.

## Phase 0: Research

Completed in [research.md](./research.md). Decisions cover browser-cookie Identity, explicit JSON antiforgery, SQL Server/EF Core, header-only browser mapping and authoritative streamed server parsing, data minimization, database-backed account import coordination and rate windows, a version-controlled ISO-code currency-format registry with CLDR/ISO display, and runtime administrator limits.

## Phase 1: Design

- Entity and state definitions: [data-model.md](./data-model.md).
- External API, auth/CSRF requirements, payloads, and problem responses: [contracts/openapi.yaml](./contracts/openapi.yaml).
- End-to-end setup and verification: [quickstart.md](./quickstart.md).
- Account, import, and administrator screens share a system color-scheme provider; browser verification covers OS preference changes and confirms that no application-level override is available.
- Currency parsing follows the application-maintained registry described in [research.md](./research.md); update the registry with reference/version metadata and test strict parsing, multiple conventions, and ambiguous values. Production hosting is deployment-specific and does not change the API contract.
- Post-design Constitution Check: all applicable standards above are represented in the architecture, data model, contracts, and validation guide. No standard conflict was identified. The evidence location is established at `compliance/pci/`; the preliminary PCI scope assessment requires deployment verification and a final decision before implementation acceptance. Family access is owner-only in this feature; future member sharing is explicitly out of scope.

## Complexity Tracking

No constitution violations or unjustified architectural complexity identified.
