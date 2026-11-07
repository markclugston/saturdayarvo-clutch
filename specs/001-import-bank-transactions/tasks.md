---
description: "Implementation tasks for importing bank transactions"
---

# Tasks: Import Bank Transactions

**Input**: Design documents from `specs/001-import-bank-transactions/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/openapi.yaml`, `quickstart.md`

**Tests**: Included because the specification defines independent tests and acceptance scenarios, and the applicable quality standard requires automated coverage.

**Organization**: Tasks are grouped by user story and ordered by priority. The import-limit defaults and shared enforcement are foundational because imports must be bounded before administrator customization is added.

## Applicable Standards

| Standard | Path | Task compliance |
|---|---|---|
| ARC-001 | `standards/architecture/architecture-boundaries.md` | Keep domain behavior independent of HTTP and persistence; register services and providers through DI. |
| DOT-001 | `standards/dotnet/dotnet-service-practices.md` | Target .NET 10, enforce nullable/code-style/warnings, use cancellable async I/O and deterministic disposal. |
| DOT-002 | `standards/dotnet/ef-core-data-access-performance.md` | Use async EF Core and no-tracking reads where appropriate; verify critical behavior with production-provider tests and independent query review. |
| ENG-001 | `standards/engineering/testing-and-quality-gates.md` | Add xUnit/NSubstitute and frontend tests for behavior, and pass applicable quality gates. |
| OPS-001 | `standards/operations/reliability-and-data-changes.md` | Add safe structured logs and health checks; review migrations and document rollback. |
| SEC-001 | `standards/security/pci-dss-controls.md` | Enforce server-side authorization and validation, review OWASP/dependencies, and record PCI scope evidence in `compliance/pci/`. |
| SEC-002 | `standards/security/secrets-and-keys.md` | Keep credentials and administrator bootstrap secrets out of source, browser storage, bundles, and logs. |
| SEC-003 | `standards/security/logging-and-pan-handling.md` | Use typed validation and RFC 9457 `ProblemDetails`; never echo or log sensitive values or raw CSV. |
| WEB-001 | `standards/web/frontend-engineering.md` | Use strict TypeScript, runtime API validation, accessible responsive light/dark UI, component tests, and browser tests. |

No conflicts with the constitution were identified. The preliminary PCI scope assessment remains subject to deployment verification before implementation acceptance.

## Phase 1: Setup

**Purpose**: Prepare the API, test, and frontend toolchains without implementing feature behavior.

- [X] T001 Configure API dependencies for Identity, EF Core 10 with SQL Server, migrations, and CsvHelper in `src/Clutch.API/Clutch.API.csproj`; retain .NET 10 nullable, implicit-usings, code-style, and warnings-as-errors settings (DOT-001, ARC-001).
- [X] T002 Create `tests/Clutch.API.Tests/Clutch.API.Tests.csproj` with xUnit, NSubstitute, WebApplicationFactory, and SQL Server Testcontainers; add the test project to `saturdayarvo-clutch.slnx` (ENG-001, DOT-002).
- [X] T003 Configure frontend unit/component testing, TypeScript-ESLint, runtime API schemas, and a dedicated server-state query library in `src/clutch-web/package.json`, `src/clutch-web/vite.config.ts`, `src/clutch-web/eslint.config.js`, and `src/clutch-web/tsconfig.app.json`; scripts must expose test, lint, and `tsc --noEmit` checks (WEB-001, ENG-001).
- [X] T004 Configure Playwright browser tests and the `test:e2e` script in `src/clutch-web/playwright.config.ts` and `src/clutch-web/package.json`, with a reusable authenticated test setup that does not contain credentials (WEB-001, SEC-002).

---

## Phase 2: Foundational

**Purpose**: Establish authentication, persistence, safe errors, and shared import protections required before user-story work.

