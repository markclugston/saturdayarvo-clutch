# Implementation Plan: Categories and Groups Screen

**Branch**: `007-categories-groups` | **Date**: 2026-11-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/007-categories-groups/spec.md`

## Summary

Add a Categories screen beside Accounts where a signed-in user creates, renames, and deletes groups and nested categories. One self-referencing node type represents both (no parent means group). New items go to the bottom of their sibling list, there is no reordering, and sibling names are unique case-insensitively. The screen shows groups in larger text, indents categories by depth, and leaves a gap between groups. Deleting warns and removes the item with its descendants. A header navigation of buttons switches between Accounts and Categories.

## Technical Context

**Language/Version**: C# 14 / .NET 10; TypeScript 5.9

**Primary Dependencies**: ASP.NET Core minimal APIs; EF Core 10 with SQL Server; React 19; TanStack Query; Zod; Tailwind; shadcn/ui. No new dependencies.

**Storage**: SQL Server through EF Core; new `CategoryNodes` table via migration

**Testing**: xUnit and Testcontainers for API; Vitest and Testing Library for frontend; Playwright for end-to-end

**Target Platform**: ASP.NET Core web API and browser-based `clutch-web`

**Project Type**: Web application with API and frontend

**Performance Goals**: Actions respond within 500 ms, with a busy state otherwise. Tree load is one query per request.

**Constraints**: Server-side validation and per-user ownership on every endpoint. Light and dark themes, keyboard access, WCAG 2.2 AA. Buttons rather than links. No reorder or move.

**Scale/Scope**: One user's personal list, expected to be tens to a few hundred nodes; unlimited nesting depth.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Requirement | Gate | Plan compliance |
|---|---|---|
| ARC-001 / Principle I | Pass | Follows existing Domain, Application, Infrastructure, and Api layering with services registered by dependency injection. UI stays in `clutch-web`. Only requested features: create, rename, delete, view, navigation. |
| DOT-001 / Principle II | Pass | .NET 10 conventions, nullable types, async EF Core calls with cancellation, `Async` suffix. |
| DOT-002 / Principle III | Pass | EF Core only; `AsNoTracking` for the tree read; one query loads the tree and subtree deletes; unique and lookup indexes defined; SQL Server integration tests; independent query review required. |
| ENG-001 / Principle IV | Pass | xUnit tests for domain rules, service, endpoints, and migration; frontend component tests; Playwright journey. All agent-executable. |
| OPS-001 / Service Operations and Data Changes | Pass | Migration adds one table only; no data loss; rollback by dropping the table. |
| SEC-001 / Principle V | Pass | Authorization and owner filtering at the API boundary, validated input, typed errors, `ProblemDetails`; cross-user access returns 404. OWASP Top 10 review before completion. |
| SEC-003 / Principle V | Pass | No sensitive financial data involved; names are not logged beyond structured IDs; errors disclose nothing extra. |
| WEB-001 / Principle VI | Pass | Function components and hooks; React Query for server state; Zod runtime validation of responses; typed `ProblemDetails` handling; Tailwind with theme tokens and `cn()`; navigation and actions are buttons with pointer cursors; stable ID keys; light/dark via the existing persisted theme selector; keyboard access and role/name based tests; `tsc --noEmit` and zero-warning lint. |
| Principle VII | Pass | Busy state on pending actions; no availability impact. |
| Principle VIII | Pass | Existing failure metrics continue; no new long-running tasks. |

No conflicts or unjustified complexity identified. Re-check after design: still passes.

## Project Structure

### Documentation (this feature)

```text
specs/007-categories-groups/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── category-nodes.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── Clutch.API/
│   ├── Domain/Categories/              # CategoryNode, name validation
│   ├── Application/Categories/         # CategoryNodeService, tree ordering, typed results
│   ├── Infrastructure/Persistence/     # DbContext mapping, indexes, migration
│   └── Api/Endpoints/                  # CategoryNodeEndpoints
└── clutch-web/
    ├── src/features/categories/        # CategoriesPage, api, hooks, delete dialog
    ├── src/lib/api/schemas.ts          # Zod schema for items
    ├── src/App.tsx                     # Header navigation buttons
    └── e2e/categories-groups.spec.ts
tests/
└── Clutch.API.Tests/                   # Domain, service, endpoint, migration tests
```

**Structure Decision**: Extend the existing API and web projects, mirroring the Accounts feature layout.

## Complexity Tracking

No constitution violations to justify.
