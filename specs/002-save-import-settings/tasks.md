---
description: "Implementation tasks for saving account-scoped import settings"
---

# Tasks: Save Account Import Settings

**Input**: Design documents from `specs/002-save-import-settings/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/openapi.yaml`, `quickstart.md`

**Tests**: Tests are included because the feature specification and applicable constitutional requirements require API, persistence, frontend, and browser-level coverage.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Applicable Constitutional Requirements

- **ARC-001** — `.specify/memory/constitution.md` (Principle I): preserve layer boundaries and register new services through DI.
- **DOT-001** — `.specify/memory/constitution.md` (Principle II): .NET 10, cancellable asynchronous I/O, nullable-safe implementation.
- **DOT-002** — `.specify/memory/constitution.md` (Principle III): async EF Core, no-tracking reads, SQL Server integration tests, and independent query-shape review.
- **ENG-001** — `.specify/memory/constitution.md` (Principle IV): test changed behavior and pass relevant quality gates.
- **OPS-001** — `.specify/memory/constitution.md` (Service Operations and Data Changes): structured non-sensitive failure logs and reviewed/rollback-capable migrations.
- **SEC-001** — `.specify/memory/constitution.md` (Principle V): account authorization, OWASP review, and dependency review.
- **SEC-003** — `.specify/memory/constitution.md` (Principle V): typed errors and no sensitive mapping, transaction, or file data in logs/responses.
- **WEB-001** — `.specify/memory/constitution.md` (Principle VI): runtime API validation, accessible responsive UI, frontend tests, and browser-level coverage.

**SEC-002** does not apply because this feature does not handle secrets, credentials, keys, certificates, or cryptographic material.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other tasks in the phase because it has no dependency on their incomplete work and changes a separate file.
- **[Story]**: The user story served by a task (`US1`, `US2`, or `US3`).
- Every task specifies the target file or directory and a completion criterion.

## Path Conventions

The implementation uses the existing projects: `src/Clutch.API`, `src/clutch-web`, and `tests/Clutch.API.Tests`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and shared structure.

No setup tasks are required; the existing .NET API, React application, test projects, and tooling are already in place.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Define persistence records and database mappings required by all user stories.

- [X] T001 [P] Add the account-scoped `AccountImportSettings` persistence entity and nullable latest-successful-review token to `src/Clutch.API/Infrastructure/Persistence/Entities/AccountImportSettings.cs` and `src/Clutch.API/Domain/Accounts/Account.cs`; settings are unique per account and the token is not user-visible (ARC-001, DOT-002).
- [X] T002 [P] Add the active-review mapping snapshot persistence entity to `src/Clutch.API/Infrastructure/Persistence/Entities/ImportReviewMappingSnapshot.cs`; it stores only review ID, schema version, and mapping JSON (DOT-002, SEC-003).
- [X] T003 Configure both entities, required account/review relationships, and account uniqueness in `src/Clutch.API/Infrastructure/Persistence/AppDbContext.cs`; model configuration must preserve existing account and review behavior (DOT-002).
- [X] T004 Generate the `SaveAccountImportSettings` EF Core migration in `src/Clutch.API/Infrastructure/Persistence/Migrations/` and update `src/Clutch.API/Infrastructure/Persistence/Migrations/AppDbContextModelSnapshot.cs`; include reversible schema changes without altering existing transaction data (DOT-002, OPS-001).

**Checkpoint**: Persistence model and schema are ready before story implementation begins.

---

## Phase 3: User Story 1 - Reuse settings for an account (Priority: P1) 🎯 MVP

**Goal**: Save the mapping used by a successfully confirmed import and retrieve the account's defaults for later imports.

**Independent Test**: Complete an import for an account with no defaults, then start another import for that account and verify the saved mapping is applied without showing the settings form by default; confirm review and transaction validation still occur.

### Tests for User Story 1