- [X] T005 Replace the weather sample in `src/Clutch.API/Program.cs` with Identity cookie authentication, secure cookie options, authorization, antiforgery token issuance/validation, and same-origin API routing; place security endpoint configuration in `src/Clutch.API/Api/Security/SecurityEndpoints.cs` (SEC-001, SEC-002, ARC-001).
- [X] T006 Add standard exception handling and typed validation responses in `src/Clutch.API/Api/ProblemDetailsConfiguration.cs` and `src/Clutch.API/Program.cs`; return RFC 9457 `ProblemDetails` without source values and configure safe structured logging and health checks (SEC-003, OPS-001).
- [X] T007 Add the Identity-aware EF Core SQL Server context, DI registration, and initial identity/persistence migration in `src/Clutch.API/Infrastructure/Persistence/AppDbContext.cs`, `src/Clutch.API/Infrastructure/DependencyInjection.cs`, and `src/Clutch.API/Infrastructure/Persistence/Migrations/`; use async database operations and support production-provider integration tests (DOT-001, DOT-002, ARC-001, OPS-001).
- [X] T008 Implement protected-configuration administrator bootstrap and role assignment in `src/Clutch.API/Infrastructure/Identity/AdminBootstrapper.cs` and `src/Clutch.API/Program.cs`; do not provide public privilege escalation or commit bootstrap credentials (SEC-001, SEC-002).
- [X] T009 Implement shared persisted import settings and atomic per-user fixed-minute rate windows in `src/Clutch.API/Domain/Imports/ImportLimits.cs`, `src/Clutch.API/Infrastructure/Imports/ImportAttemptLimiter.cs`, `src/Clutch.API/Infrastructure/Persistence/AppDbContext.cs`, and a migration under `src/Clutch.API/Infrastructure/Persistence/Migrations/`; enforce defaults of 10 MiB, 10,000 rows, and five attempts per user per minute, validate updates as one unit, and expire old windows (DOT-002, SEC-001, OPS-001).

**Checkpoint**: Cookie auth, CSRF, persistence, safe error handling, protected administrator provisioning, and shared default limits are ready.

---

## Phase 3: User Story 1 - Create described currency accounts (Priority: P1) - MVP

**Goal**: A user creates one owner-only Family and multiple described accounts with immutable currencies, while sensitive identifiers are rejected.

**Independent Test**: Create two accounts with different descriptions and currencies, edit one description without changing its currency, reject sensitive identifiers, and verify another user cannot access either account.

### Tests for User Story 1

- [X] T010 [P] [US1] Add domain tests for Family ownership and account-description validation in `tests/Clutch.API.Tests/Unit/Families/FamilyTests.cs` and `tests/Clutch.API.Tests/Unit/Accounts/AccountDescriptionValidatorTests.cs`; cover labeled and unlabelled identifier patterns without including rejected values in assertions or output (ENG-001, SEC-001, SEC-003).

### Implementation for User Story 1

- [X] T011 [P] [US1] Create Family and Account domain types and the shared description validator in `src/Clutch.API/Domain/Families/Family.cs`, `src/Clutch.API/Domain/Accounts/Account.cs`, `src/Clutch.API/Domain/Accounts/AccountDescriptionValidator.cs`, and `src/Clutch.API/Domain/Shared/Currency.cs`; preserve these data-model constraints verbatim: Family `OwnerUserId` is “Required, unique for this feature; creator is the non-removable owner”; Account `FamilyId` is “Required foreign key to the owner's Family”, `Description` is “Required, non-blank, bounded length; financial identifier validation on every write”, and `CurrencyCode` is “Required at creation; immutable” (ARC-001, SEC-001, SEC-003).
- [X] T012 [US1] Map Family and Account relationships and constraints in `src/Clutch.API/Infrastructure/Persistence/AppDbContext.cs` and add a migration under `src/Clutch.API/Infrastructure/Persistence/Migrations/`; enforce one Family per owner, server-assigned Family ownership, immutable currency, and account description bounds (DOT-002, SEC-001, OPS-001).
- [X] T013 [US1] Implement owner-scoped Family create/get use cases and endpoints in `src/Clutch.API/Application/Families/FamilyService.cs` and `src/Clutch.API/Api/Endpoints/FamilyEndpoints.cs`; reject a second Family and derive the owner only from the authenticated identity (ARC-001, SEC-001, SEC-003).
- [X] T014 [US1] Implement account list/create/get/description-update use cases and endpoints in `src/Clutch.API/Application/Accounts/AccountService.cs` and `src/Clutch.API/Api/Endpoints/AccountEndpoints.cs`; authorize through Family ownership on every request and preserve currency and transactions on description updates (ARC-001, SEC-001, SEC-003).
- [X] T015 [US1] Add SQL Server WebApplicationFactory integration tests in `tests/Clutch.API.Tests/Integration/Accounts/FamilyAccountAuthorizationTests.cs` for one-Family enforcement, distinct currencies, description edits, identifier rejection, and cross-user denial (ENG-001, DOT-002, SEC-001).
- [X] T016 [P] [US1] Add runtime-validated Family, currency, and account API schemas plus the cookie/CSRF-aware API client in `src/clutch-web/src/lib/api/schemas.ts`, `src/clutch-web/src/lib/api/client.ts`, `src/clutch-web/src/features/families/api.ts`, and `src/clutch-web/src/features/accounts/api.ts`; handle `ProblemDetails` as a typed response (WEB-001, SEC-001, SEC-003).
- [X] T017 [US1] Implement a shared system color-scheme provider in `src/clutch-web/src/components/theme/ThemeProvider.tsx`, integrate it in `src/clutch-web/src/main.tsx`, and follow/respond to operating-system light/dark preference without an application override or persisted choice. Build accessible Family onboarding and account list/create/edit screens in `src/clutch-web/src/features/families/FamilyPage.tsx`, `src/clutch-web/src/features/accounts/AccountsPage.tsx`, and `src/clutch-web/src/features/accounts/AccountDetails.tsx`; show currency names and codes, validate descriptions without echoing rejected values, and display nullable successful-import time in the viewer's locale to minute precision (WEB-001, SEC-003).
- [X] T018 [P] [US1] Add user-observable frontend tests in `src/clutch-web/src/features/families/FamilyPage.test.tsx`, `src/clutch-web/src/features/accounts/AccountsPage.test.tsx`, and `src/clutch-web/src/features/accounts/AccountDetails.test.tsx` for account creation/editing, currency retention, validation feedback, locale timestamp display, and accessible keyboard interaction (WEB-001, ENG-001).

