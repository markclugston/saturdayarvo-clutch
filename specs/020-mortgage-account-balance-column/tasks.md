---

description: "Clutch task list: Mortgage Account Balance Column"
---

# Tasks: Mortgage Account Balance Column

**Input**: `specs/020-mortgage-account-balance-column/` (plan.md, spec.md, data-model.md, research.md, contracts/)

**Tests**: REQUIRED (ENG-001). Write tests first and confirm they fail before implementing.

## Format: `- [ ] T### [P?] [US#?] Description with exact file path`

API paths are under `src/Clutch.API/`, API tests under `tests/Clutch.API.Tests/`, web under `src/clutch-web/`.

## Phase 1: Setup

None needed: no new packages or config (plan Technical Context).

## Phase 2: Foundational (blocks all stories)

- [X] T001 [P] Unit tests for `Mortgage.Create`/`Update` with `Guid? accountId` (Version still bumps) in `tests/Clutch.API.Tests/Unit/Mortgages/MortgageTests.cs`
- [X] T002 [P] Unit tests for `MortgageCandidate.AccountId` parsing (blank = none; non-GUID = `accountId` error "Choose one of your accounts") in `tests/Clutch.API.Tests/Unit/Mortgages/MortgageValidatorTests.cs`
- [X] T003 Add nullable `AccountId` to `Mortgage` (Create/Update) in `src/Clutch.API/Domain/Mortgages/Mortgage.cs` and `AccountId` parsing to `MortgageValidator.cs` (data-model.md)
- [X] T004 Configure nullable FK to `Accounts` with `OnDelete SetNull` and `IX_Mortgages_AccountId` in `src/Clutch.API/Infrastructure/Persistence/AppDbContext.cs`
- [X] T005 Add migration `*_MortgageAccountLink` (additive, nullable, `Down` drops FK, index, column) in `src/Clutch.API/Infrastructure/Persistence/Migrations/`
- [X] T006 [P] Migration up/down integration test (SQL Server fixture; also asserts the `Accounts` and `Transactions` tables are unchanged, FR-001) in `tests/Clutch.API.Tests/Integration/Persistence/MortgageAccountLinkMigrationTests.cs`
- [X] T007 [P] Add `accountId` (nullable string) to mortgage schema and period balances Zod schema (`currencyCode`, `periodCount`, `balances`) in `src/clutch-web/src/lib/api/schemas.ts`

**Checkpoint**: build + fast tests pass.

---

## Phase 3: User Story 1 - Link a mortgage to its account (Priority: P1) MVP

**Goal**: Optional "Mortgage Account" drop-down saved with the mortgage. | **Independent Test**: Pick an account, save, reload, pick kept; clear it and it stays empty.