- [X] T005 [P] [US1] Add service tests in `tests/Clutch.API.Tests/Unit/Imports/AccountImportSettingsServiceTests.cs` for explicit empty settings, valid versioned mapping round-trip, and retrieval failure for an unsupported schema or invalid serialized mapping (ENG-001, SEC-003).
- [X] T006 [P] [US1] Add SQL Server integration coverage in `tests/Clutch.API.Tests/Integration/Imports/ImportWorkflowTests.cs` proving a confirmed import saves and returns the complete import configuration used (column mappings, date and amount formats, amount layout, and applicable direction/sign conventions) through a fresh request context, while an unconfirmed review does not save defaults (ENG-001, DOT-002).
- [X] T007 [P] [US1] Add API client tests in `src/clutch-web/src/features/imports/api.test.ts` for retrieving explicit empty or populated settings, surfacing retrieval errors, and parsing `settingsSaved` from confirmation responses (ENG-001, WEB-001).
- [X] T008 [P] [US1] Add import-page behavior tests in `src/clutch-web/src/features/imports/ImportPage.test.tsx` for applying saved defaults, showing the default notice and change button without initially showing the settings form, retaining the first-import flow when no defaults exist, and verifying retrieval/validation failures use accessible messages and an accessible settings-entry or correction action without implying defaults are active (ENG-001, WEB-001, SEC-003).
- [X] T009 [P] [US1] Add the critical browser journey in `src/clutch-web/e2e/import-settings.spec.ts`; cover a first import, defaults reuse on a later import, use of the same account's defaults in a separate browser/device context, the existing review and confirmation flow, and keyboard operation in supported responsive layouts under both system themes (ENG-001, WEB-001).

### Implementation for User Story 1

- [X] T010 [P] [US1] Capture the complete validated import configuration (column mappings, date and amount formats, amount layout, and applicable direction/sign conventions) in the active review snapshot and retain it only while the review is ready in `src/Clutch.API/Application/Imports/ImportReviewService.cs`; do not store source-file or transaction values (DOT-001, DOT-002, SEC-003).
- [X] T011 [P] [US1] Implement account settings read and persistence in `src/Clutch.API/Application/Imports/AccountImportSettingsService.cs`; validate and round-trip the complete configuration with existing mapping/parser rules, serialize it as a versioned settings object, use async EF operations and `AsNoTracking()` reads, and return a typed retrieval error rather than empty defaults on corruption (DOT-001, DOT-002, SEC-003).
- [X] T012 [US1] Extend confirmation handling in `src/Clutch.API/Application/Imports/ConfirmImportService.cs` and `src/Clutch.API/Api/Endpoints/ImportEndpoints.cs` to save the review snapshot only after the transaction commit and return `settingsSaved` separately; a defaults-save failure must leave the import successful and preserve prior defaults (DOT-001, DOT-002, SEC-003).
- [X] T013 [US1] Add `GET /api/accounts/{accountId}/import-settings` in `src/Clutch.API/Api/Endpoints/ImportEndpoints.cs`; resolve ownership using the existing Family-owner query and return `mapping: null` only when no settings record exists (SEC-001, SEC-003).
- [X] T014 [US1] Register the new settings service and persistence dependencies in `src/Clutch.API/Infrastructure/DependencyInjection.cs`; resolve them through the existing scoped DI conventions (ARC-001, DOT-001).
- [X] T015 [P] [US1] Add Zod response schemas for account import settings and the `settingsSaved` confirmation field in `src/clutch-web/src/lib/api/schemas.ts`; reject malformed responses at runtime (WEB-001).
- [X] T016 [US1] Add the typed settings GET and confirmation response parsing to `src/clutch-web/src/features/imports/api.ts`; preserve typed RFC 9457 error handling and distinguish retrieval failure from an explicit empty result (WEB-001, SEC-003).
- [X] T017 [US1] Update `src/clutch-web/src/features/imports/ImportPage.tsx` to fetch settings for the selected account, apply retrievable defaults without initially showing the settings form, show an accessible default-settings notice and view/change button, and offer the existing settings flow when no defaults exist or retrieval fails without falsely claiming defaults are active (WEB-001, SEC-003).

**Checkpoint**: A successful import's mapping is applied on the next import for that account; no defaults are created by review alone, and existing validation/review/confirmation remain active.

---

## Phase 4: User Story 2 - View and change saved settings (Priority: P1)

**Goal**: Apply saved defaults to later imports without showing the settings form initially, while keeping an accessible way to inspect and edit them.

**Independent Test**: With saved settings, open the settings form from the change button, verify current values are prefilled, change them, and confirm the successful import makes the changed mapping the default for the next import.

### Tests for User Story 2