**Checkpoint**: Family and account creation, editing, identifier rejection, ownership, and account details work independently.

---

## Phase 4: User Story 2 - Import and review transactions (Priority: P1)

**Goal**: A Family owner maps a bank CSV, reviews safe normalized rows, and explicitly imports all valid transactions into one selected account.

**Independent Test**: Import representative signed-amount, separate-amount, and amount-plus-direction CSVs; verify dates, descriptions, exact decimal magnitudes, directions, account currency, review cancellation, and all-or-nothing validation.

### Tests for User Story 2

- [X] T019 [P] [US2] Add CSV parsing and mapping unit tests in `tests/Clutch.API.Tests/Unit/Imports/CsvImportParserTests.cs` for quoted fields, embedded delimiters/line breaks, explicit date formats, all three amount modes, registry-defined and multiple currency conventions, ambiguous values requiring selection, separator mismatch, zero amounts, and invalid direction mappings (ENG-001, SEC-001, SEC-003).

### Implementation for User Story 2

- [X] T020 [P] [US2] Create Transaction, ImportReview, ImportReviewRow, and ImportAuditEvent domain types in `src/Clutch.API/Domain/Transactions/Transaction.cs`, `src/Clutch.API/Domain/Imports/ImportReview.cs`, `src/Clutch.API/Domain/Imports/ImportReviewRow.cs`, and `src/Clutch.API/Domain/Imports/ImportAuditEvent.cs`; retain these data-model constraints verbatim: Transaction `TransactionDate` is “Source date interpreted using the confirmed import format”, `Description` is “Required, bounded length; financial identifier validation”, `Amount` is “Non-negative monetary magnitude, currency-appropriate precision”, and `Direction` is “Incoming or Outgoing”; ImportReview `State` is “`Ready`, `Confirmed`, `Cancelled`, `Expired`”, and rows contain “Valid mapped data only; all-or-nothing validation before review creation” (ARC-001, SEC-001, SEC-003).
- [X] T021 [US2] Map transaction, review, review-row, audit, account active-import lease (`ActiveImportId`), and cleanup persistence in `src/Clutch.API/Infrastructure/Persistence/AppDbContext.cs` and add the corresponding migration under `src/Clutch.API/Infrastructure/Persistence/Migrations/`; retain only normalized mapped review values and remove staged rows and release leases at terminal states (DOT-002, OPS-001, SEC-003).
- [X] T022 [US2] Implement a version-controlled currency amount-format registry in `src/Clutch.API/Domain/Shared/CurrencyAmountFormatRegistry.cs` and cancellable streaming CSV parsing and strict mapping validation in `src/Clutch.API/Infrastructure/Imports/CsvImportParser.cs` and `src/Clutch.API/Application/Imports/ImportMappingValidator.cs`; record each convention's reference/version, use CsvHelper, enforce byte/row limits, length-check before identifier detection, parse exact decimals, require explicit convention selection for multiple or ambiguous formats, validate all rows before review creation, and never retain the source file or unmapped values (DOT-001, SEC-001, SEC-003).
- [X] T023 [US2] Implement import-review creation, audit outcomes, and the multipart review endpoint in `src/Clutch.API/Application/Imports/ImportReviewService.cs`, `src/Clutch.API/Api/Endpoints/ImportEndpoints.cs`, `src/Clutch.API/Infrastructure/Imports/ImportAuditWriter.cs`, and `src/Clutch.API/Infrastructure/Imports/AccountImportLease.cs`; acquire a database-coordinated per-account lease before review processing, reject a concurrent import, ensure duplicate checks use the latest transaction list, require owner authorization and antiforgery, apply shared rate/size/row limits before persistence, and report only safe row/mapping identifiers on errors (ARC-001, DOT-001, DOT-002, SEC-001, SEC-003, OPS-001).
- [X] T024 [US2] Implement authorized transaction paging and atomic review confirmation in `src/Clutch.API/Application/Transactions/TransactionService.cs`, `src/Clutch.API/Application/Imports/ConfirmImportService.cs`, and `src/Clutch.API/Api/Endpoints/TransactionEndpoints.cs`; verify the lease and current transaction state, persist exact decimal amounts, release the lease on cancel, expiry, failure, or success, and update `LastSuccessfulImportAtUtc` only after the complete transaction insert commits (DOT-002, SEC-001, SEC-003).
- [X] T025 [US2] Add SQL Server integration tests in `tests/Clutch.API.Tests/Integration/Imports/ImportWorkflowTests.cs` for valid mapping modes, registry conventions and ambiguity, row/file limits, malformed/empty files, sensitive descriptions, cancellation, review expiry and lease release, no partial writes, and successful-import timestamp updates (ENG-001, DOT-002, SEC-001, SEC-003).
- [X] T026 [P] [US2] Add PapaParse-based header-only CSV inspection in `src/clutch-web/src/features/imports/readCsvHeaders.ts` and `src/clutch-web/src/features/imports/readCsvHeaders.test.ts`; read headers from the local File without uploading or retaining client-parsed transaction rows (WEB-001, SEC-001).
- [X] T027 [US2] Build the mapping, currency-format selection/confirmation, review, cancel, and confirm flow in `src/clutch-web/src/features/imports/ImportPage.tsx`, `src/clutch-web/src/features/imports/ImportMappingForm.tsx`, `src/clutch-web/src/features/imports/ImportReviewTable.tsx`, and `src/clutch-web/src/features/imports/api.ts`; support all three mapping modes and the shared OS-following theme, and do not render invalid or rejected values (WEB-001, SEC-001, SEC-003).
- [X] T028 [US2] Build the account transaction view in `src/clutch-web/src/features/accounts/TransactionsTable.tsx` and `src/clutch-web/src/features/accounts/useTransactions.ts`; use the shared query library, runtime-validate API data, display explicit direction, format dates by viewer locale, and format amounts using the account currency (WEB-001, SEC-003).

