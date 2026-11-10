---
description: "Implementation tasks for single-person data access"
---

# Tasks: Single-Person Data Access

**Input**: Design documents from `specs/005-single-user-access/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/account-ownership.md`, `quickstart.md`

**Organization**: Tasks are grouped by user story so each story can be independently implemented and validated after its prerequisites.

## Phase 1: Setup

**Purpose**: Project initialization and basic structure.

The API, frontend, SQL Server integration-test project, and frontend test tools are already initialized. No setup changes are required.

## Phase 2: Foundational

**Purpose**: Establish direct per-account ownership and preserve the existing database before user-story changes.

- [X] T001 Add nullable `Account.OwnerUserId` for unresolved legacy records and configure its optional `ApplicationUser` relationship with restrictive deletion and an owner index in `src/Clutch.API/Domain/Accounts/Account.cs` and `src/Clutch.API/Infrastructure/Persistence/AppDbContext.cs`; apply the data-model constraints verbatim: “A null value represents retained legacy data whose owner cannot be resolved; user-facing account operations must not return or modify it,” `Description` is “Required, nonblank, maximum 200 characters,” and `CurrencyCode` is “Required supported currency code; existing validation remains in effect”; retain the existing Family model in this step so the project stays buildable before the migration is generated (ARC-001, DOT-002, OPS-001; pass when the EF model includes the new optional owner relationship without changing existing Family mapping).
- [X] T002 Replace Family-based ownership queries and account creation with authenticated-user-to-account-owner behavior in `src/Clutch.API/Application/Accounts/AccountService.cs`, `src/Clutch.API/Application/Transactions/TransactionService.cs`, `src/Clutch.API/Application/Imports/ConfirmImportService.cs`, `src/Clutch.API/Application/Imports/ImportReviewService.cs`, and `src/Clutch.API/Application/Imports/AccountImportSettingsService.cs`; remove the Family entity, DbSet, and EF configuration from `src/Clutch.API/Domain/Families/Family.cs` and `src/Clutch.API/Infrastructure/Persistence/AppDbContext.cs`, remove the Family service and endpoint mapping from `src/Clutch.API/Application/Families/FamilyService.cs`, `src/Clutch.API/Api/Endpoints/FamilyEndpoints.cs`, `src/Clutch.API/Infrastructure/DependencyInjection.cs`, and `src/Clutch.API/Program.cs`, remove `tests/Clutch.API.Tests/Unit/Families/FamilyTests.cs`, and update `src/Clutch.API/Api/Endpoints/AccountEndpoints.cs` to create accounts directly and omit `FamilyId`; ensure ownerless accounts are excluded from reads and writes (SEC-001, SEC-003, DOT-002; pass when the API and test projects build with no Family model/routes and all account-related operations enforce `OwnerUserId`).
- [X] T003 Run `dotnet ef migrations add SinglePersonAccountOwnership --project src/Clutch.API/Clutch.API.csproj --output-dir Infrastructure/Persistence/Migrations` after T002 removes the Family entity from the EF model; update the generated migration under `src/Clutch.API/Infrastructure/Persistence/Migrations/` and `src/Clutch.API/Infrastructure/Persistence/Migrations/AppDbContextModelSnapshot.cs`; backfill account owners only when the existing Family owner identifier resolves to an Identity user before dropping `FamilyId` and `Families`, preserve account rows and linked data, leave unresolved owners null, and make downgrade stop before changing data if ownerless accounts cannot be represented (DOT-002, OPS-001; pass when upgrade and downgrade preserve all representable ownership and related data).

**Checkpoint**: The persistence model and all server-side account-related queries use the authenticated individual as the authorization boundary.

## Phase 3: User Story 1 - Access Personal Data (Priority: P1)

**Goal**: An individual can access their own data only; the Family creation and access-sharing surfaces are absent.

**Independent Test**: Sign in as two different individuals; verify each can access their own data, a different individual cannot read or change it, and an individual reaches account management without creating a Family.

### Tests for User Story 1