- [X] T018 [US2] Extend `src/clutch-web/src/features/imports/ImportPage.test.tsx` to verify opening saved settings prepopulates editable values, changed values are submitted and become the next-import defaults after confirmation, incompatible mappings show an accessible explanation and correction action, and changed controls are keyboard-operable (ENG-001, WEB-001, SEC-003).

### Implementation for User Story 2

- [X] T019 [US2] Extend `src/clutch-web/src/features/imports/ImportMappingForm.tsx` to accept and display the current mapping as editable initial values, retaining all existing mapping options and accessible controls (WEB-001).
- [X] T020 [US2] Update `src/clutch-web/src/features/imports/ImportPage.tsx` to open the existing mapping form from the change button, prefill saved values, allow edits before proceeding, and explain saved-mapping validation problems while keeping correction available (WEB-001, SEC-003).

**Checkpoint**: Saved settings are reused by default and remain inspectable/editable before the existing validation, review, duplicate, and confirmation steps.

---

## Phase 5: User Story 3 - Keep settings safely associated with the account (Priority: P2)

**Goal**: Enforce account isolation, preserve previous defaults on failures, prevent stale writes, and avoid retaining sensitive import content.

**Independent Test**: Use two accounts with different mappings and verify authorized reads remain isolated; verify unauthorized reads are denied, failed saves preserve prior defaults while reporting transaction success separately, stale completions cannot replace newer defaults, and terminal reviews leave no mapping snapshot.

### Tests for User Story 3

- [X] T021 [P] [US3] Add SQL Server integration tests in `tests/Clutch.API.Tests/Integration/Imports/AccountImportSettingsTests.cs` for account isolation, owner authorization, save-failure preservation, both out-of-order successful-import write interleavings (only the import with the later transaction-confirmation commit may determine defaults), and snapshot deletion after terminal review states (ENG-001, DOT-002, SEC-001).
- [X] T022 [P] [US3] Extend `src/clutch-web/src/features/imports/ImportPage.test.tsx` to verify an accessible notification distinguishes imported transactions from failed defaults persistence and states defaults were not saved, and that accessible retrieval-failure messaging does not imply defaults are active and offers the existing settings flow (ENG-001, WEB-001, SEC-003).

### Implementation for User Story 3

- [X] T023 [US3] Atomically update the account's latest-successful-review token in the transaction-confirmation transaction in `src/Clutch.API/Application/Imports/ConfirmImportService.cs`; guard the separate settings upsert in `src/Clutch.API/Application/Imports/AccountImportSettingsService.cs` so it proceeds only when its review token still matches. The later transaction-confirmation commit wins regardless of settings-write completion order, stale writes must not replace newer defaults, and failed writes must retain the previous settings row (DOT-001, DOT-002, OPS-001).
- [X] T024 [US3] Clear the temporary mapping snapshot on confirmed, canceled, expired, rejected, or failed terminal review transitions in `src/Clutch.API/Application/Imports/ImportReviewService.cs` and `src/Clutch.API/Application/Imports/ConfirmImportService.cs`; no terminal review retains mapping JSON (DOT-002, SEC-003).
- [X] T025 [P] [US3] Update `src/clutch-web/src/features/imports/ImportPage.tsx` to show a clear, separate defaults-save failure message after a successful transaction import while retaining the existing success outcome (WEB-001, SEC-003).

**Checkpoint**: Settings cannot cross account boundaries, stale/failing writes do not replace defaults, and no active mapping snapshot survives terminal review states.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Complete migration, query, security, and feature quality gates.