**Checkpoint**: An owner can safely stage, review, cancel, and atomically import valid transactions; per-account leases prevent overlapping imports, and invalid or cancelled imports leave existing data unchanged. Overall import acceptance additionally requires US3 T032-T034 to complete current-state duplicate warnings and confirmation-time rechecks.

---

## Phase 5: User Story 4 - Configure import limits (Priority: P1)

**Goal**: An administrator can view and update shared runtime limits while defaults remain enforced and ordinary users are denied.

**Independent Test**: Verify defaults, change each setting without restart, observe enforcement immediately, reject invalid updates without replacing valid settings, and verify non-administrator denial.

- [X] T029 [US4] Implement administrator-only get/update settings use cases and endpoints in `src/Clutch.API/Application/Imports/ImportLimitSettingsService.cs` and `src/Clutch.API/Api/Endpoints/AdminImportLimitEndpoints.cs`; preserve data-model constraints verbatim: `MaxFileSizeBytes`, `MaxRowsPerImport`, and `MaxImportAttemptsPerUserPerMinute` are “Positive” with defaults “10 * 1024 * 1024”, “10000”, and “5”, and invalid updates must not replace the last valid values (ARC-001, DOT-002, SEC-001, SEC-003).
- [X] T030 [US4] Build an accessible administrator import-limits page in `src/clutch-web/src/features/admin/ImportLimitsPage.tsx` and `src/clutch-web/src/features/admin/api.ts`; use the shared system color-scheme provider, display effective settings, validate positive values, save without redeployment, and keep the route/API unavailable to non-administrators (WEB-001, SEC-001, SEC-003).
- [X] T031 [US4] Add SQL Server API and frontend tests in `tests/Clutch.API.Tests/Integration/Admin/ImportLimitSettingsTests.cs` and `src/clutch-web/src/features/admin/ImportLimitsPage.test.tsx` for defaults, valid runtime updates, rejected invalid updates, immediate enforcement, and non-administrator denial (ENG-001, DOT-002, WEB-001, SEC-001).