- [X] T004 [US1] Update `tests/Clutch.API.Tests/Integration/Accounts/FamilyAccountAuthorizationTests.cs` to create accounts directly and verify the owner can create, list, read, and update an account and read its transaction pages while another user receives no account or transaction data and cannot change the account; authenticate two separate clients as the same owner and verify both sessions can access that owner's account (SEC-001, ENG-001; pass when cross-user account and transaction reads and account writes are denied and same-owner sessions both succeed).
- [X] T005 [US1] Replace Family-creation setup in `tests/Clutch.API.Tests/Integration/Imports/AccountImportSettingsTests.cs`, `tests/Clutch.API.Tests/Integration/Imports/ImportWorkflowTests.cs`, `tests/Clutch.API.Tests/Integration/Imports/ImportAttemptLimiterTests.cs`, `tests/Clutch.API.Tests/Integration/Imports/DuplicateAndConcurrencyTests.cs`, and `tests/Clutch.API.Tests/Integration/Admin/ImportLimitSettingsTests.cs` with direct account setup while retaining each test's existing import and authorization assertions; cover retrieving account import settings, creating a CSV import review, and confirming or cancelling a review (ENG-001, SEC-001; pass when these owner workflows remain usable, cross-user access is denied where asserted, and these integration tests no longer depend on `/api/families`).
- [X] T006 [P] [US1] Update the authenticated account journey in `src/clutch-web/e2e/family-accounts-import.spec.ts` to remove Family creation and verify the owner can use their account while a second user's request is denied (WEB-001, SEC-001, ENG-001; pass when the browser journey proves private access without a Family setup step).

### Implementation for User Story 1