- [X] T026 Verify the 500 ms user-response/busy-state requirement and ensure OpenTelemetry emits failure counts and rates plus duration and outcome metrics for long-running import tasks; import metrics must include transaction counts successfully imported and successfully imported per minute. Verify metric coverage in `src/clutch-web/src/features/imports/ImportPage.tsx`, `src/Clutch.API/Application/Imports/ConfirmImportService.cs`, and `src/Clutch.API/Application/Imports/AccountImportSettingsService.cs`, excluding sensitive dimensions (DOT-001, ENG-001, SEC-003).
- [X] T027 Review the generated migration in `src/Clutch.API/Infrastructure/Persistence/Migrations/` for data loss and document a rollback approach in `specs/002-save-import-settings/quickstart.md`; confirm no existing transaction data is changed (DOT-002, OPS-001).
- [X] T028 Have a second independent agent review SQL generated by `src/Clutch.API/Infrastructure/Persistence/AppDbContext.cs` and the settings upsert in `src/Clutch.API/Application/Imports/AccountImportSettingsService.cs`; assess query shape, indexes, and avoidable round trips, record the findings, and address them (DOT-002).
- [X] T029 Perform an independent OWASP Top 10 and dependency-vulnerability review of `src/Clutch.API/Api/Endpoints/ImportEndpoints.cs`, `src/Clutch.API/Application/Imports/AccountImportSettingsService.cs`, and `src/clutch-web/src/features/imports/`; resolve findings before completion (SEC-001).
- [X] T030 Verify the changed import flow and settings controls in `src/clutch-web/src/features/imports/ImportPage.test.tsx`, `src/clutch-web/src/features/imports/ImportMappingForm.tsx`, and `src/clutch-web/e2e/import-settings.spec.ts` are keyboard-operable, responsive at supported layouts, work with both system light and dark themes, and conform to WCAG 2.2 Level AA; add assertions using the existing frontend and browser test tools (ENG-001, WEB-001).
- [X] T031 Run the feature validation commands from `specs/002-save-import-settings/quickstart.md`, including SQL Server integration tests, frontend tests, typecheck, lint, production build, and the import-settings browser test; all applicable checks must pass (ENG-001, DOT-002, WEB-001).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; no project initialization is needed.
- **Foundational (Phase 2)**: Begins immediately; T003 depends on T001 and T002, and T004 depends on T003. All user-story work depends on T004.
- **User Stories (Phase 3+)**: US1 follows the foundation; US2 builds on the settings API and confirmation outcome delivered by US1; US3 starts after US2 and hardens the completed settings workflow.
- **Polish (Phase 6)**: Depends on the desired user stories being complete.
- **Final validation (T031)**: Depends on T030 accessibility verification and all other feature work being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Phase 2; establishes the settings read/save API and confirmation outcome.
- **User Story 2 (P1)**: Starts after US1; uses the settings retrieval and import-confirmation behavior to expose saved values for editing.
- **User Story 3 (P2)**: Starts after US2; hardens its persistence and lifecycle for authorization, failure, concurrency, and cleanup after the editable defaults flow is in place.

### Within Each User Story

- Tests are written before implementation and verify observable outcomes.
- Persistence/service behavior precedes endpoint integration; API schemas precede their client use.
- Saved defaults never bypass existing validation, review, duplicate warnings, or explicit confirmation.

### Parallel Opportunities

- T001 and T002 can run in parallel because they add separate persistence/domain records.
- T005 through T009 can run in parallel because unit, integration, API-client, page, and browser tests use separate files.
- T010 and T011 can run in parallel after the foundational persistence is ready; they update the review service and settings service separately.
- T015 can run alongside backend implementation tasks; T016 depends on the schemas in T015.
- T018 must precede T019 and T020 because it adds the editing-flow tests before implementation; T019 precedes T020 because the page uses the editable form.
- T021 and T022 can run in parallel because they cover backend persistence/security and frontend outcome behavior in separate files.
- After US1, US2 and US3 can proceed in parallel with coordination for shared frontend files.

## Parallel Example: User Story 1

```text
Run together after foundational tasks:
Task: T005 AccountImportSettingsService unit tests
Task: T006 SQL Server import-workflow integration tests
Task: T007 API client tests
Task: T008 Default-reuse page behavior tests
Task: T009 First-import and defaults-reuse browser journey
```

## Parallel Example: User Story 2

```text
No safe intra-story parallel work: complete T018 editing-flow tests, then T019 editable mapping form, then T020 page integration.
```

## Parallel Example: User Story 3

```text
Run together after User Story 2:
Task: T021 SQL Server isolation, authorization, failure, concurrency, and cleanup tests
Task: T022 Frontend outcome and retrieval-failure tests

After both test tasks, T025 frontend notification work can run alongside the backend lifecycle work in T023 and T024.
```

## Implementation Strategy

Deliver **US1 as the MVP**: persist settings only after successful confirmation, expose owner-authorized retrieval, and prove the SQL Server lifecycle. Add **US2** to make defaults usable and editable in the import flow, then complete **US3** before release to verify isolation, guarded writes, failure reporting, and cleanup. Finish all applicable review and quality gates in Phase 6.