**Checkpoint**: Default and administrator-configured limits are shared, persistent, validated, and immediately enforced.

---

## Phase 6: User Story 3 - Avoid accidental duplicate imports (Priority: P2)

**Goal**: Possible duplicates are identified within the selected account and current file, while the owner retains the choice to import legitimate matching transactions.

**Independent Test**: Import a file, prepare the same file again, verify account-scoped and same-file warnings, cancel without writes, then explicitly confirm all flagged rows.

- [X] T032 [P] [US3] Implement exact duplicate matching on date, description, amount, and direction in `src/Clutch.API/Application/Imports/DuplicateDetector.cs`; compare only the selected account and rows within the current import, and flag rather than suppress matches (ARC-001, DOT-002, SEC-003).
- [X] T033 [US3] Implement confirmation-time duplicate rechecks in `src/Clutch.API/Application/Imports/ConfirmImportService.cs` using the account lease and current transaction state; preserve `ActiveImportId` as nullable and ensure duplicate warnings are recalculated before atomic confirmation without suppressing flagged rows (DOT-002, SEC-001, OPS-001).
- [X] T034 [US3] Add SQL Server integration tests in `tests/Clutch.API.Tests/Integration/Imports/DuplicateAndConcurrencyTests.cs` for existing and same-file matches, cross-account isolation, stale-state recheck, explicit duplicate confirmation, cancellation, and concurrent import attempts (ENG-001, DOT-002, SEC-001).
- [X] T035 [US3] Show duplicate warnings and require an explicit user choice in `src/clutch-web/src/features/imports/ImportReviewTable.tsx` and `src/clutch-web/src/features/imports/ImportPage.tsx`; keep cancel available and make clear that confirming imports every valid row, including flagged rows (WEB-001, SEC-003).
- [X] T036 [P] [US3] Add accessible duplicate-review component tests in `src/clutch-web/src/features/imports/ImportReviewTable.test.tsx` and `src/clutch-web/src/features/imports/ImportPage.test.tsx` for warnings, cancellation, and explicit confirmation (WEB-001, ENG-001).

**Checkpoint**: Duplicate warnings are account-scoped and require explicit confirmation; database coordination prevents stale or overlapping imports.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verify end-to-end accessibility, operations, security, database query quality, and delivery documentation.