- [X] T008 [P] [US1] Integration tests: `accountId` save, load, clear, foreign/unknown id 400 `accountId`, account delete sets null and mortgage still saves, stale version with `accountId` returns the existing conflict response (FR-003), one audit row per save with a link (AUD-001) in `tests/Clutch.API.Tests/Integration/Mortgages/MortgageUpdateTests.cs` and `MortgageCreateTests.cs`
- [X] T009 [P] [US1] Component tests: select label, "None" first, alphabetical case-insensitive options, empty accounts, missing linked id shown as none, accounts load failure offers only "None" and the form stays usable, dirty/cancel in `src/clutch-web/src/features/mortgages/LoanDetailsForm.test.tsx`
- [X] T010 [P] [US1] Draft tests: `accountId` in draft, dirty comparison, input mapping, server error mapping in `src/clutch-web/src/features/mortgages/loanDraft.test.ts`
- [X] T011 [US1] Ownership check via `AccountService.GetOwnedAsync` (400 `accountId` when foreign/unknown) and pass `AccountId` through in `src/Clutch.API/Application/Mortgages/MortgageService.cs`
- [X] T012 [US1] Add `accountId` to POST/PUT request and GET response in `src/Clutch.API/Api/Endpoints/MortgageEndpoints.cs` (contracts/mortgage-account-balance-api.md)
- [X] T013 [US1] Add `accountId` to the draft in `src/clutch-web/src/features/mortgages/loanDraft.ts`
- [X] T014 [US1] Add `Mortgage Account` `FloatingField as="select"` after Payment Frequency using `getAccounts`/`['accounts']`, plus `onAccountChange`, in `src/clutch-web/src/features/mortgages/LoanDetailsForm.tsx`
- [X] T015 [US1] Hold live `accountId` state and pass it down in `src/clutch-web/src/features/mortgages/MortgagesPage.tsx` and `LoanPayoffTimeline.tsx` (verified by the T018 and T028 component tests, which assert the schedule follows the drop-down's current selection; SC-001)

**Checkpoint**: story's tests pass; phase gates per test cadence.

---

## Phase 4: User Story 2 - See account balance per period (Priority: P1)

**Goal**: Balance column right of Bank Schedule showing end-of-period balances. | **Independent Test**: Link an account with balance-bearing transactions; each period shows the last balance on or before its end.

- [X] T016 [P] [US2] Unit tests for `PeriodBalances`: weekly, fortnightly, monthly, irregular, blank before first and after latest balance-bearing date, same-day order (TransactionDate, Id: matches the Transactions list order), null balances skipped, period 1 starts on the drawdown date and ends one payment interval later (FR-006), the final row is a single day, a balance never carried into a period starting after the latest balance-bearing date (FR-005a) in `tests/Clutch.API.Tests/Unit/Mortgages/PeriodBalancesTests.cs`
- [X] T017 [P] [US2] Integration tests for `GET /api/mortgages/period-balances` with drawdown/frequency/duration: values, 404 foreign/unknown account (FR-010), account with no balance-bearing transactions returns blank cells, 400 field keys for partial/invalid params, trailing nulls omitted, bounded response, SC-004 timing (360 periods with 10,000 transactions returns in under 2 s), and no balance or description in captured logs (SEC-003) in `tests/Clutch.API.Tests/Integration/Mortgages/PeriodBalancesTests.cs`
- [X] T018 [P] [US2] Component tests: column position right of Bank Schedule, header = account description, currency formatting, blank cells, no column without account and the existing schedule tests still pass unchanged (SC-003), request sends all three of drawdown/frequency/duration or none, loading `aria-busy`, load failure message in `src/clutch-web/src/features/mortgages/AmortizationScheduleAccount.test.tsx`
- [X] T019 [P] [US2] Unit tests for the balance-read metric (counter and duration histogram on `Clutch.API.Mortgages`) in `tests/Clutch.API.Tests/Unit/Mortgages/MortgageMetricsTests.cs`
- [X] T020 [US2] Implement pure `PeriodBalances` lookup (no HTTP/EF types) in `src/Clutch.API/Domain/Mortgages/PeriodBalances.cs`
- [X] T021 [US2] Implement `PeriodBalanceService` (owner check, one `AsNoTracking` projection of `(TransactionDate, Balance)` ordered by date then Id, `Min`/`Max` date, period 1 starts on the drawdown date and period k on `RepaymentDates.FinalRepaymentDate(drawdown, k, frequency)` (research R2), stop after latest balance date; structured log of mortgage and account ids only, no balances: OPS-001, SEC-003) in `src/Clutch.API/Application/Mortgages/PeriodBalanceService.cs`
- [X] T022 [P] [US2] Add balance-read counter and duration histogram in `src/Clutch.API/Application/Mortgages/MortgageMetrics.cs`
- [X] T023 [US2] Add `GET /api/mortgages/period-balances` route with query validation in `src/Clutch.API/Api/Endpoints/MortgageEndpoints.cs` and register `PeriodBalanceService` in `src/Clutch.API/Infrastructure/DependencyInjection.cs`
- [X] T024 [US2] Add `getPeriodBalances` and `usePeriodBalances` (key `['mortgage-period-balances', ...]`) in `src/clutch-web/src/features/mortgages/api.ts`
- [X] T025 [US2] Add optional account props and fourth balance column (loading, error, blank cells, balances looked up by period index) in `src/clutch-web/src/features/mortgages/AmortizationSchedule.tsx`
- [X] T026a [P] [US2] (FR-011) Component/hook tests, written first: balances query refetched after an import and after a transaction delete in `src/clutch-web/src/features/imports/ImportPage.test.tsx` and `src/clutch-web/src/features/accounts/useTransactions.test.tsx`
- [X] T026 [P] [US2] (FR-011) Invalidate `['mortgage-period-balances']` where `['accounts']` is invalidated after import and transaction delete in `src/clutch-web/src/features/imports/ImportPage.tsx` and `src/clutch-web/src/features/accounts/useTransactions.ts`

**Checkpoint**: story's tests pass; phase gates per test cadence.

---

## Phase 5: User Story 3 - Monthly balances before details are complete (Priority: P2)

**Goal**: Monthly fallback rows from the account's first balance-bearing transaction. | **Independent Test**: New mortgage with incomplete Details and an account picked shows monthly rows; completing and saving switches to the mortgage's periods.

- [X] T027 [P] [US3] Integration tests for fallback mode (no drawdown/frequency/duration): start at first balance-bearing transaction (leading balance-less transactions ignored), day anchored and month-end clamped (FR-008), rows to month of latest balance-bearing transaction (trailing balance-less ignored), 0 periods when no balance-bearing transactions in `tests/Clutch.API.Tests/Integration/Mortgages/PeriodBalancesTests.cs`
- [X] T028 [P] [US3] Component tests: fallback rows with blank calculated cells, no-transactions shows enter-details prompt, switch to own periods after save in `src/clutch-web/src/features/mortgages/AmortizationScheduleAccount.test.tsx`
- [X] T029 [US3] Implement fallback period generation (monthly, day anchored, from first to latest balance-bearing transaction month) in `src/Clutch.API/Application/Mortgages/PeriodBalanceService.cs`
- [X] T030 [US3] Render fallback rows (full column set per FR-008: only Period and the balance filled; every other column, including Date and Bank Schedule, blank) when Details are incomplete (new, unsaved mortgage) and an account is picked in `src/clutch-web/src/features/mortgages/AmortizationSchedule.tsx`

**Checkpoint**: story's tests pass; phase gates per test cadence.

---

## Phase 6: Completion Gates

- [X] T031 Browser journey: link account with seeded balances, column right of Bank Schedule, clear link removes column, axe in both themes (WEB-001) in `src/clutch-web/e2e/mortgages.spec.ts`
- [X] T032 Independent query review of the period-balances query and ownership checks (DOT-002, `clutch-data-access`)
- [X] T033 Migration review with rollback plan (OPS-001, `clutch-data-access`)
- [X] T034 Independent security review of the full diff (SEC-001..003, `clutch-security-review`), including the dependency vulnerability review (expected result: no packages added or changed)
- [X] T035 Validate UI compliance checklist in both themes, with screenshots (WEB-001, `clutch-ui-style`)
- [X] T036 Run completion quality gates per `quickstart.md` and record results (ENG-001), then run `/speckit-converge` before declaring completion (Workflow and Delivery Gates)

---

## Dependencies & Execution Order

- Foundational, then US1, US2, US3, then Completion Gates.
- T005 needs T003, T004. T011 and T012 need T003. T014 needs T013, T007. T015 needs T014.
- US2 needs US1 (account link and drop-down). T026 needs T026a failing first. T022 needs T019 failing first. T021 needs T020. T023 needs T021, T022. T024 needs T007. T025 needs T024.
- US3 builds on US2: T029 extends T021 and T030 extends T025.
- Tasks editing the same file (`MortgageEndpoints.cs`, `PeriodBalanceService.cs`, `AmortizationSchedule.tsx`) are sequential.

## Parallel Opportunities

- Foundational: T001, T002, T006, T007
- US1: T008, T009, T010
- US2: T016, T017, T018, T019, T026a, then T022 and T026 alongside the main chain
- US3: T027, T028

## Implementation Strategy

MVP = User Story 1 plus User Story 2 (link and see balances; both P1). Add US3 (fallback) next. Each story must pass its own tests before the next starts.
