---

description: "Task list for 016 Mortgages Screen"
---

# Tasks: Mortgages Screen

**Input**: `specs/016-mortgage-tracking/` (plan.md, spec.md, data-model.md, research.md, contracts/, quickstart.md)

**Tests**: REQUIRED. ENG-001 makes every behaviour change an explicit request for tests. Write
tests first and confirm they fail before implementing.

## Format: `- [ ] T### [P?] [US#?] Description with exact file path`

- **[P]**: parallel-safe (different files, no dependency). **[US#]**: user story label.
- Paths and patterns follow the nearest existing sibling (`docs/code-map.md`): API siblings are
  `CategoryNode*`, web siblings are `features/categories/` and `AddCategoryForm.tsx`.
- Abbreviations: `API` = `src/Clutch.API`, `TESTS` = `tests/Clutch.API.Tests`, `WEB` = `src/clutch-web`.
- Task IDs are stable, not sequential: T073–T076 were added after the first draft and sit where they
  run (T073 and T075 in Foundational, T076 in US3, T074 in Completion Gates). Follow phase order, not ID order.
- Terminology: "Burn Down" names the group and chart component (`BurnDownChart`); its visible heading
  is "Mortgage Burndown" and its placeholder message says "The burn down will appear once the
  schedule is calculated." All three wordings are intended UI text from the spec; don't normalise them.

No Setup phase: no new packages (research R1, R2, R3).

## Phase 2: Foundational (blocks all stories)

- [ ] T001 [P] Unit tests for final repayment date (R10 vectors: 1 Jan 2000 × 360 monthly → 1 Dec 2029, 31 Jan monthly clamps, weekly/fortnightly, overflow past 31 Dec 9999, 1 Jan 0001 × 1 monthly → 1 Jan 0001, 29 Feb 0004 × 13 monthly → 28 Feb 0005, 1 Jan 0050 × 2 weekly → 8 Jan 0050) in `TESTS/Unit/Mortgages/RepaymentDatesTests.cs`
- [ ] T002 [P] Unit tests for Mortgage aggregate (name trimmed, Version starts at 1 and +1 per update, rate-change set replaced, changes ordered by EffectiveDate) in `TESTS/Unit/Mortgages/MortgageTests.cs`
- [ ] T003 [P] `RepaymentFrequency` enum `Weekly` | `Fortnightly` | `Monthly` in `API/Domain/Mortgages/RepaymentFrequency.cs`
- [ ] T004 Final repayment date (first + (N − 1) × 7/14 days or `AddMonths(N − 1)`; arithmetic overflow check before `DateOnly` calls, per R10) in `API/Domain/Mortgages/RepaymentDates.cs`
- [ ] T005 [P] `InterestRateChange` (Id, MortgageId, NewInterestRate, EffectiveDate per data-model.md) in `API/Domain/Mortgages/InterestRateChange.cs`
- [ ] T006 `Mortgage` aggregate per data-model.md (Id, OwnerUserId, trimmed Name, StartingBalance, NumberOfPeriods, FirstRepaymentDate, RepaymentFrequency, CreatedAtUtc, Version, ReplaceRateChanges) in `API/Domain/Mortgages/Mortgage.cs`
- [ ] T007 EF mapping in `API/Infrastructure/Persistence/AppDbContext.cs`: `Name nvarchar(100)` with `.UseCollation("Latin1_General_100_CI_AS")` (uniqueness ignoring case must not depend on the database default, R6), `StartingBalance decimal(19,2)`, `NewInterestRate decimal(5,2)`, `date` columns, frequency `nvarchar(20)` as string, `Version` `IsConcurrencyToken()`
- [ ] T008 Keys and indexes in `API/Infrastructure/Persistence/AppDbContext.cs`: unique `(OwnerUserId, Name)`, `(OwnerUserId, CreatedAtUtc)`, unique `(MortgageId, EffectiveDate)`, owner FK Restrict, rate-change FK cascade, check `LEN(LTRIM(RTRIM(Name))) > 0`
- [ ] T009 [P] SQL Server migration test (applies, `Name` column collation is CI, `Down` drops `MortgageInterestRateChanges` then `Mortgages`, audit rows untouched; written first, passes once T010 exists) in `TESTS/Integration/Persistence/MortgagesMigrationTests.cs`
- [ ] T010 Generate migration `Mortgages` (two tables, FKs, indexes; no existing data touched) in `API/Infrastructure/Persistence/Migrations/`
- [ ] T073 [P] `MeterListener` tests: save/delete outcome counters and duration recorded on meter `Clutch.API.Mortgages`, in `TESTS/Unit/Mortgages/MortgageMetricsTests.cs`
- [ ] T011 `MortgageMetrics` (meter `Clutch.API.Mortgages`, save/delete outcome counters and duration, as `ImportMetrics.cs`) in `API/Application/Mortgages/MortgageMetrics.cs`; `AddMeter` in `API/Program.cs`
- [ ] T012 [P] Zod `InterestRateChange`, `MortgageInput`, `MortgageResponse` (frequency enum, `yyyy-MM-dd` dates, ≤ 60 changes, `startingBalance` `.max(999999999999.99)`) per contracts/mortgages-api.md, with tests incl. an exact round-trip at 999,999,999,999.99, in `WEB/src/lib/api/schemas.ts` and `schemas.test.ts`
- [ ] T075 [P] Add style guide §5 rules for the tab strip (selected-tab indicator via tokens, no borders, horizontal scroll within itself, trash-icon placement) and the toast (raised surface, `shadow-float`, placement, auto-dismiss, reduced motion) in `.claude/skills/clutch-ui-style/references/forms-components.md`, then run `.\scripts\sync-agent-config.ps1 -From claude` (WEB-001 synchronized style-guide update)
- [ ] T013 [P] Mirror final repayment date and "1 Jan 2000" message formatting with the T001 vectors (build dates with `Date.UTC` and `setUTCFullYear`, never `new Date(y, m, d)`, which maps years 0–99 to the 1900s; years below 1000 are formatted with four digits) in `WEB/src/features/mortgages/repaymentDates.ts` and `repaymentDates.test.ts`

**Checkpoint**: build + fast tests pass; migration test passes on SQL Server.

---

## Phase 3: User Story 1 - Open the Mortgages screen (Priority: P1) 🎯 MVP

**Goal**: Mortgages nav item opens a screen with loading, load-failed and loaded layouts. | **Independent Test**: Select Mortgages and see the tab strip, then the "Loan details", "Mortgage Burndown" and "Amortization Schedule" group shells in that order. The form, chart and table arrive in US2, US5 and US4.

- [ ] T014 [P] [US1] SQL Server tests for `GET /api/mortgages`: 401 anonymous, owner-only (SC-007), creation order with Id tie-break, rate changes in EffectiveDate order, in `TESTS/Integration/Mortgages/MortgageListTests.cs`
- [ ] T015 [P] [US1] App tests: "Mortgages" nav button directly above "Categories", `aria-current="page"` when shown, in `WEB/src/App.test.tsx` and `WEB/src/components/ui/side-nav.test.tsx`
- [ ] T016 [P] [US1] Page tests: loading `role="status"` spinner + "Loading..." (FR-023), failure `role="alert"` generic text + Retry with no form (FR-024), Retry immediately replaces the alert with the Loading... status, 401 on load returns to the sign-in screen with no alert, loaded layout order (tab strip, then the Loan details shell, then the Burndown and Schedule shells side by side), in `WEB/src/features/mortgages/MortgagesPage.test.tsx`
- [ ] T017 [P] [US1] Tab strip tests: `nav` "Mortgages" list, buttons in creation order then "Add mortgage", selected has `aria-current="true"`, Enter/Space selects, axe reports no violations for the strip, long name truncated with full name in `title`, in `WEB/src/features/mortgages/MortgageTabs.test.tsx`
- [ ] T018 [US1] `MortgageService.ListAsync` (owner filter, `AsNoTracking`, `Include` rate changes, one query) in `API/Application/Mortgages/MortgageService.cs`; register scoped in `API/Infrastructure/DependencyInjection.cs`
- [ ] T019 [US1] `MapMortgageEndpoints` group `/api/mortgages` with `RequireAuthorization` and `GET` in `API/Api/Endpoints/MortgageEndpoints.cs`; call it in `API/Program.cs`
- [ ] T020 [US1] `listMortgages` and `useMortgages` query (parsed with T012 schemas; a 401 surfaces as a typed unauthorized case, not a load failure) in `WEB/src/features/mortgages/api.ts`
- [ ] T021 [US1] Add `onMortgages`/`mortgagesCurrent` nav item above Categories in `WEB/src/components/ui/side-nav.tsx` and page switching in `WEB/src/App.tsx`
- [ ] T022 [US1] `MortgageTabs` nav list (scrolls within itself, no page horizontal scroll, truncation, keyboard) in `WEB/src/features/mortgages/MortgageTabs.tsx`
- [ ] T023 [US1] `MortgagesPage` loading (`LoaderCircle` as `StartupLoadingDialog`), failure + Retry, 401 on load resets the session query as `App.tsx` does for an expired session (sign-in screen, no alert; R9 clean-state rule), and loaded grid with group shells headed "Loan details", "Mortgage Burndown" and "Amortization Schedule", each empty until its story fills it (chart left, schedule right; stacked chart-first < 768 px) in `WEB/src/features/mortgages/MortgagesPage.tsx`

**Checkpoint**: US1 tests pass; API fast tests and web unit tests green.

---

## Phase 4: User Story 2 - Add and save a mortgage (Priority: P1)

**Goal**: Enter loan details and rate changes, save with server validation, see toast and new tab. | **Independent Test**: Add a mortgage with two rate changes, save, reload and see it again.

- [ ] T024 [P] [US2] Validator tests: every row of the contracts/mortgages-api.md message table returns its field key and exact message, and the first applicable row wins when several apply (incl. a range message from 1 Jan 0001 formatted "1 Jan 0001" under a non-English current culture, a row with both fields null ignored and not counted toward 60, 31 Dec 9999 bound, opening rate, duplicate dates flag every row, out-of-range dates, `numberOfPeriods` 1.5, 0 and −1 → whole-number message and 3,000,000,000 → 31 Dec 9999 message, `startingBalance` 999,999,999,999.99 accepted and 1,000,000,000,000.00 → `startingBalance`, rows present while `firstRepaymentDate`, `numberOfPeriods` or `repaymentFrequency` is invalid → errors on those fields only, rows not range-checked; unparseable strings "2000-13-45" and "01/01/2000" → "Enter a valid date" on `firstRepaymentDate` and on a row's `effectiveDate`, "Daily" and "weekly" → `repaymentFrequency` message, `decimal.MaxValue` → upper-bound message on each number field, `decimal.MinValue` → lower-bound message) in `TESTS/Unit/Mortgages/MortgageValidatorTests.cs`
- [ ] T025 [P] [US2] SQL Server tests for `POST`: 201 + `Location`; signed out with a valid anti-forgery token → 401; signed in without `X-CSRF-TOKEN` → 400 "A valid anti-forgery token is required." and nothing stored (as `CategoryNodeTests`, SEC-001); " home loan " vs "Home loan" → 400 `name`; 21st → 400 `mortgages`; 61 changes → 400; `numberOfPeriods: 1.5` → 400 `numberOfPeriods` (not a JSON error); badly shaped values each return their field error, never a generic JSON error (contract): `firstRepaymentDate: "2000-13-45"`, an effective date `"not a date"`, `repaymentFrequency: "Daily"`, `startingBalance: "abc"`, `numberOfPeriods: 1e30` → 31 Dec 9999 message, `newInterestRate: 1e30` → "Enter an interest rate from 0 to 100"; malformed JSON → existing generic 400; `startingBalance` 1,000,000,000,000.00 → 400 `startingBalance`; future date bound via fake `TimeProvider` (R5): at 09:59 UTC tomorrow's UTC date → 400 `firstRepaymentDate`, at 10:00 UTC it is accepted; a 10,000-row body → 413, never 500, in `TESTS/Integration/Mortgages/MortgageCreateTests.cs`
- [ ] T026 [P] [US2] SQL Server tests: concurrent creates never exceed 20 or duplicate a name (R6), and every losing create gets 400 `mortgages` or `name`, never 500; exactly one `MortgageCreate` audit row with name only, no amounts, in `TESTS/Integration/Mortgages/MortgageCreateConcurrencyTests.cs`
- [ ] T027 [P] [US2] Toast tests: `role="status"`, "Dismiss" button, closes after 5 s, paused on hover/focus, in `WEB/src/components/ui/toast.test.tsx`
- [ ] T028 [P] [US2] Form tests: floating labels, First repayment date and every Effective date are native `type="date"` inputs, add-row disabled with hint until date/periods/frequency valid, 60-row cap, remove row, empty rows dropped, partial rows flagged, clearing First repayment date, Number of periods or Repayment frequency after rows are added keeps the rows, disables "Add interest rate change" with its hint, and Save is refused with errors on the cleared fields, a First repayment date after the local today is flagged before any request is sent, an Effective date outside the range is flagged with "Choose a date from {first} to {final}" (dates formatted like "1 Jan 2000"), the screen checks every row of the contracts/mortgages-api.md message table before sending, with the exact message and the same first-row-wins order, except two that stay server-only: `name` "A mortgage with this name already exists" and `mortgages` "You can save up to 20 mortgages" (prevented on screen by the disabled "Add mortgage" tab, T030); a test per client-checked key (incl. duplicate effective dates flagging every such row, name over 100 characters after trimming, 3 decimal places on Starting balance and New interest rate, Number of periods past 31 Dec 9999), and a test that a duplicate name is sent and shows the server's 400 message, in `WEB/src/features/mortgages/LoanDetailsForm.test.tsx`
- [ ] T029 [US2] Form tests: server 400 errors under fields with `aria-invalid`/`aria-describedby` + `role="alert"` summary, non-field errors (`mortgages`, set-level `interestRateChanges`) shown in the summary / under the Interest rate changes group, values kept on failure, 500 / 413 / network failure → `role="alert"` "The mortgage could not be saved. Please try again." with values kept and no error details, "Saving…" busy state immediately, Cancel clears new form, in `WEB/src/features/mortgages/LoanDetailsForm.test.tsx`
- [ ] T030 [P] [US2] Page tests: empty and "Add mortgage" states show both groups with "Please enter your mortgage details" (FR-022); save shows "Mortgage saved" toast and selects new tab; rate changes in a loaded mortgage are listed in the order the response gives them (the server's effective-date order), not re-sorted or reversed by the screen; 20 → "Add mortgage" `aria-disabled="true"`, still focusable, `title` and accessible description "You can save up to 20 mortgages", and click / Enter / Space leave the selection unchanged, in `WEB/src/features/mortgages/MortgagesPage.test.tsx`
- [ ] T031 [US2] `MortgageValidator` for all FR-007 rules → field errors keyed per R7 with the contract message table (first applicable row per key; dates formatted `d MMM yyyy` with `CultureInfo.InvariantCulture`; all-null rows ignored), using `RepaymentDates` and `TimeProvider` (today in UTC+14, per R5) in `API/Domain/Mortgages/MortgageValidator.cs`. The validator returns a field-error result (key → message) and references no `Api` or EF types (ARC-001); `MortgageService` throws `ApiProblemException` from it (T032, T047), and the duplicate-name check stays in the service because it needs the database
- [ ] T032 [US2] `MortgageService.CreateAsync`: `CreateExecutionStrategy().ExecuteAsync` wrapping `ChangeTracker.Clear()` + Serializable transaction (count ≤ 20, duplicate name; as `ThemePreferenceService`), unique-violation → `name` error, `MortgageCreate` audit in same `SaveChanges`, metrics, logs IDs only, in `API/Application/Mortgages/MortgageService.cs`
- [ ] T033 [US2] `POST /api/mortgages` → 201 with `Location`; 400 ProblemDetails title "The mortgage is invalid." via `ApiProblemException`; loose request DTO per contracts/mortgages-api.md (numbers as `JsonElement?` converted in the endpoint to `decimal?`, out-of-range → `decimal.MaxValue`/`MinValue`, non-numbers → null; dates and frequency as `string?` parsed by the validator) so badly shaped values map to field errors and the validator sees no JSON types (ARC-001); 32 KB `RequestSizeLimit` (413), in `API/Api/Endpoints/MortgageEndpoints.cs`
- [ ] T034 [P] [US2] Base UI Toast wrapper (bottom-right, bottom-centre < 768 px, `shadow-float`, reduced motion) in `WEB/src/components/ui/toast.tsx`
- [ ] T035 [US2] `createMortgage` mutation and typed 400 field-error mapping in `WEB/src/features/mortgages/api.ts`
- [ ] T036 [P] [US2] `InterestRateChangesField` rows (New interest rate %, Effective date `type="date"`, "Remove interest rate change {n}", gated add button) in `WEB/src/features/mortgages/InterestRateChangesField.tsx`
- [ ] T037 [US2] `LoanDetailsForm` panel styled like `AddCategoryForm` with heading "Loan details", floating fields (First repayment date and Effective date as native `type="date"`, Repayment frequency select), Save/Cancel only, client checks for every contract message-table row except duplicate `name` and the `mortgages` limit (server-only, see T028), using `repaymentDates.ts` and the contract messages, generic save-failure alert, in `WEB/src/features/mortgages/LoanDetailsForm.tsx`
- [ ] T038 [US2] Wire new-mortgage flow in `WEB/src/features/mortgages/MortgagesPage.tsx`: "Add mortgage" tab, empty-state placeholders, toast on save, select saved tab, at 20 "Add mortgage" `aria-disabled` (not `disabled`) with `title` and `aria-describedby` "You can save up to 20 mortgages" and activation ignored

**Checkpoint**: US2 tests pass; a saved mortgage survives reload.

---

## Phase 5: User Story 3 - Switch between and edit mortgages (Priority: P1)

**Goal**: Switch tabs, edit, delete, with clash detection and unsaved-changes guard. | **Independent Test**: Save two mortgages, switch tabs, rename one and see its tab label change.

- [ ] T039 [P] [US3] SQL Server tests for `PUT`: 200 with version + 1, an unchanged body also gets 200 with version + 1, rate-change set replaced, rename, stale version → 409 `mortgage-changed`, two concurrent `PUT`s with the same version → one 200 and one 409 (via `DbUpdateConcurrencyException`), never 500, with exactly one `MortgageUpdate` audit row (DOT-002), other user's id → 404, signed out with a valid anti-forgery token → 401, without `X-CSRF-TOKEN` → 400 and nothing changed (SEC-001), 400 rules re-applied, rename to " home LOAN " when "Home loan" exists → 400 `name`, two concurrent `PUT`s renaming two different mortgages to the same new name → one 200 and one 400 `name` (unique-index violation mapped), never 500, and only one mortgage holds the name, a body over 32 KB → 413, never 500, in `TESTS/Integration/Mortgages/MortgageUpdateTests.cs`
- [ ] T040 [P] [US3] SQL Server tests for `DELETE ?version=`: 204 with cascade, missing version → 400, stale → 409, other user → 404, signed out with a valid anti-forgery token → 401, without `X-CSRF-TOKEN` → 400 and nothing deleted (SEC-001), in `TESTS/Integration/Mortgages/MortgageDeleteTests.cs`
- [ ] T041 [P] [US3] SQL Server tests: exactly one `MortgageUpdate` (incl. "renamed from {Old} to {New}", and one for an unchanged save) and `MortgageDelete` audit row, no amounts (SC-008), in `TESTS/Integration/Mortgages/MortgageAuditTests.cs`
- [ ] T076 [P] [US3] SQL Server log-capture tests (an in-test `ILoggerProvider` registered on the test host; no new package): a create, a 400 save, an update, a 409 update and a delete each log the mortgage ID (when one exists), and no captured message, template value or scope contains the starting balance or any interest rate sent (OPS-001, SEC-003), in `TESTS/Integration/Mortgages/MortgageLoggingTests.cs`
- [ ] T042 [P] [US3] Guard tests: `run(action)` runs at once when clean, shows "Discard unsaved changes?" when dirty, Stay keeps state, `beforeunload` only while dirty, nothing stored, in `WEB/src/components/unsaved-changes/UnsavedChangesProvider.test.tsx`
- [ ] T043 [P] [US3] Page tests: tab switch shows that mortgage; guard on tab, "Add mortgage", delete-other; Cancel restores saved values; rename updates label; a background refetch returning a newer version while dirty leaves the entered values in place, and the next save gets the 409 conflict; a background refetch that no longer includes the selected dirty mortgage keeps its tab and entered values, and the next save (404) removes the tab with the "This mortgage was deleted elsewhere" toast; a failed background refetch after a successful load leaves the tab strip, groups and form unchanged with no load-failure alert (FR-024), in `WEB/src/features/mortgages/MortgagesPage.test.tsx`
- [ ] T044 [P] [US3] Delete tests: "Delete {name}" trash button, dialog "Delete {name}?", Cancel returns focus to trash, confirm shows "Deleting…" and is disabled at once, confirm selects first tab or empty state, 409 keeps the dialog open with conflict alert + Reload, 404 removes the tab with "This mortgage was deleted elsewhere" toast, 500 / network failure keeps the dialog open with `role="alert"` "The mortgage could not be deleted. Please try again." and Delete enabled again, with unsaved changes on the selected mortgage its trash icon opens the delete dialog with no discard prompt and confirming discards the edits, 409 Reload with unsaved changes shows the discard-or-stay prompt first and Stay closes the dialog with the values unchanged, 409 Reload with no unsaved changes shows "Reloading…" on a disabled Reload button at once, then closes the dialog and shows the refreshed mortgages, a failed Reload keeps the dialog open with `role="alert"` "The latest version could not be loaded. Please try again." and Reload enabled again, no trash on "Add mortgage", in `WEB/src/features/mortgages/MortgageTabs.test.tsx`
- [ ] T045 [US3] Conflict and session tests: 409 alert + Reload → guard → Discard shows "Reloading…" on a disabled Reload button at once with the entered values still shown, then shows the latest version; a failed Reload fetch keeps the form values, conflict alert and Reload, adds `role="alert"` "The latest version could not be loaded. Please try again." with no error details and no load-failure screen; otherwise Reload shows the latest version, or removes the tab with the "This mortgage was deleted elsewhere" toast if the mortgage is gone, and Stay keeps the entered values and the conflict alert; PUT 404 → tab removed, first tab selected, "This mortgage was deleted elsewhere" toast; 401 while dirty → "Your sign-in has expired" Stay/Sign in again; 401 while clean → sign-in screen with no modal, in `WEB/src/features/mortgages/MortgagesPage.test.tsx`
- [ ] T046 [P] [US3] App tests: nav clicks and Sign out go through the guard when the Mortgages form is dirty; with the form dirty and the session expired, neither a window-focus event nor a network reconnect (`online` event) refetches the session or replaces the page with the sign-in screen; once the form is clean again, focus refetches as before, in `WEB/src/App.test.tsx`
- [ ] T047 [US3] `MortgageService.UpdateAsync`/`DeleteAsync`: owner filter, version check + `DbUpdateConcurrencyException` → 409, duplicate-name check on rename with unique-index violation → `name` field error, set replace, audit in same `SaveChanges`, metrics, in `API/Application/Mortgages/MortgageService.cs`
- [ ] T048 [US3] `PUT /api/mortgages/{id}` and `DELETE /api/mortgages/{id}?version=` with 400/404/409 ProblemDetails per contracts/mortgages-api.md and a 32 KB `RequestSizeLimit` on `PUT` (413) in `API/Api/Endpoints/MortgageEndpoints.cs`
- [ ] T049 [US3] `updateMortgage`/`deleteMortgage` mutations with typed 404, 409 and 401 cases in `WEB/src/features/mortgages/api.ts`
- [ ] T050 [US3] `UnsavedChangesProvider`, `useUnsavedChanges` (`isDirty` registration, `run(action)`, `beforeunload`, renders `DiscardChangesDialog`) in `WEB/src/components/unsaved-changes/UnsavedChangesProvider.tsx`
- [ ] T051 [P] [US3] `DiscardChangesDialog` ("Discard changes" / "Stay on this page") in `WEB/src/components/unsaved-changes/DiscardChangesDialog.tsx`
- [ ] T052 [P] [US3] `SessionExpiredDialog` ("Stay on this page" / "Sign in again") in `WEB/src/features/mortgages/SessionExpiredDialog.tsx`
- [ ] T053 [P] [US3] `DeleteMortgageDialog` ("Delete {name}?", Delete/Cancel, focus return, busy "Deleting…" state, conflict alert + Reload slot with busy "Reloading…" state and reload-failure alert, generic delete-failure alert) in `WEB/src/features/mortgages/DeleteMortgageDialog.tsx`
- [ ] T054 [US3] Trash `Trash2` button "Delete {name}" beside each mortgage tab (not "Add mortgage") in `WEB/src/features/mortgages/MortgageTabs.tsx`
- [ ] T055 [US3] Edit mode in `WEB/src/features/mortgages/LoanDetailsForm.tsx`: load saved values, report `isDirty`, Cancel restores saved values, send `version`, conflict alert + "Reload" (busy "Reloading…" and disabled while fetching, values replaced only when the latest version arrives, reload-failure alert keeps everything else); refetched mortgage data never re-initialises a dirty form (saved values load only on first load, tab switch, Cancel, successful save or Reload)
- [ ] T056 [US3] Selection, guarded switching/delete/Reload, post-delete first tab, 404 from save/delete removes the tab and toasts "This mortgage was deleted elsewhere", delete 409 Reload via guard, failed Reload keeps the screen (never the FR-024 failure state), background refetch errors after first load ignored on screen, a dirty selected mortgage missing from a refetch keeps its tab until save/delete returns 404, 401 session-expired flow in `WEB/src/features/mortgages/MortgagesPage.tsx`
- [ ] T057 [US3] Wrap app in `UnsavedChangesProvider`; route nav clicks and Sign out through `run`; "Sign in again" resets session as sign-out does; while `isDirty`, the session query does not refetch on focus or reconnect (R9), in `WEB/src/App.tsx`

**Checkpoint**: US3 tests pass; switching, editing, deleting and clash handling work end to end.

---

## Phase 6: User Story 4 - See the amortization schedule layout (Priority: P2)

**Goal**: Read-only schedule with N + 1 placeholder rows. | **Independent Test**: Save 360 periods and see rows 1–361 with Period, Date, Bank schedule and no inputs.

- [ ] T058 [P] [US4] Schedule tests: `role="table"`, headers Period/Date/Bank schedule, `aria-rowcount` = N + 2, cells "Not yet calculated", no inputs, windowed (≈522,000 rows renders a small slice), sticky header stays after scroll, row count updates after Number of periods is saved, new mortgage shows prompt, in `WEB/src/features/mortgages/AmortizationSchedule.test.tsx`
- [ ] T059 [US4] Windowed fixed-row-height `AmortizationSchedule` (sticky header, scrolls within group, `aria-rowindex`, R3) in `WEB/src/features/mortgages/AmortizationSchedule.tsx`
- [ ] T060 [US4] Render schedule for the selected mortgage's saved `numberOfPeriods` (redraws on save) in `WEB/src/features/mortgages/MortgagesPage.tsx`

**Checkpoint**: US4 tests pass.

---

## Phase 7: User Story 5 - See the burn down chart layout (Priority: P2)

**Goal**: Chart skeleton titled "Mortgage Burndown" with one "Bank schedule" series. | **Independent Test**: Select a mortgage and see title, axes, legend and the not-yet-calculated message.

- [ ] T061 [P] [US5] Chart tests: heading "Mortgage Burndown", SVG `role="img"` with text alternative, labelled currency balance axis and repayment date axis, legend "Bank schedule" only, message "The burn down will appear once the schedule is calculated.", new-mortgage prompt, in `WEB/src/features/mortgages/BurnDownChart.test.tsx`
- [ ] T062 [US5] Inline SVG `BurnDownChart` (currency balance axis, repayment date axis, `primary` series token, guides, R1) in `WEB/src/features/mortgages/BurnDownChart.tsx`
- [ ] T063 [US5] Render chart left of the schedule (first when stacked) in `WEB/src/features/mortgages/MortgagesPage.tsx`

**Checkpoint**: US5 tests pass.

---

## Phase 8: Completion Gates

- [ ] T064 Browser journey per quickstart.md (add with two rates entered latest-first, toast, reload and see them in effective-date order (US2-AS6), sign out and back in with values unchanged (SC-002), second mortgage, switch, with 5 mortgages tab switch shows details within 1 s (SC-003), rename, guard stay/discard, delete cancel/confirm, 320 px) in `WEB/e2e/mortgages.spec.ts`; add to `testMatch` in `WEB/playwright.ownership.config.ts` (WEB-001)
- [ ] T065 Style-guide states for Mortgages (loading, failed, empty, loaded, dialogs, toast; toast bounding box at bottom-right on desktop and bottom-centre at 320 px, no toast or spinner animation under emulated `prefers-reduced-motion: reduce`; Light, Dark and System (with emulated light and dark `prefers-color-scheme`); 320 px and desktop; axe clean; with 10 mortgages at 320 px and desktop the tab strip scrolls within itself to reach the last tab and "Add mortgage" while the page has no horizontal scroll (`document.documentElement.scrollWidth <= clientWidth`), US3-AS8; at 320 px the Burn Down group's bounding box is entirely above the Amortization Schedule's, and at desktop width it is to its left (FR-011)) in `WEB/e2e/style-guide.spec.ts` (WEB-001, SC-006)
- [ ] T066 Independent query review of `MortgageService` queries and indexes (DOT-002, `clutch-data-access`)
- [ ] T067 Migration review with rollback plan for `*_Mortgages` (OPS-001, `clutch-data-access`)
- [ ] T068 Audit append-only check: only inserts to `Audit`, no amounts in descriptions (AUD-001, `clutch-data-access`)
- [ ] T069 Independent security review of the full diff incl. `dotnet list saturdayarvo-clutch.slnx package --vulnerable --include-transitive` and `npm audit --omit=dev` (SEC-001, SEC-003, `clutch-security-review`)
- [ ] T070 Verify logs and errors carry mortgage IDs only (T076 passing, plus review of every new log call), health check covers new tables, `Clutch.API.Mortgages` meter emits (OPS-001, Performance & Observability)
- [ ] T071 Validate the plan's UI compliance checklist in both themes (WEB-001, `clutch-ui-style`)
- [ ] T072 Run completion quality gates from quickstart.md (build, fast + SqlServer tests, lint, Vitest, build, Playwright) and record results (ENG-001)
- [ ] T074 Run `/speckit-converge` and complete any tasks it appends before declaring completion (Workflow gates)

---

## Dependencies & Execution Order

- Foundational → US1 → US2 → US3 → US4/US5 (US4 and US5 can run in parallel) → Completion Gates.
- T022 and T034 need T075 (style-guide rules first).
- T004 needs T003; T006 needs T004, T005; T007–T008 need T006; T010 needs T008; T009 runs against T010; T011 needs T073 (test first).
- US1 T018–T019 need T010; T020 needs T012. T023 handles the clean-state 401 so T016 passes in US1; the dirty-state session-expired modal arrives in US3 (T052, T056).
- US2 T031 needs T004 and T013 mirrors it; T037 needs T036 and T013; T038 needs T034, T035, T037.
- US3 T050 needs T051; T056 needs T050–T055; T057 needs T050. US3 builds on the US2 form (T037).
  T076 is written first and passes once T032, T047 and T048 exist.
- US4/US5 placeholders (T060, T063) replace the empty-state slots added in T023/T038.

## Parallel Opportunities

- Foundational: T001, T002, T003, T005, T009, T073, T012, T013, T075
- US1: T014, T015, T016, T017
- US2: T024–T028, T030; then T034 and T036 alongside T031–T033
- US3: T039–T044, T046, T076; then T051, T052, T053 alongside T047–T050
- US4 and US5 phases in parallel with each other (T058/T059 alongside T061/T062)

## Implementation Strategy

MVP = User Story 1 on top of Foundational (navigable screen with load states), then US2 to make it
useful. Deliver stories incrementally; each must pass its own tests before the next starts.