- [X] T007 [P] [US1] Add regression coverage in `src/clutch-web/src/components/theme/ThemeSelector.test.tsx` and `src/clutch-web/src/components/theme/ThemeProvider.test.tsx` for the Light/Dark/System choices, Light default while a saved preference loads, signed-in preference persistence, and System response to operating-system color-scheme changes (WEB-001, ENG-001; pass when each specified behavior is asserted).
- [X] T008 [US1] Remove the Family onboarding feature and API client from `src/clutch-web/src/features/families/FamilyPage.tsx`, `src/clutch-web/src/features/families/api.ts`, and `src/clutch-web/src/features/families/FamilyPage.test.tsx`; update `src/clutch-web/src/App.tsx`, `src/clutch-web/src/App.test.tsx`, and `src/clutch-web/src/lib/api/schemas.ts` to enter account management directly and validate account responses without `familyId` (WEB-001, SEC-001, ENG-001; pass when authenticated users reach accounts without a Family query or creation flow and T007's theme regression tests pass unchanged).

**Checkpoint**: A single individual can reach and manage personal data directly, with no supported way for another individual to access it.

## Phase 4: User Story 2 - Manage Multiple Personal Accounts (Priority: P2)

**Goal**: Preserve an individual's ability to manage more than one financial account without shared access.

**Independent Test**: Create two accounts as one individual, verify both appear and remain manageable in that individual's session, and verify another individual cannot access either account.

### Tests and implementation for User Story 2

- [X] T009 [P] [US2] Add `tests/Clutch.API.Tests/Integration/Accounts/MultipleAccountOwnershipTests.cs` to create two accounts for one signed-in individual and assert both are listed and individually readable, while another individual receives no access to either (ENG-001, SEC-001; pass when all assertions run against the SQL Server test provider).
- [X] T010 [P] [US2] Extend `src/clutch-web/src/features/accounts/AccountsPage.test.tsx` to render and select multiple owned accounts using accessible roles and names, and adjust `src/clutch-web/src/features/accounts/AccountsPage.tsx` only if removing the Family gate prevents existing multi-account actions (WEB-001, ENG-001; pass when both accounts remain available without a sharing flow).

**Checkpoint**: An individual can manage multiple accounts; no account becomes accessible to a second individual.

## Phase 5: User Story 3 - Preserve Data During Ownership Migration (Priority: P2)

**Goal**: Preserve existing account ownership and related data during migration, and keep unresolved legacy accounts inaccessible.

**Independent Test**: Upgrade a database containing existing accounts and account-linked records; verify known owners retain access and records, and ownerless records are retained but inaccessible.

### Tests for User Story 3

- [X] T011 [US3] Add `tests/Clutch.API.Tests/Integration/Persistence/SinglePersonAccountOwnershipMigrationTests.cs` to apply the ownership migration to a database at the preceding migration with accounts owned by different users and linked transactions/import data; assert each owner mapping and linked record is preserved after upgrade (DOT-002, OPS-001, ENG-001; pass when the test proves no account or linked data is lost).
- [X] T012 [US3] Extend `tests/Clutch.API.Tests/Integration/Persistence/SinglePersonAccountOwnershipMigrationTests.cs` with an unresolved-owner case: on SQL Server, disable the Family-to-Identity foreign key, insert a Family whose owner identifier has no matching Identity user while keeping its account-to-Family reference valid, and apply the migration; assert the account and linked data are retained with no owner and absent from ordinary account and related-data reads; verify downgrade refuses before modifying data while unresolved ownerless data remains; then perform an authorized out-of-band data repair assigning a valid owner and verify that owner can access the account and linked data while another user remains denied (SEC-001, DOT-002, OPS-001; pass when ownerless data is retained and inaccessible before repair, unsafe downgrade leaves data unchanged, and access after repair is limited to the assigned owner).

**Checkpoint**: Migration preserves established ownership and linked data; unresolved legacy data is retained and inaccessible.

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate the entire feature and its security and data-migration guarantees.

- [X] T013 [P] Remove obsolete Family-access wording and setup instructions from `README.md` if present, while preserving historical migration records needed to move existing databases forward (ARC-001, ENG-001; pass when current product documentation describes direct individual ownership and migration history remains intact).
- [X] T014 After T001-T003 and all migration/query changes are complete, request a second, independent agent to review the SQL statements and EF Core-generated SQL for query shape, indexing, and avoidable round trips; address findings and rerun affected database tests (DOT-002; pass when the independent review is recorded and no blocking query findings remain).
- [X] T015 After implementation is complete, request an independent agent review of changed code focused on OWASP Top 10 risks, server-side owner authorization, and safe diagnostics; address findings and rerun affected checks (SEC-001, SEC-003; pass when the independent review is recorded and no unresolved security findings remain).
- [X] T016 Run `dotnet test tests/Clutch.API.Tests/Clutch.API.Tests.csproj`, `dotnet list src/Clutch.API/Clutch.API.csproj package --vulnerable --include-transitive`, `dotnet list tests/Clutch.API.Tests/Clutch.API.Tests.csproj package --vulnerable --include-transitive`, `npm run typecheck`, `npm run lint`, `npm test`, `npm audit`, and `npm run test:e2e` using `src/clutch-web/` as the frontend working directory for npm commands; address dependency vulnerabilities or report unresolved findings as blockers, and record unavailable prerequisites or failures rather than treating them as passed (ENG-001, WEB-001, DOT-002, SEC-001; pass when required checks complete successfully, no unresolved dependency vulnerabilities remain, and the quickstart scenarios are covered).

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No changes required; project infrastructure already exists.
- **Foundational (Phase 2)**: Begins immediately and blocks all user-story work.
- **User Story 1 (Phase 3)**: Depends on the ownership model and query changes in Phase 2.
- **User Story 2 (Phase 4)**: Depends on User Story 1 removing the Family gate and preserving the account experience.
- **User Story 3 (Phase 5)**: Depends on the Phase 2 migration and can be validated independently of frontend work.
- **Polish (Phase 6)**: Documentation can follow implementation; T014 and T015 require the relevant implementation and test changes to be complete, and T016 runs after reviews and any required fixes.

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Phase 2; establishes the single-person access behavior.
- **User Story 2 (P2)**: Starts after User Story 1; verifies multi-account behavior remains available after Family removal.
- **User Story 3 (P2)**: Starts after Phase 2; verifies the migration's existing-owner and unresolved-owner outcomes. It can proceed alongside User Story 1 after the migration is in place.
- **Independent reviews**: T014 follows database query and migration changes; T015 follows all changed code. Complete review findings before T016 final validation.

### Parallel Opportunities

- T001's owner property must precede T002's service query changes. T002 removes the Family model and must precede T003 migration generation. T004 and T005 follow the direct-owner model; T008 follows the account API contract update in T002. T007 is an independent theme-regression test task.
- Within User Story 1, the API authorization/session tests (T004), browser-journey test updates (T006), and theme-regression tests (T007) touch separate files and can be prepared in parallel before implementation T008.
- Within User Story 2, the API integration tests (T009) and frontend component tests (T010) touch separate projects and can run in parallel.
- Within User Story 3, T011 and T012 extend the same migration test file and should be completed sequentially.
- User Story 3 validation can run alongside User Story 1 after Phase 2; User Story 2 waits for User Story 1.

## Parallel Example: User Story 2

```text
Task: "Add SQL Server integration coverage for managing multiple accounts in tests/Clutch.API.Tests/Integration/Accounts/MultipleAccountOwnershipTests.cs"
Task: "Add accessible multi-account UI coverage in src/clutch-web/src/features/accounts/AccountsPage.test.tsx"
```

## Parallel Example: User Story 1

Implement the API authorization-test updates in `tests/Clutch.API.Tests/Integration/Accounts/FamilyAccountAuthorizationTests.cs`, the browser-journey updates in `src/clutch-web/e2e/family-accounts-import.spec.ts`, and the theme-regression tests in `src/clutch-web/src/components/theme/` (T004, T006, and T007) in parallel; they touch separate test files and precede implementation T008.

## Parallel Example: User Story 3

No safe parallel tasks are defined: T011 and T012 extend the same SQL Server migration test file and should be completed sequentially to avoid conflicts.

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 2: direct account ownership, migration, and owner-scoped service queries.
2. Complete Phase 3: remove Family endpoints and onboarding; prove an individual can access only their own data.
3. Validate User Story 1 independently with API, frontend, and browser tests.

### Incremental Delivery

1. Complete the shared ownership foundation.
2. Deliver User Story 1 as the P1 single-person-access MVP.
3. Deliver User Story 2 and verify multiple personal accounts remain usable.
4. Deliver User Story 3 and verify legacy data preservation and ownerless-data isolation.
5. Complete independent SQL/query and OWASP reviews, address findings, and run the repository validation checks.

## Phase 7: Convergence

- [X] T017 Extend `tests/Clutch.API.Tests/Integration/Persistence/SinglePersonAccountOwnershipMigrationTests.cs` to seed and verify preservation of linked import reviews, review rows, and audit events for mapped and unresolved accounts, and verify after out-of-band repair that import-related data is accessible only to the assigned owner per FR-005 and FR-006 (partial).
- [X] T018 Add agent-executable setup for the authenticated privacy journey in `src/clutch-web/e2e/family-accounts-import.spec.ts` so owner and other-user browser sessions can be provisioned and the cross-user denial scenario runs without pre-supplied storage-state files per US1/AC2 and T006 (partial).

## Phase 8: Convergence

- [X] T019 Replace the mocked-session privacy scenario in `src/clutch-web/e2e/family-accounts-import.spec.ts` with a browser journey that provisions two test users through the API, authenticates separate sessions, and verifies the real API denies the second user's account request; make the required test API startup agent-executable and update `specs/005-single-user-access/quickstart.md` to document the setup per US1/AC2 and T018.

## Phase 9: Convergence

- [X] T020 CRITICAL: Clear user-scoped React Query data on sign-out and add a same-device user-switching regression test proving the next individual never sees the previous user's account or import data per Constitution V and US1 edge case (contradicts).
- [X] T021 Add SQL Server integration tests that attempt to confirm and cancel another owner's import review by review ID and verify the requests are denied without changing the review or related data per FR-002 and US1/AC2 (partial).