- [X] T037 [P] Add Playwright critical-journey tests in `src/clutch-web/e2e/family-accounts-import.spec.ts` and `src/clutch-web/e2e/admin-import-limits.spec.ts`; cover ownership denial, imports, duplicate confirmation, limit administration, keyboard navigation, WCAG 2.2 AA checks, and operating-system light/dark preference changes without an application override (WEB-001, ENG-001, SEC-001).
- [X] T038 Review migration safety and document apply/rollback steps in `specs/001-import-bank-transactions/quickstart.md`; include SQL Server container setup, protected local secrets, migration commands, and verification of cleanup/lease release (OPS-001, DOT-002, SEC-002).
- [ ] T039 Complete an independent OWASP Top 10 review and dependency vulnerability check for the changed API/frontend code; remediate findings and update the deployment-specific PCI scope evidence in `compliance/pci/001-import-bank-transactions-scope.md` before acceptance (SEC-001, SEC-002, SEC-003).
- [X] T040 Obtain an independent review of generated EF Core SQL/query shapes for account ownership, transaction paging, duplicate checks, leases, and rate windows; assess indexes, round trips, and provider integration results, then address findings in `src/Clutch.API/Infrastructure/Persistence/` (DOT-002, OPS-001).
- [ ] T041 Run the complete verification commands from `specs/001-import-bank-transactions/quickstart.md` and resolve failures: `dotnet test .\saturdayarvo-clutch.slnx`, frontend typecheck, lint, unit tests, production build, Playwright tests, migration checks, and acceptance scenarios (ENG-001, DOT-001, DOT-002, WEB-001, SEC-001).
- [ ] T042 Conduct a moderated usability study with at least 20 representative participants for SC-001, SC-002, and SC-006; use unaided tasks, start timing at task presentation, record completion within each specified time limit and correct incoming/outgoing identification, and report aggregate percentages (at least 18 of 20 for each threshold) without collecting unnecessary personal or financial data (ENG-001, WEB-001).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; API, test, and frontend setup tasks can proceed independently except where they update the same manifest.
- **Foundational (Phase 2)**: Depends on Setup; authentication, persistence, safe errors, administrator provisioning, and shared import-limit enforcement block feature behavior.
- **User Stories (Phases 3-6)**: Depend on the foundational phase. Implement in the listed priority order; parallel work is possible only when tasks touch separate files and their prerequisites are complete.
- **Polish (Phase 7)**: Depends on the stories being validated; security, PCI, SQL-review, and full-suite gates must pass before acceptance.

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2; no dependency on another user story.
- **US2 (P1)**: Depends on US1 account APIs and account ownership because imports need an existing selected account. Its import-review lease is implemented in this phase; overall import acceptance also requires US3 T032-T034 for current-state duplicate warnings, rechecks, and tests.
- **US4 (P1)**: Can start after Phase 2; its shared settings and enforcement primitives are foundational, while the administrator interface and update endpoints are story-specific.
- **US3 (P2)**: Depends on US1 accounts and US2 import reviews/confirmation.

### Parallel Opportunities

- Setup tasks T001-T003 can run independently; T004 follows frontend package setup if it changes the same manifest.
- Foundational API auth, errors, persistence, and protected administrator bootstrap are separate concerns, but persistence-model changes must be integrated before migrations are finalized.
- In US1, domain work/tests and frontend API schema work can proceed in parallel; account screens depend on the frontend API client.
- In US2, parser tests and header-only browser parsing can proceed separately from backend persistence; the review UI depends on the review API contract. Lease acquisition and release are part of US2's review lifecycle and must be complete before its checkpoint.
- US4 can proceed in parallel with US1/US2 after Phase 2 when it does not conflict on shared settings contracts.
- US3 duplicate detection, UI warning work, and tests can proceed in parallel after the review shape exists; lease/confirmation changes must be integrated before concurrency tests pass.

### Parallel Example: User Story 1

```text
Task: T010 domain validation tests in tests/Clutch.API.Tests/Unit/...
Task: T011 domain types in src/Clutch.API/Domain/...
Task: T016 runtime-validated frontend API client in src/clutch-web/src/lib/api/...
```

### Parallel Example: User Story 2

```text
Task: T019 parser tests in tests/Clutch.API.Tests/Unit/Imports/...
Task: T026 header-only browser parsing in src/clutch-web/src/features/imports/...
Task: T022 server CSV parser in src/Clutch.API/Infrastructure/Imports/...
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 setup and Phase 2 foundations.
2. Complete Phase 3: US1 Family and account creation, currency selection, safe descriptions, owner-only access, and account details.
3. Validate US1 independently with its API and frontend tests; stop for MVP review before beginning imports.

### Incremental Delivery

1. Complete Setup and Foundational phases.
2. Deliver US1 accounts as the initial MVP.
3. Deliver US2 CSV mapping, safe review, per-account import leases, and atomic import.
4. Deliver US4 administrator limit management using the already-enforced defaults.
5. Deliver US3 duplicate warnings and cross-session import coordination.
6. Complete Phase 7 security, PCI, query-review, browser, and full validation gates.

## Notes

- Every task uses the required checkbox, sequential task ID, optional `[P]`, story label only within user-story phases, and an explicit repository path.
- `[P]` indicates distinct-file work that can proceed without waiting on incomplete task implementation.
- Story test criteria are independent acceptance checks; tests are included because the feature specification defines them and the standards require automated behavioral coverage.
- T042 measures the usability success criteria with a defined participant count, unaided procedure, timing rule, and measurable pass threshold.
- Do not log, return, display, or persist rejected identifiers, raw CSV content, unmapped columns, or invalid sensitive values.
