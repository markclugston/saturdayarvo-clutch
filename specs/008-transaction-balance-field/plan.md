# Implementation Plan: Optional Transaction Balance Field

**Branch**: `007-transaction-balance-field` | **Date**: 2026-11-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-transaction-balance-field/spec.md`

## Summary

Add an optional, bank-supplied (never calculated) balance to transactions. The import mapping gains an optional balance column. Because mappings are stored as versioned JSON, the new optional property is saved and loaded with the other settings without a settings schema change. The balance is parsed with the existing amount parsing rules (signed values allowed), carried through the import review rows into confirmed transactions, returned by the transactions API, and shown as the right-most column of the transaction list only when at least one listed transaction has a balance.

## Technical Context

**Language/Version**: C# on .NET 10 (Clutch.API); TypeScript strict with React (clutch-web)

**Primary Dependencies**: ASP.NET Core minimal APIs, EF Core, CsvHelper; React, TanStack Query, zod, Tailwind, shadcn/ui

**Storage**: Relational database via EF Core; new nullable decimal columns on `Transactions` and `ImportReviewRows` (one migration); mapping stored in existing `SettingsJson` / `MappingJson`

**Testing**: xUnit + NSubstitute, API integration tests with disposable container; Vitest + Testing Library; Playwright e2e

**Target Platform**: Web application (API + SPA)

**Project Type**: web-service + web-application

**Performance Goals**: No change to existing list/import responsiveness (constitution VII, 500 ms user-visible response)

**Constraints**: Backward compatible with saved settings and existing rows; no new dependencies

**Scale/Scope**: Two nullable columns, one optional mapping property, one list column

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| ID | Requirement | Status |
|---|---|---|
| ARC-001 | Only specified behavior; domain decoupled from HTTP/persistence; UI in clutch-web | Pass – no extra parameters; balance only where specified |
| DOT-001 | .NET 10, nullable, async, warnings as errors | Pass – follows existing code |
| DOT-002 | EF Core only; migration reviewed; independent SQL/query review | Pass – additive nullable columns, no new queries or indexes; independent review of the migration and the transaction list/duplicate queries is a task |
| ENG-001 | Tests for added behavior; agent-executable checks only | Pass – unit, integration, component, and Playwright tests planned |
| SEC | Server-side validation of untrusted input; no sensitive data in logs; OWASP review | Pass – balance validated server-side by existing parser; never logged; review is a task |
| FE | zod runtime validation, Tailwind/`cn()`, theme tokens, a11y, no hyperlinks | Pass – schema extended; table column uses existing styles |
| OPS-001 | Migration data-loss review and rollback | Pass – additive nullable columns; rollback drops the columns (loses only balance data) |

Post-design re-check: no violations; Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/007-transaction-balance-field/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── api-changes.md
└── tasks.md             # created by /speckit-tasks
```

### Source Code (repository root)

```text
src/Clutch.API/
├── Domain/Transactions/Transaction.cs              # optional Balance
├── Domain/Imports/ImportReviewRow.cs               # optional Balance
├── Application/Imports/ImportMapping.cs            # BalanceColumn; ParsedImportRow.Balance
├── Application/Imports/ImportMappingValidator.cs   # balance column range/uniqueness
├── Application/Imports/ImportReviewService.cs      # carry balance into review rows
├── Application/Imports/ConfirmImportService.cs     # copy balance to transactions
├── Application/Transactions/TransactionService.cs  # list item Balance
├── Infrastructure/Imports/CsvImportParser.cs       # parse balance
└── Infrastructure/Persistence/                     # AppDbContext config + new migration

src/clutch-web/src/
├── lib/api/schemas.ts                              # balanceColumn, balance
├── features/imports/ImportMappingForm.tsx          # optional balance column select
├── features/imports/ImportPage.tsx / api.ts        # mapping payload
└── features/accounts/TransactionsTable.tsx         # conditional Balance column

tests: Clutch.API test projects, *.test.tsx beside components, e2e/import-settings.spec.ts
```

**Structure Decision**: Existing web-service + web-application layout; changes are additive within current files.
