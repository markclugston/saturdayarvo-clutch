---

description: "Task list for 029 Asset Register"
---

# Tasks: Asset Register

**Input**: `specs/029-asset-register/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Tests**: REQUIRED. ENG-001 makes every behaviour change an explicit request for tests. Write
tests first and confirm they fail before implementing.

## Format: `- [ ] T### [P?] [US#?] Description with exact file path`

- **[P]**: parallel-safe (different files, no dependency). **[US#]**: user story label.
- Patterns: mortgages for CRUD (`Application/Mortgages/MortgageService.cs`, `features/mortgages/`), imports for the
  lease (`Infrastructure/Imports/AccountImportLease.cs`, `features/imports/useImportStatus.ts`, `ImportEndedDialog.tsx`).

## Phase 1: Setup

None. No new packages (plan).

## Phase 2: Foundational (blocks all stories)

- [X] T001 [P] Update `tests/Clutch.API.Tests/Unit/Audit/AuditTests.cs`: description over 500 chars accepted, blank still rejected (R2)
- [X] T002 [P] Unit tests for `AssetValidator` (FR-007/008/009 rules: name required and 1–100 after trimming, description ≤500, currency required and supported, value cap 999,999,999,999.99 accepted and one cent more rejected, decimals limited to the currency's minor units (AUD 2 dp accepted, 3 dp rejected; JPY 1 dp rejected), field keys per contracts/assets-api.md) in `tests/Clutch.API.Tests/Unit/Assets/AssetValidatorTests.cs`
- [X] T003 [P] Unit tests for `AssetAuditText` (every event's content per data-model.md "Audit events", including currency and an old/new currency change, `AssetDelete` listing each removed valuation; values in the currency's minor units with the code, ISO dates) in `tests/Clutch.API.Tests/Unit/Assets/AssetAuditTextTests.cs`
- [X] T004 [P] Migration test: three tables, unique `(AssetId, ValuationDate DESC)` index, `CK_Assets_SupportedCurrency` rejects an unsupported code, `Audit.Description` nvarchar(max) with rows and `CK_Audit_NonBlankDescription` kept, in `tests/Clutch.API.Tests/Integration/Persistence/AssetsMigrationTests.cs`
- [X] T005 Remove the 500-character limit (keep non-blank check) in `src/Clutch.API/Domain/Audit/Audit.cs`
- [X] T006 [P] Entities `Asset` (with `CurrencyCode`), `AssetValuation`, `AssetEdit` with `AssetEditState` per data-model.md in `src/Clutch.API/Domain/Assets/`
- [X] T007 [P] `AssetValidator` (name 1–100 trimmed; description ≤500, empty→null; currency via `Currency.TryGet`; value ≥0, ≤999,999,999,999.99, decimals ≤ the currency's `MinorUnits`; date not future via UTC+14 rule as `MortgageValidator`; ≥1 valuation; unique dates) in `src/Clutch.API/Domain/Assets/AssetValidator.cs` (research R9)
- [X] T008 [P] `AssetAuditText` builders per data-model.md "Audit events" in `src/Clutch.API/Domain/Assets/AssetAuditText.cs`
- [X] T009 Configure `Assets` (`CurrencyCode` nvarchar(3) with `CK_Assets_SupportedCurrency` matching `CK_Accounts_SupportedCurrency`, `ActiveEditId` not an FK, `IX_Assets_OwnerUserId_CreatedAtUtc`), `AssetValuations` (cascade, unique `IX_AssetValuations_AssetId_ValuationDate` on `(AssetId, ValuationDate DESC)` INCLUDE `Value`), `AssetEdits` (cascade, state check constraint, `IX_AssetEdits_AssetId_State`), Audit nvarchar(max) in `src/Clutch.API/Infrastructure/Persistence/AppDbContext.cs`
- [X] T010 Generate migration `AddAssets` and edit Up so it drops `CK_Audit_NonBlankDescription`, alters `Audit.Description` to `nvarchar(max)`, then recreates the constraint with the same name and expression (SQL Server refuses `ALTER COLUMN` on a column a check constraint references; EF does not drop it). Down drops the three tables and leaves `Audit.Description` and the constraint as they are (R2). In `src/Clutch.API/Infrastructure/Persistence/Migrations/`
- [X] T011 [P] `AssetMetrics` meter (save, delete, acquire, end, status counters/durations, plus an expired-edit counter in place of an expiry audit; tags operation and outcome only) with tests in `src/Clutch.API/Application/Assets/AssetMetrics.cs`, `tests/Clutch.API.Tests/Unit/Assets/AssetMetricsTests.cs`
- [X] T012 Empty `MapAssetEndpoints` group `/api/assets` (`RequireAuthorization`, CSRF, 64 KB limit) in `src/Clutch.API/Api/Endpoints/AssetEndpoints.cs`; register meter and endpoints in `src/Clutch.API/Program.cs`
- [X] T013 [P] Asset schemas (`AssetList` with `totals: CurrencyTotal[]` whose `totalValue` is a decimal string, `currencyCode` on `AssetListItem`, `AssetDetail` and `AssetInput`, `EditLease`, `EditStatus` with `activeEdit { id, expiresAtUtc }` and no `canEnd`) and tests (value 999,999,999,999.99 round-trips exactly and one cent more is rejected; a `totalValue` beyond JavaScript's exact range is kept as the exact string; `"5000"` accepted for a JPY total) in `src/clutch-web/src/lib/api/schemas.ts`, `schemas.test.ts`
- [X] T014 [P] `FormattedNumberField` optional `decimals` prop (default 2, so existing callers are unchanged; `clean` keeps at most `decimals` fraction digits and drops the decimal point when `decimals` is 0) with tests (default behaviour unchanged, `decimals={0}` never displays "." or fraction digits, pasted "1,234.56" becomes "1234") in `src/clutch-web/src/features/mortgages/FormattedNumberField.tsx`, `FormattedNumberField.test.tsx` (research R9, WEB-001)
- [X] T015 [P] `assetRoute.ts` (parse/push `/assets`, `/assets/new`, `/assets/{id}`, `popstate`) with tests in `src/clutch-web/src/features/assets/assetRoute.ts`, `assetRoute.test.ts` (R1)
- [X] T016 Assets nav item below Accounts, page state from path at startup and `popstate`, other nav pushes `/`, via `useUnsavedChanges().run`, tests in `src/clutch-web/src/App.tsx`, `App.test.tsx` (FR-001), including: Back/Forward away from a dirty asset shows the unsaved-changes prompt, Stay keeps the asset and restores its URL, Discard follows the navigation (FR-014, research R1). `/assets` renders `AssetsPage`; `/assets/new` and `/assets/{id}` render `AssetPage` (with `assetId` for the latter). Create stubs `src/clutch-web/src/features/assets/AssetsPage.tsx` (heading only) and `src/clutch-web/src/features/assets/AssetPage.tsx` (heading only, a test hook that calls `setDirty`) so routing and the dirty Back/Forward tests run; T022 replaces the list stub and T032 the page stub.

**Checkpoint**: build + fast tests pass; migration test passes on Docker SQL Server.

---

## Phase 3: User Story 1 - View Assets And Their Totals (Priority: P1) 🎯 MVP

**Goal**: Owner sees assets in created order with latest valuation and an exact total per currency | **Independent Test**: Seeded assets show in order with latest Valuation and correct per-currency totals.

- [X] T017 [P] [US1] SqlServer tests: latest valuation only, created order, exact decimal total per currency ordered by currency code (including a total above 999,999,999,999.99 returned as the exact string, a JPY total with no decimals, and AUD and USD assets never summed together), empty list `totals: []`, owner isolation, and 100 assets with several valuations each returned in one query within 2 s (SC-002), in `tests/Clutch.API.Tests/Integration/Assets/AssetListTests.cs` (+ `AssetTestSupport.cs`)
- [X] T018 [P] [US1] Component tests: loading state shown within 500 ms while the list loads, rows, truncation with `title`, right-aligned Valuation and total rows, each Valuation formatted in its asset's currency (AUD, USD, JPY with no decimals), one "Total {code}" row per `totals` entry in the order returned, Valuation date shown via `formatDisplayDate` (e.g. "1 Jan 2026"), empty state with no total row, list or currencies load failure (network/5xx) shows the error with "Retry" that refetches and no rows or total row, row opens `/assets/{id}`, in `src/clutch-web/src/features/assets/AssetsPage.test.tsx`
- [X] T019 [US1] `AssetService.ListAsync`: one no-tracking projection with latest-valuation sub-select, then server `decimal` totals grouped by currency, ordered by code, each formatted as an invariant string with the currency's minor units (R6, R9) in `src/Clutch.API/Application/Assets/AssetService.cs`
- [X] T020 [US1] GET `/api/assets` → `AssetList` in `src/Clutch.API/Api/Endpoints/AssetEndpoints.cs`; register `AssetService` in `src/Clutch.API/Infrastructure/DependencyInjection.cs`
- [X] T021 [P] [US1] `listAssets` client in `src/clutch-web/src/features/assets/api.ts` with tests in `api.test.ts`
- [X] T022 [US1] `AssetsPage` (heading, Add Asset, table, Valuation via `formatCurrencyAmount(value.toFixed(minorUnits), currencyCode)` with `minorUnits` from `getCurrencies`, one "Total {code}" row per `totals` entry via `formatCurrencyAmount(totalValue, currencyCode)`, dates via `formatDisplayDate` imported from `features/mortgages/loanDraft.ts`, `tabular-nums`, load-failure `ErrorMessage` with Retry) per contracts/assets-ui.md in `src/clutch-web/src/features/assets/AssetsPage.tsx`, replacing the T016 stub

**Checkpoint**: US1 tests pass.

---

## Phase 4: User Story 2 - Add An Asset (Priority: P1)

**Goal**: Add an asset with valuations on `/assets/new`, stored only on Save | **Independent Test**: Add with one valuation, Save, asset appears last and total updates.

- [X] T023 [P] [US2] SqlServer + HTTP tests: create 201 with `currencyCode` stored and returned, 400 field keys per contracts/assets-api.md (including `currencyCode` missing or unsupported, and a JPY value with decimals), body over 64 KB rejected (413) with nothing stored, all-or-nothing, one `AssetCreate` audit row, in `tests/Clutch.API.Tests/Integration/Assets/AssetCreateTests.cs`
- [X] T024 [P] [US2] Unit tests for `assetDraft` (add, remove, dirty (including a currency change), newest-first, client validation for every rule in contracts/assets-api.md "Validation": name required (empty and whitespace-only both rejected), name over 100 characters after trimming, description over 500, currency required, at least one valuation, value negative, over the cap, more decimals than the currency allows, future and duplicate date; a currency change to JPY flags each valuation with decimals) in `src/clutch-web/src/features/assets/assetDraft.test.ts` (SEC-004)
- [X] T025 [P] [US2] Component tests: OK adds to draft only, Cancel discards, field errors (negative, over cap, future, duplicate date), the Value field takes the asset currency's decimals (no "." shown for JPY) and formats in that currency, in `src/clutch-web/src/features/assets/AddValuationDialog.test.tsx`
- [X] T026 [P] [US2] Component tests: new asset Save/Cancel, Currency select listing `getCurrencies` with "Select a currency" first and Add Valuation disabled until a currency is chosen, field errors shown for missing name, name over 100, description over 500, no currency and no valuations, server field errors mapped, Save pending state within 500 ms, network/5xx failure shows an error and keeps the draft and dirty state, leaving a dirty new asset by navigation shows the existing unsaved-changes prompt (FR-014), new mode never calls `acquireEdit` or polls `edit-status` (FR-020 "Adding a new asset takes no lease"), in `src/clutch-web/src/features/assets/AssetPage.test.tsx`
- [X] T027 [US2] `AssetService.CreateAsync` (validate before DB work, asset + valuations + audit in one transaction, ids-only logs) in `src/Clutch.API/Application/Assets/AssetService.cs`
- [X] T028 [US2] POST `/api/assets` → 201 `AssetDetail` + Location in `src/Clutch.API/Api/Endpoints/AssetEndpoints.cs`
- [X] T029 [P] [US2] `createAsset` client (CSRF header, ProblemDetails field errors) with tests in `src/clutch-web/src/features/assets/api.ts`, `api.test.ts`
- [X] T030 [P] [US2] `assetDraft.ts` draft model and Zod rules mirroring FR-007/008/009 and contracts/assets-api.md "Validation" for every field, with value decimals limited by the selected currency's `minorUnits` (future date checked against `localToday()` imported from `features/mortgages/loanDraft.ts`; data-model.md ValuationDate) in `src/clutch-web/src/features/assets/assetDraft.ts`
- [X] T031 [US2] `AddValuationDialog` (`FormattedNumberField` imported from `features/mortgages/FormattedNumberField.tsx` with `decimals` from the asset currency (T014), Value formatted in that currency, Valuation Date, OK, Cancel) in `src/clutch-web/src/features/assets/AddValuationDialog.tsx`
- [X] T032 [US2] `AssetPage` new mode (floating-label Name/Description, Currency select as `AccountsPage` from `getCurrencies`, valuations table, Add Valuation, Save with pending state, Cancel, `setDirty`, toast, return to `/assets`, failure keeps draft) in `src/clutch-web/src/features/assets/AssetPage.tsx`, replacing the T016 stub

**Checkpoint**: US2 tests pass.

---

## Phase 5: User Story 3 - Edit An Asset (Priority: P2)

**Goal**: Edit name, description, currency and valuations under a 5-minute single edit lease (FR-012..014, FR-020) | **Independent Test**: Edit, add newer and delete older valuation, Save; list shows new Valuation and total.

- [X] T033 [P] [US3] Unit tests for `AssetEdit` transitions and effective expiry (an `Active` edit at or past `ExpiresAtUtc` counts as expired), including `EndedByUserId`/`EndedAtUtc` set only as data-model.md states, in `tests/Clutch.API.Tests/Unit/Assets/AssetEditTests.cs`; and for `AssetValuationDiff` (R7: added, removed, unchanged, unknown or foreign id reported as `valuations[i].id`) in `tests/Clutch.API.Tests/Unit/Assets/AssetValuationDiffTests.cs`
- [X] T034 [P] [US3] SqlServer + HTTP tests: save diff (R7), currency change stored and audited with old and new code, a currency change to JPY while a kept valuation has decimals returns 400 on that `valuations[i].value`, PUT 400 field keys for every rule in contracts/assets-api.md (`name`, `description`, `currencyCode`, `valuations`, `valuations[i].value`, `valuations[i].valuationDate`) returned before the edit is claimed (edit stays `Active`, nothing stored), unknown/foreign valuation id 400, all-or-nothing, `AssetUpdate` audit >500 chars stored in full, 404 `AssetNotFound` for a deleted asset and for another user's asset, in `tests/Clutch.API.Tests/Integration/Assets/AssetUpdateTests.cs`
- [X] T035 [P] [US3] SqlServer tests: one active edit under concurrent acquire, Save vs End race, stale End never ends newer edit, expiry frees lease and refuses late Save, status and Save on an expired edit write nothing (row still `Active`, no audit) while acquire persists `Expired`, release idempotent, release of an unexpired edit persists `Released` while release of an `Active` edit past `ExpiresAtUtc` persists `Expired` with `EndedAtUtc` set (never `Released`) and a repeat release changes nothing, status for an `editId` with no row returns `watchedEdit.state` `Unavailable`, acquire deletes terminal edits of that asset whose `COALESCE(EndedAtUtc, OpenedAtUtc)` is over 24 h old and keeps newer terminal edits (including an `Expired` persisted late by the same acquire, and `Saved`/`Released` edits opened under 24 h ago) and active edits (R4, data-model.md), audits (`AssetEditRejected` per refused acquire with the rejected user and active edit id, `AssetEditEnded` with the ender; no audit row for expiry), metrics (the expired-edit counter increments exactly once per edit, whether acquire or release persists `Expired`; acquire and end counters tagged with their outcome), in `tests/Clutch.API.Tests/Integration/Assets/AssetEditLeaseTests.cs`
- [X] T036 [P] [US3] HTTP tests: edit-status shapes (`activeEdit` is `{ id, expiresAtUtc }` with no `canEnd`, research R10), `Cache-Control: no-store`, edit-status 400 bad editId, DELETE `active-edit` without `editId` → 400 `AssetEditTargetRequired`, 404 foreign edit, 404 for another user's asset on POST `edits`, GET `edit-status` and DELETE `active-edit`, body over 64 KB on PUT rejected (413), CSRF on mutations in `tests/Clutch.API.Tests/Integration/Assets/AssetEditStatusTests.cs`
- [X] T037 [P] [US3] Toast tests: `showPersistent` has no timeout, own stack, Dismiss only, regular toasts render in the viewport above the persistent stack and never hide, replace, overlap or push it out in `src/clutch-web/src/components/ui/toast.test.tsx`
- [X] T038 [P] [US3] Component tests: loading indicator (`aria-busy`) within 500 ms while acquire is pending with no editable fields, edit mode load (including the asset's currency selected), valuations table Values formatted in the asset's currency and right aligned (`text-right`, `tabular-nums`, right-aligned Value header) and reformatted when Currency changes (FR-019), acquire network/5xx failure shows the error with Retry and Return To Assets, no editable fields and no release sent, blocked notice + End Other Edit (always shown while blocked, targeting `activeEdit.id`) with pending state within 500 ms, End Other Edit 409 `AssetEditChanged` refetches `edit-status` and either stays blocked targeting the new active edit or acquires when none is active (no error toast), End Other Edit network/5xx failure shows an error toast and stays Blocked with the button re-enabled, a failed status check while Blocked keeps it Blocked with "Retry Availability Check" and never enables editing (012 FR-014), a failed status check while editing keeps editing enabled and shows the retry, status `watchedEdit` `Saved`/`Released`/`Unavailable` for the held edit → `/assets` + "Your edit of {name} is no longer active." toast naming no user and with no release sent, auto-acquire, deleting the last valuation then Save shows "Add at least one valuation" and sends nothing, ended dialog latched, expiry → `/assets` + persistent toast with the exact text "Your edit of {name} expired." and a release sent, Save 404 `AssetNotFound` → `/assets` + "This asset no longer exists." toast without the discard prompt, acquire 404 (deleted, unknown or foreign asset) → `/assets` + the same toast with no release sent, Save 409 `AssetEditExpired` → expired flow, Save 409 `AssetEditEnded` → Edit Ended dialog naming the user, Save 409 `AssetEditChanged` → `/assets` + "Your edit of {name} is no longer active." toast without the discard prompt, Save network/5xx failure keeps edits, dirty-leave prompt, release on leave, `pagehide` sends the release with `keepalive: true`, in `src/clutch-web/src/features/assets/AssetPage.test.tsx`
- [X] T039 [P] [US3] Component tests: Edit Ended dialog (no Escape/outside close, names user, Return To Assets) in `src/clutch-web/src/features/assets/AssetEditEndedDialog.test.tsx`
- [X] T040 [P] [US3] Hook tests with fake timers: polls `edit-status` every 2 s only while focused and online, aborts a request after 2 s, revalidates on focus and on reconnect before reporting editable, reports `Ended`/`Available`/`Expired`/no-longer-active (`Saved`, `Released`, `Unavailable`) from the status, reports a failed or timed-out check as an error (not Available) and clears it on the next success, keeps editing disabled after reconnect or focus until one check succeeds, fires expiry from `expiresAtUtc` corrected by the `serverTimeUtc` offset with no poll, stops on unmount, in `src/clutch-web/src/features/assets/useAssetEditStatus.test.ts`
- [X] T041 [US3] `AssetEdit` transition methods, 5-minute lifetime and effective-expiry check in `src/Clutch.API/Domain/Assets/AssetEdit.cs`; `AssetValuationDiff` (R7) in `src/Clutch.API/Domain/Assets/AssetValuationDiff.cs`
- [X] T042 [US3] `AssetEditService` acquire/status/end/release with conditional `ExecuteUpdate`, effective expiry (acquire or release persists `Expired`; status never writes and returns `Unavailable` for an unknown `editId`), 24 h terminal cleanup by `COALESCE(EndedAtUtc, OpenedAtUtc)`, `AssetEditRejected`/`AssetEditEnded` audits and expired-edit metric (R3, R4) in `src/Clutch.API/Application/Assets/AssetEditService.cs`
- [X] T043 [US3] `AssetService.GetDetailAsync` (used by acquire for `EditLease.asset`; no GET endpoint) and `SaveAsync` (validate with `AssetValidator` before any DB work, then claim edit `Active`→`Saved` + `AssetValuationDiff` + audit in one transaction; an expired edit is refused without writing; 409 codes per contract) in `src/Clutch.API/Application/Assets/AssetService.cs`
- [X] T044 [US3] Endpoints: POST `edits`, GET `edit-status`, PUT `{id}`, DELETE `edits/{editId}`, DELETE `active-edit` in `src/Clutch.API/Api/Endpoints/AssetEndpoints.cs`; register `AssetEditService`
- [X] T045 [US3] Persistent toast stack with the regular viewport above it, and `showPersistent` (R5), in `src/clutch-web/src/components/ui/toast.tsx` (code first; the guidance follows in T058 after the browser state in T057, plan §10)
- [X] T046 [P] [US3] Lease and save clients (`acquireEdit`, `getEditStatus`, `saveAsset`, `releaseEdit` with a `keepalive` option, `endOtherEdit`) with tests (CSRF on mutations, 409 codes and `EditStatus` body parsed, 404 mapped, `keepalive: true` when requested) in `src/clutch-web/src/features/assets/api.ts`, `api.test.ts`
- [X] T047 [US3] `useAssetEditStatus` (2 s poll, 2 s bound, focus/reconnect revalidate, client expiry timer from `serverTimeUtc`) in `src/clutch-web/src/features/assets/useAssetEditStatus.ts`
- [X] T048 [P] [US3] `AssetEditEndedDialog` per contracts/assets-ui.md in `src/clutch-web/src/features/assets/AssetEditEndedDialog.tsx`
- [X] T049 [US3] `AssetPage` edit mode (acquire with loading indicator, acquire failure with Retry, blocked, status-check failure with "Retry Availability Check", End Other Edit pending and failure, End refused → refetch status, ended, expired, no longer active, valuations table formatted in the asset currency, asset gone on Save or acquire 404, Save 409 handling, valuation delete, Save, release on leave and on `pagehide`, Back/Forward dirty prompt) in `src/clutch-web/src/features/assets/AssetPage.tsx`

**Checkpoint**: US3 tests pass.

---

## Phase 6: User Story 4 - Delete An Asset (Priority: P2)

**Goal**: Delete an asset and its valuations after confirmation | **Independent Test**: Confirm delete; asset leaves list and total drops by its value.

- [X] T050 [P] [US4] SqlServer tests: cascade delete, `AssetDelete` audit listing the currency and the removed valuations, 409 `AssetEditActive` while an unexpired edit exists (nothing deleted, no audit row written, delete counter incremented with outcome `EditActive`), delete succeeds when the only edit is past `ExpiresAtUtc` but still marked `Active` (no reopen), 404 foreign, in `tests/Clutch.API.Tests/Integration/Assets/AssetDeleteTests.cs`
- [X] T051 [P] [US4] Component tests: dialog names asset, Delete/Cancel, Delete pending state within 500 ms with both buttons disabled, success toast + refetch, 409 explanation, network/5xx failure keeps the dialog open with an error and the list unchanged, in `src/clutch-web/src/features/assets/DeleteAssetDialog.test.tsx`; and the trash button has accessible name "Delete {name}" and opens the delete dialog without opening the asset, in `src/clutch-web/src/features/assets/AssetsPage.test.tsx`
- [X] T052 [US4] `AssetService.DeleteAsync` in `src/Clutch.API/Application/Assets/AssetService.cs` and DELETE `/api/assets/{id}` in `src/Clutch.API/Api/Endpoints/AssetEndpoints.cs`
- [X] T053 [P] [US4] `deleteAsset` client with tests (CSRF, 204, 409 `AssetEditActive`, 404) in `src/clutch-web/src/features/assets/api.ts`, `src/clutch-web/src/features/assets/api.test.ts`
- [X] T054 [US4] `DeleteAssetDialog` (names the asset, Delete/Cancel, pending state, 409 explanation, failure keeps the dialog open) in `src/clutch-web/src/features/assets/DeleteAssetDialog.tsx`; trash button "Delete {name}" opening it in `src/clutch-web/src/features/assets/AssetsPage.tsx`

**Checkpoint**: US4 tests pass.

---

## Phase 7: Completion Gates

- [X] T055 [P] Mocked browser journeys per quickstart.md "assets.spec.ts" in `src/clutch-web/e2e/assets.spec.ts` (WEB-001), including the 100-asset list rendered within 2 s of selecting Assets (SC-002, client render; server query time is T017), per-currency total rows, and the dirty prompt on browser Back
- [X] T056 [P] Real-API two-session lease and expiry journey per quickstart.md in `src/clutch-web/e2e/asset-edit-lease.spec.ts` (WEB-001)
- [X] T057 [P] Persistent toast state (axe, focus, layout, both themes) in `src/clutch-web/e2e/style-guide.spec.ts` and snapshots (WEB-001 §10)
- [X] T058 Add the persistent toast variant to the toast line in `.claude/skills/clutch-ui-style/references/forms-components.md` and run `.\scripts\sync-agent-config.ps1 -From claude` (WEB-001: guidance updated in the same change, after the code (T045) and browser state (T057), plan §10)
- [X] T059 [P] Logging test: ids only, no names, descriptions or values, in `tests/Clutch.API.Tests/Integration/Assets/AssetLoggingTests.cs` (OPS-001, SEC-003)
- [X] T060 Independent query review of list, lease and save queries, including the list query plan for SC-002 (DOT-002, `clutch-data-access`)
- [X] T061 Migration review with rollback plan, including the drop/alter/recreate of `CK_Audit_NonBlankDescription` and confirmation that existing audit row contents are unchanged; audit append-only check (OPS-001, AUD-001, `clutch-data-access`)
- [X] T062 Independent security review of the full diff (SEC-001..004, `clutch-security-review`)
- [X] T063 Validate the plan's §11 UI compliance checklist in both themes (WEB-001, `clutch-ui-style`)
- [X] T064 Run quickstart.md commands and completion quality gates; record results (ENG-001, DOT-001)
- [X] T065 Run `/speckit-converge` and complete any tasks it appends before declaring the feature done (Workflow and Delivery Gates)

---

## Dependencies & Execution Order

- Setup → Foundational → US1 → US2 → US3 → US4 → Completion Gates.
- T010 needs T005, T006, T009. T012 needs T011. T016 needs T015. Backend story tasks need T010, T012; frontend story tasks need T013–T016.
- T022 replaces the stub `AssetsPage` and T032 the stub `AssetPage` from T016.
- US2 `AssetPage` (T032) is extended by US3 (T049); US3 and US4 share `AssetService.cs`, `AssetEndpoints.cs` and `api.ts`, so run them in order.
- T031 needs T014. T049 needs T045, T046, T047, T048. T054 needs T053 and extends T022.
- T058 needs T045 and T057.
- T065 runs last, after T064.

## Parallel Opportunities

- Foundational: T001–T004; T006–T008, T011, T013–T015.
- US1: T017, T018, T021. US2: T023–T026, T029, T030. US3: T033–T040, T046, T048. US4: T050, T051, T053.
- Gates: T055–T057, T059.

## Implementation Strategy

MVP = User Story 1 plus User Story 2 (both P1; a list with no way to add is empty). Deliver stories incrementally; each must pass its own tests before the next starts.

## Phase 8: Convergence

- [X] T066 Decide how a foreign-currency amount reads: US1/AC6 shows `US$2,000.00`, while the `formatCurrencyAmount` the plan requires shows `$2,000.00` in an Australian locale; amend the spec or the formatting per US1/AC6 (contradicts). Decided: the same as accounts and mortgages; spec amended, no code change
- [X] T067 Confirm that a valuation the chosen currency cannot hold is shown as entered rather than rounded with `value.toFixed(minorUnits)`, and amend the contract or the code per contracts/assets-ui.md "Asset page" (contradicts). Decided: a created asset's currency cannot change (Phase 9), so this arises only while adding, where the value stays as entered; contract amended
- [X] T068 Confirm that persistent toasts are also cleared when the sign-in ends (so an asset name is never shown to the next user, SEC-003), and amend the contract or the code per contracts/assets-ui.md "Toasts" (contradicts). Decided: sign-out clears them; spec and contract amended, no code change

## Phase 9: Fixed Asset Currency (User Direction 2026-11-27)

**Goal**: A created asset's currency cannot be changed (FR-007, FR-012, US3/AC1) | **Independent Test**: Open a saved asset: the currency is text with no control; a PUT naming another currency is a 400 on `currencyCode` and stores nothing.

- [X] T069 [P] SqlServer + HTTP test: a Save naming a different currency is a 400 `currencyCode` "The currency cannot be changed", stores nothing and leaves the edit active; replace the currency-change tests in `tests/Clutch.API.Tests/Integration/Assets/AssetUpdateTests.cs` and drop the old/new currency expectation from `tests/Clutch.API.Tests/Unit/Assets/AssetAuditTextTests.cs`
- [X] T070 [P] Component and browser tests: the edit page has no Currency control and shows "Currency: {name} ({code})"; adding still has the select, reformats on change and shows an unholdable value as entered, in `src/clutch-web/src/features/assets/AssetPage.test.tsx` and `src/clutch-web/e2e/assets.spec.ts`
- [X] T071 Refuse a changed currency: `Asset.Create` alone sets `CurrencyCode`, `AssetService.SaveAsync` returns the field error, and `AssetAuditText.Updated` drops the currency change, in `src/Clutch.API/Domain/Assets/` and `src/Clutch.API/Application/Assets/AssetService.cs`
- [X] T072 Show the currency as text on the edit page, keeping the select for a new asset, in `src/clutch-web/src/features/assets/AssetForm.tsx` and `AssetPage.tsx`
- [X] T073 Query review of the changed Save path (DOT-002), OWASP review of the change (SEC-001, SEC-004), UI compliance checklist (WEB-001) and quality gates for the covered code; record in `specs/029-asset-register/validation.md`
