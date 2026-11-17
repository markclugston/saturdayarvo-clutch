# Tasks: Validate Active Transaction Imports

**Input**: [Design documents](./plan.md) in `specs/011-validate-active-import/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md),
[research.md](./research.md), [data-model.md](./data-model.md),
[contract](./contracts/import-coordination.md), [quickstart.md](./quickstart.md),
and the project constitution.

**Tests**: Required by FR-017 and ENG-001. Use existing tools and projects; add focused
tests for changed behavior, not a new test framework. Write behavioral tests before
their implementation and verify the intended failure. Where a later story exercises
an already implemented shared primitive, retain the passing regression check rather
than manufacturing a failure.

**Test readiness is not completion**: `Tnnn (ready)` in the dependency table means
the tests are authored and their intended failure is demonstrated (or the existing
shared behavior is verified). This permits the implementing task to start while the
test task remains in progress and unchecked. Mark the test task complete only after
its assertions pass against the implementation. All other dependency edges require
completed, passing prerequisites. A task's "fail first" wording describes readiness,
never permission to mark a failing test task complete.

**Organization**: Setup, shared foundation, three independently verifiable user-story
increments in priority order, then cross-cutting acceptance gates. All tasks start
unchecked; this document does not claim implementation or test completion.

## Format: `[ID] [P?] [Story] Description`

- `[P]` identifies file-disjoint work that can run concurrently once its listed
  prerequisites are complete. It never overrides dependency edges.
- `[US1]`, `[US2]`, `[US3]` map to the specification's stories.
- Every task names its files, applicable constitutional requirements and completion
  condition. Paths are relative to the repository root.
- The dependency table below is authoritative; tasks without a dependency must not be
  assumed dependent merely because they appear later.
- Preserve unrelated work. Do not commit, publish, deploy, install packages, or stop
  another user's processes merely because a task mentions validation or rollout.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish executable checks without reinitializing the existing projects.

- [X] T001 Verify the SDK, Docker/Testcontainers, EF CLI, Playwright and isolated test-port prerequisites in `specs/011-validate-active-import/quickstart.md` against `tests/Clutch.API.Tests/Integration/Accounts/SqlServerFixture.cs` and `src/clutch-web/e2e/start-test-api.mjs`; correct only feature-guide discrepancies and record actual blockers in session output. Done when required checks can execute, or blockers are explicit and resolved before dependent test runs; restore dependencies only after a missing-dependency failure or manifest change. (ENG-001, OPS-001, SEC-002)
- [X] T002 [P] Add `src/clutch-web/playwright.active-import.config.ts` using the existing ownership configuration and `src/clutch-web/e2e/start-test-api.mjs`, selecting `e2e/active-import.spec.ts` with real API/SQL Server setup, ephemeral credentials and cleanup of only test-owned resources; do not silently reuse an unrelated service. Done when configuration loads and is ready to run the feature test once added, without depending on external signed-in storage files or introducing a runtime package. (ENG-001, OPS-001, SEC-002, WEB-001)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Make persisted state, confirmation, ordinary cancellation and cleanup safe
before exposing status or competing-session controls.

**Critical**: Complete this phase before any user-story implementation. It deliberately
contains the shared Processing claim/recovery changes: a preflight must not misclassify
an import already accepted for processing.

- [X] T003 Add behavioral transition tests in `tests/Clutch.API.Tests/Unit/Imports/ImportStateTests.cs` for protected Processing claims, rejected duplicate confirmation returning to Ready, externally ended metadata/staging removal and refusal of invalid transitions. Ready when the intended missing-behavior failure is demonstrated; remain in progress during T004. Done when the tests pass after T004, without substituting domain entities or testing trivial accessors. (ENG-001, DOT-001)
- [X] T004 Extend `src/Clutch.API/Domain/Imports/ImportReview.cs` with Processing claim/attempt transitions and minimal externally ended operational state, retaining existing row and duplicate-warning behavior; implement the following field constraints verbatim from `data-model.md`. Done when T003 passes and all transitions clear inapplicable metadata without clearing staged data before a protected attempt can use it. (ARC-001, DOT-001, AUD-001)

  Field constraints in this task's scope:
  - `Id`, `AccountId`, `ActingUserId`: "Existing identity/account/creating actor; owner is authorized through the account, not merely by knowing the review ID."
  - `State`: "Existing states plus `Processing`; preserve existing string storage and increase the allowed-state check constraint."
  - `CreatedAtUtc`, `ExpiresAtUtc`: "Existing preview validity; only Ready may expire through this timestamp. Preview lifetime remains five minutes."
  - `SchemaVersion`, `MappingJson`, `Rows`: "Existing staging; required for a usable Ready/Processing review, removed when ending. Mapping/schema are already nullable."
  - `DuplicateConfirmationRequired`: "Existing warning state; preserve duplicate detection and explicit reconfirmation behavior."
  - `ConfirmationAttemptId`: "New nullable GUID, generated by the server before the retried claim operation; required only in Processing. Guards retries, write ownership and failure/recovery cleanup."
  - `ProcessingStartedAtUtc`: "New nullable UTC timestamp, required only in Processing; independent of preview expiry."
  - `EndedByUserId`: "New nullable bounded user identifier (same 450-character limit as existing actor identifiers); paired with EndedAtUtc only for externally ended Cancelled headers."
  - `EndedAtUtc`: "New nullable UTC timestamp; distinguishes external ending from same-session cancellation or expiry."

- [X] T005 Map T004 in `src/Clutch.API/Infrastructure/Persistence/AppDbContext.cs`, generate the EF migration named `ActiveImportCoordination` in `src/Clutch.API/Infrastructure/Persistence/Migrations/`, and update `src/Clutch.API/Infrastructure/Persistence/Migrations/AppDbContextModelSnapshot.cs`. Preserve nullable field/450-character constraints quoted in T004; implement "Add check constraints for paired processing fields, paired ending fields and their allowed states, while allowing pre-migration legacy terminal rows." Preserve the account FK, staged-row cascade, primary key, `(AccountId, State)`, expiry and unique filtered account-lease indexes; add the filtered `(ProcessingStartedAtUtc, Id)` Processing-cleanup index. Done when the generated migration is additive, changes no Audit schema/rows, requires no old-row rewrite, and supports all valid/invalid stored shapes in `data-model.md`. (DOT-001, DOT-002, AUD-001, OPS-001)
- [X] T006 [P] Add `tests/Clutch.API.Tests/Integration/Persistence/ImportCoordinationMigrationTests.cs` using disposable SQL Server to upgrade a populated previous schema and exercise the new field/state constraints. Done when Ready previews, mappings, account leases, saved settings, balances and Audit records survive upgrade, invalid metadata/state pairs are rejected, and existing Audit update/delete guards remain effective; no in-memory substitute for provider behavior. (DOT-002, AUD-001, ENG-001, OPS-001)
- [X] T007 [P] Implement `src/Clutch.API/Application/Imports/ImportStateService.cs` and register it in `src/Clutch.API/Infrastructure/DependencyInjection.cs`: shared owner-scoped active/expiry classification, typed coordination outcomes, minimal active/watched projections and conditional-transition helpers. Ready at expiry is nonblocking, Processing is always blocking, a dangling lease is Blocked/Unknown with sanitized diagnostics, and watched ended headers resolve the authenticated ending user's Identity username without CSV data. Done when create/status share one authoritative policy, reads are no-tracking and bounded, watched-review/account ownership is checked, and no new audit table or identity API is introduced. (ARC-001, DOT-001, DOT-002, SEC-001, SEC-003)
- [X] T008 [P] Refactor `src/Clutch.API/Application/Imports/ConfirmImportService.cs` to commit an owner/lease/expiry-checked Ready-to-Processing claim before preparation, generating its attempt GUID before execution-strategy retries; acquire a conditional write lock on that same attempt before financial reads/writes and hold it through commit/rollback. Preserve duplicate reconfirmation by rejecting that attempt back to Ready with warnings, atomically preserve successful transaction/settings/account updates, and conditionally finalize only a known failed attempt after rollback. Done when a winning claim cannot be externally ended, stale tracked state cannot overwrite transitions, retries cannot duplicate inserts, and uncertain commits are verified or explicitly reported as `ImportOutcomeUnknown`, never as unproven zero imports. (DOT-001, DOT-002, AUD-001, ENG-001, SEC-003)
- [X] T009 [P] Integrate the shared policy and exact-lease guards into create, ordinary cancellation, failure cleanup and stale-review handling in `src/Clutch.API/Application/Imports/ImportReviewService.cs`, `src/Clutch.API/Infrastructure/Imports/AccountImportLease.cs` and `src/Clutch.API/Infrastructure/Imports/ImportReviewCleanupService.cs`. Replace every non-Ready-means-terminal assumption; never delete externally ended headers, release a dangling lease speculatively, or expire Processing by preview lifetime. Extend existing minute-batched cleanup to recover claims stale for five minutes using review-then-account locking and exact attempt rechecks after waiting. Done when a recovery winner prevents a delayed writer, active write transactions cannot be interrupted, Ready expiry still works and failure cleanup cannot erase a retained ending notice. (DOT-001, DOT-002, AUD-001, OPS-001, SEC-003)
- [X] T010 Extend `tests/Clutch.API.Tests/Integration/Imports/ImportWorkflowTests.cs` with deterministic SQL Server barriers/interceptors and independent request scopes for committed Processing visibility before writes, rejected duplicate confirmation, failed writes/settings save, retry/unknown-commit handling, preview expiry versus Processing, abandoned-claim recovery versus a delayed writer, and recovery blocked behind a live financial transaction. Done when tests demonstrate exact-attempt cleanup and no partial/duplicate financial writes; use injected TimeProvider for stale thresholds and no production pause endpoint or sleep-only concurrency proof. (DOT-002, AUD-001, ENG-001, OPS-001, SEC-003)
- [X] T011 Run the focused backend foundation selectors from `specs/011-validate-active-import/quickstart.md` against `tests/Clutch.API.Tests/Clutch.API.Tests.csproj`, including `ImportStateTests`, `ImportWorkflowTests` and `ImportCoordinationMigrationTests`; correct any changed-code failures in the files covered by T003-T010. Done when every named group executes a nonzero number of tests and passes, including migration/rollback/cleanup invariants; do not treat unavailable Docker or unmatched selectors as a pass. (DOT-001, DOT-002, AUD-001, ENG-001, OPS-001)

**Checkpoint**: The expanded state model is safe across all existing mutation/cleanup
paths. No new competing-session action is exposed yet.

---

## Phase 3: User Story 1 - Detect a Competing Import Before Starting (Priority: P1) - MVP

**Goal**: Validate on entry before CSV submission, keep unknown/active accounts blocked,
and refresh availability automatically without submitting an import.

**Independent Test**: With no import, a Ready preview, a Processing claim, a different
account's import and failed/pending status reads, open the import screen before choosing
a file. Assert correct gating. Complete, expire or cancel the blocker and verify
availability within five seconds in a connected foreground screen, with zero automatic
create calls.

### Tests for User Story 1

- [X] T012 [P] [US1] Add owner-authorized GET contract tests in `tests/Clutch.API.Tests/Integration/Imports/ImportStatusTests.cs` for Available, Preview, Processing, Unknown dangling lease, expired Ready, optional watched states, inaccessible/cross-account review IDs, malformed IDs and read-only/no-store responses. Done when tests validate exact response discriminants/nullability, actor privacy and zero staged-row disclosure or GET writes, failing first for the absent route. (FR-001, FR-002, FR-003, FR-013; DOT-002, ENG-001, SEC-001, SEC-003)
- [X] T013 [P] [US1] Extend `src/clutch-web/src/features/imports/ImportPage.test.tsx` with preflight checking/error/Retry states, disabled create before availability, account-scoped conflicts, same-screen own-review recognition, stale-create conflict refresh, focus/reconnect gating, successful waiting-screen clearance and replacement-blocker changes. Done when assertions use accessible roles/names, verify zero automatic submissions, and expose the missing early validation before implementation. (FR-001, FR-003, FR-014, FR-018; ENG-001, WEB-001; SC-001, SC-006, SC-007)
- [X] T014 [P] [US1] Extend `src/clutch-web/src/features/imports/api.test.ts` with status request/AbortSignal handling and runtime-contract cases covering every active/watched discriminator, required UUID/timestamp/nonblank actor fields, inconsistent Available/activeImport combinations, invalid shapes and explicit ProblemDetails/timeout failures. Done when invalid boundary values fail closed rather than becoming Available. (FR-002, FR-013, FR-014; ENG-001, SEC-001, WEB-001)

### Implementation for User Story 1

- [X] T015 [P] [US1] Add GET `/api/accounts/{accountId}/import-status` with optional watched `reviewId` in `src/Clutch.API/Api/Endpoints/ImportEndpoints.cs`, using `ImportStateService` and existing authentication/error middleware. Done when T012 passes with `Cache-Control: no-store`, the exact documented status/ownership errors, no expiry mutation on GET, bounded consistency rechecks and no protected import data in responses/diagnostics. (FR-001, FR-002, FR-003, FR-013; ARC-001, DOT-001, DOT-002, SEC-001, SEC-003)
- [X] T016 [P] [US1] Add discriminated status schemas/types to `src/clutch-web/src/lib/api/schemas.ts` and a status reader to `src/clutch-web/src/features/imports/api.ts`, reusing the existing API client and optional AbortSignal support. Done when T014 passes, Available/null and blocked-stage invariants are enforced, identity/UUID/date values are validated at runtime and strict typing needs no `any` or unchecked cast. (FR-002, FR-013, FR-014; SEC-001, WEB-001)
- [X] T017 [US1] Add `src/clutch-web/src/features/imports/useImportStatus.ts` around React Query, keyed by account and watched-review ID with existing signed-in-session cache isolation; poll visible active screens every two seconds, bound status reads to two seconds, disable hidden retry chains and refetch on focus/reconnect. Done when obsolete requests abort, stale responses cannot overwrite a newer state, restoration requires a fresh check and explicit error/Retry remains observable without ad hoc effect-based fetching or duplicated derived state. (FR-003, FR-011, FR-014, FR-018; ENG-001, SEC-002, WEB-001)
- [X] T018 [US1] Integrate preflight and shared query state into `src/clutch-web/src/features/imports/ImportPage.tsx`: gate file-start actions on confirmed availability, distinguish its own Ready preview, gate review actions during restoration, handle server start conflicts by rechecking and remove the old blind account-only discard offer until exact-target recovery is implemented. Done when T013 passes, existing CSV/mapping/saved-settings/duplicate flows remain usable and unknown/error/Processing states never allow a new start; loading feedback uses existing semantic tokens and accessible button controls. (FR-001, FR-003, FR-013, FR-014, FR-015, FR-016, FR-018; ENG-001, WEB-001)
- [X] T019 [US1] Add `src/clutch-web/e2e/active-import.spec.ts` with real-API two-context same-owner preflight scenarios and unrelated-owner isolation, plus foreground waiting-screen clearance after completion/cancellation and real elapsed feedback/availability measurements. Cover expiry-driven clearance with deterministic server-time integration plus browser scheduling checks, or an executable real expiry case; do not claim fake time proves wall-clock timing. Done when early blocking requires no file submission, feedback is within 500 ms, foreground clearance is within five seconds and no create call is made automatically. (FR-001, FR-013, FR-014, FR-017, FR-018; ENG-001, SEC-001, SEC-002, WEB-001; SC-001, SC-005, SC-006, SC-007)
- [X] T020 [US1] Run T012-T019's focused API/component/API-client checks and the US1 cases in `src/clutch-web/e2e/active-import.spec.ts` through `src/clutch-web/playwright.active-import.config.ts`, using `specs/011-validate-active-import/quickstart.md`; resolve changed-code failures. Done when real-backend and measured-threshold checks pass with nonzero matched cases, including no active import, Ready, protected Processing, validation failure and automatic-clearance scenarios. (FR-017; DOT-002, ENG-001, WEB-001; SC-001, SC-005, SC-006, SC-007)

**Checkpoint**: US1 is independently executable and demonstrates the MVP. Externally
ending another preview and its modal remain the next increments, not implied completion.

---

## Phase 4: User Story 2 - End an Eligible Competing Import (Priority: P2)

**Goal**: Let the owner end exactly the preview shown, never a protected or replacement
import, then revalidate before starting a replacement.

**Independent Test**: Seed a preview through normal creation, end its exact ID from
another session and assert staging removal, retained ending state, lease release and
zero imported rows. Repeat with Processing, stale IDs, concurrent ending/confirmation
and failed ending; all protected/replacement data remains unchanged.

### Tests for User Story 2

- [X] T021 [P] [US2] Add `tests/Clutch.API.Tests/Integration/Imports/ImportEndingTests.cs` for required-target 400s, CSRF/owner checks, exact Ready ending, atomic audit/staging/lease updates, repeated-ended-target 204 without duplicate events, disappeared/stale target conflicts and a replacement import left untouched. Include deterministic both-orderings end-versus-confirm races and concurrent starts using the T010 barrier pattern. Done when failures identify the unsafe/missing exact-target behavior and final tests prove at most one winner, no processing import ended and zero transactions from an ended preview. (FR-004, FR-005, FR-006, FR-007, FR-012, FR-013; DOT-002, AUD-001, ENG-001, SEC-001; SC-002, SC-003)
- [X] T022 [P] [US2] Extend `src/clutch-web/src/features/imports/api.test.ts` and `src/clutch-web/src/features/imports/ImportPage.test.tsx` for required exact review IDs, Preview-only end controls, Processing/Unknown refusal, busy/error handling, post-204 revalidation, newer blockers and malformed-201 creation recovery using validated Location only. Done when tests fail for missing recovery UX and prohibit blind account-only cancellation, fabricated success and auto-submission. (FR-004, FR-005, FR-006, FR-014; ENG-001, SEC-001, WEB-001)

### Implementation for User Story 2

- [X] T023 [P] [US2] Implement exact-target external ending in `src/Clutch.API/Application/Imports/ImportReviewService.cs` and strengthen DELETE `/api/accounts/{accountId}/active-import-review?reviewId=...` in `src/Clutch.API/Api/Endpoints/ImportEndpoints.cs`; use shared review-then-account conditional guards, authenticated actor and the existing `src/Clutch.API/Infrastructure/Imports/ImportAuditWriter.cs`. Atomically retain the externally ended Cancelled header, clear staging/mapping/schema and processing fields, release only its matching lease and append `ReviewEndedElsewhere` to existing Audit. Done when T021 passes, repeats are idempotent and all documented 400/404/409 outcomes are explicit without changing Audit schema or erasing an earlier notice. (FR-004, FR-005, FR-006, FR-007, FR-012, FR-013; DOT-001, DOT-002, AUD-001, SEC-001, SEC-003)
- [X] T024 [P] [US2] Update `src/clutch-web/src/features/imports/api.ts` and `src/clutch-web/src/features/imports/ImportPage.tsx` to submit the exact observed review ID, offer end only for a competing Preview with canEnd true, disable concurrent actions and invalidate/refetch status after success/conflict/uncertain outcomes. Preserve malformed-201 cleanup of the exact validated Location review; with no usable ID, check status before offering recovery. Done when T022 passes, 204 never optimistically unlocks a newer conflict and a Processing/Unknown import never receives an end offer. (FR-004, FR-005, FR-006, FR-014; ENG-001, SEC-001, WEB-001)
- [X] T025 [US2] Extend `src/clutch-web/e2e/active-import.spec.ts` with the real-backend exact-target recovery journey: session B ends A's preview, cannot confirm that ended ID, and starts a replacement without leaving; verify protected/stale/replacement refusals through API tests and observable conflict UI. Done when lease/staging/transaction assertions and current-session readiness are verified without requiring the still-unbuilt US3 modal. (FR-004, FR-005, FR-006, FR-007, FR-017; DOT-002, ENG-001, WEB-001; SC-002, SC-003)
- [X] T026 [US2] Execute the ending, foundation-race, client/component and US2 browser selectors in `tests/Clutch.API.Tests/Integration/Imports/ImportEndingTests.cs`, `tests/Clutch.API.Tests/Integration/Imports/ImportWorkflowTests.cs` and `src/clutch-web/e2e/active-import.spec.ts`; fix changed-code failures and repeat affected checks. Done when exact-target idempotency, confirmation winner protection, failed-operation blocking and same-screen replacement readiness all pass without unrelated test skips. (FR-017; DOT-002, AUD-001, ENG-001, WEB-001; SC-002, SC-003, SC-006)

**Checkpoint**: Exact-target recovery works independently. Retained headers support
notification, but US3 must finish before the complete cross-session UX is accepted.

---

## Phase 5: User Story 3 - Acknowledge an Import Ended Elsewhere (Priority: P2)

**Goal**: Automatically block the affected preview with an actor-identifying modal and
return to that account's refreshed transactions only after explicit acknowledgement.

**Independent Test**: In two automated same-owner browser contexts, end A's preview from
B. Assert A's modal within five seconds, correct ending username, inert background,
focus containment and acknowledgement-only dismissal/navigation. Repeat after restoring
connectivity/foreground activity, including a replacement active import.

### Tests for User Story 3

- [X] T027 [P] [US3] Add `tests/Clutch.API.Tests/Integration/Imports/ImportNotificationTests.cs` verifying watched Ended identity/time after staging removal, ordinary cleanup and replacement creation, including checks after the old preview expiry. Distinguish same-session cancellation/expiry/unknown missing review from Ended, reject unrelated/cross-account access and surface identity-resolution failure explicitly. Done when retained operational headers remain sufficient without Audit lookup/parsing, another audit table, history browsing or sensitive diagnostics. (FR-008, FR-009, FR-011, FR-012, FR-013; DOT-002, AUD-001, ENG-001, SEC-001, SEC-003)
- [X] T028 [P] [US3] Add `src/clutch-web/src/features/imports/ImportEndedDialog.test.tsx` for named/described actor text, initial focus, focus containment, blocked outside/Escape dismissal and exactly one explicit acknowledgement callback. Ready when the missing-modal failure is demonstrated; done when assertions pass after T030 using accessible roles/names, escaped actor text and Light/Dark rendering rather than generated component internals. (FR-009, FR-010, FR-015, FR-016; ENG-001, SEC-001, WEB-001)
- [X] T029 [P] [US3] Extend `src/clutch-web/src/features/imports/ImportPage.test.tsx` for watched Ended precedence over replacement status, late response protection, polling stop after ending, restored-session gating, server `ImportEndedElsewhere`, expired/unavailable distinction and acknowledgement query invalidation/account-return behavior. For Expired/Unavailable, assert a non-attributed explanation, disabled preview mutations and a Return to transactions button that leaves without a cancel request. Ready when missing integration is demonstrated; done when assertions pass after T031, never enable underlying actions during a fresh-state check and never attribute natural expiry or own cancellation to another session. (FR-008, FR-010, FR-011, FR-012, FR-014; ENG-001, WEB-001)

### Implementation for User Story 3

- [X] T030 [US3] Compose `src/clutch-web/src/features/imports/ImportEndedDialog.tsx` from `src/clutch-web/src/components/ui/dialog.tsx` without editing generated primitives: controlled modal, "Import ended" title, explicit username/other-session explanation, focus trapping and one acknowledgement button with pointer cursor; prohibit Escape/outside dismissal. Done when T028 passes and keyboard/narrow-screen/light/dark presentation uses semantic tokens and existing theme behavior. (FR-009, FR-010, FR-015, FR-016; ENG-001, SEC-001, WEB-001)
- [X] T031 [US3] Integrate watched Ended handling into `src/clutch-web/src/features/imports/useImportStatus.ts` and `src/clutch-web/src/features/imports/ImportPage.tsx`, preserving the ended review's notification against stale responses and replacement imports, stopping its polling and revalidating before actions on reconnect/foreground restoration. Treat `ImportEndedElsewhere` as a watched-status refresh, not a new confirmation attempt; on acknowledgement invalidate relevant account/transaction queries then use existing `onBack` to return to the same account. For Expired/Unavailable, show a non-attributed explanation, disable preview mutations and provide Return to transactions through the same invalidation/onBack path without cancelling a missing preview; keep transport errors on the explicit Retry path. Done when T029 passes and neither optimistic/error state nor a restored screen can expose usable ended-review controls; do not add preview-resumption storage or change `src/clutch-web/src/App.tsx` navigation unnecessarily. (FR-008, FR-010, FR-011, FR-012, FR-014; ENG-001, SEC-002, WEB-001)
- [X] T032 [US3] Extend `src/clutch-web/e2e/active-import.spec.ts` with the real-backend full ending-notification-acknowledgement journey and restored-session/replacement variants; measure at most five seconds from successful end to foreground modal, and verify exact actor, correct account destination, inert background, focus, Escape/outside resistance and keyboard acknowledgement. Exercise responsive Light/Dark and System-following behavior through existing preferences without changing persistence; include automated accessibility checks using existing tools. Done when the required outcome is measured, not inferred from a two-second timer or fake clock alone. (FR-008, FR-009, FR-010, FR-011, FR-015, FR-016, FR-017; ENG-001, SEC-001, WEB-001; SC-004, SC-005, SC-006)
- [X] T033 [US3] Run the notification API, dialog/component and complete real-backend feature-browser checks covering `tests/Clutch.API.Tests/Integration/Imports/ImportNotificationTests.cs`, `src/clutch-web/src/features/imports/ImportEndedDialog.test.tsx` and `src/clutch-web/e2e/active-import.spec.ts`; resolve changed-code failures. Done when connected and restored flows, actor identity, acknowledgement destination, account isolation and keyboard/appearance assertions all pass, with no human confirmation gate. (FR-017; DOT-002, ENG-001, WEB-001; SC-004, SC-005, SC-006)

**Checkpoint**: All three stories are independently verified and the complete feature
journey works. The cross-cutting reviews and release gates below are still mandatory.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finish observability, deployment documentation, independent reviews and
agent-executable acceptance. No unrelated refactoring or speculative tuning.

- [X] T034 Extend `src/Clutch.API/Application/Imports/ImportMetrics.cs` and the changed coordination call sites with status/end/claim outcomes, failures and durations, plus focused assertions in `tests/Clutch.API.Tests/Unit/Imports/ImportMetricsTests.cs`. Done when existing successful transaction count/per-minute instruments still work, labels use bounded operation/outcome values only, no account/review/user/username/CSV payload leaks and health checks remain unchanged. (FR-014; ARC-001, ENG-001, OPS-001, SEC-003; Constitution VIII)
- [X] T035 [P] Finalize `specs/011-validate-active-import/quickstart.md` and directly related import guidance in `README.md` for implemented test selectors/configuration, prerequisite failures, maintenance/draining before the additive migration, backend-before-frontend rollout, old-client required-target errors and forward recovery. Done when documented commands match actual nonzero test groups, no old backend/cleanup worker is allowed alongside Processing rows, and rollback instructions preserve ended metadata and immutable Audit without claiming a deployment occurred. (FR-017; DOT-002, AUD-001, ENG-001, OPS-001)
- [X] T036 [P] Obtain a second independent agent review of generated SQL/migration and affected EF operations in `src/Clutch.API/Application/Imports/`, `src/Clutch.API/Infrastructure/Imports/` and `src/Clutch.API/Infrastructure/Persistence/Migrations/`; include status projections, claim/end/recovery write-lock order, attempt guards, index use, bounded reads, unnecessary round trips and upgrade/data-loss behavior. Done when every material finding is fixed and its targeted SQL Server check rerun; report review evidence in session output, not a new repository notes file. (DOT-002, AUD-001, ENG-001, OPS-001)
- [X] T037 [P] Obtain an independent OWASP Top 10 review of changed `src/Clutch.API/Api/Endpoints/ImportEndpoints.cs`, coordination/identity boundaries and `src/clutch-web/src/features/imports/`; run `npm audit` and .NET vulnerable/transitive-package checks for `src/Clutch.API/Clutch.API.csproj` and `tests/Clutch.API.Tests/Clutch.API.Tests.csproj` as documented in `specs/011-validate-active-import/quickstart.md`. Done when authorization/CSRF, actor disclosure, escaped output, cache isolation, secret handling and dependency findings are remediated and verified; unavailable scanners or unresolved findings block acceptance. (SEC-001, SEC-002, SEC-003, ENG-001, WEB-001)
- [X] T038 Execute all applicable release gates in `specs/011-validate-active-import/quickstart.md`: .NET solution build and backend tests, frontend typecheck (`tsc --noEmit`), zero-warning lint, unit/component tests, production build, default browser suite and dedicated real-backend active-import suite, plus `git --no-pager diff --check`. Done when all required commands pass with nonzero feature matches, SC-001 through SC-007 have measured/asserted evidence and findings/fixes from T036-T037 have rerun coverage; clean up only exact test-owned temporary resources and report any blocker instead of waiving a gate. (FR-017; DOT-001, DOT-002, AUD-001, ENG-001, OPS-001, WEB-001; Constitution VII/VIII)
- [X] T039 Reconcile implementation evidence against `specs/011-validate-active-import/spec.md`, `specs/011-validate-active-import/plan.md` and this `specs/011-validate-active-import/tasks.md`, and run `/speckit-converge` before claiming the feature complete. Done when every selected story, FR-001 through FR-018 and SC-001 through SC-007 is covered, checkbox completion reflects actual successful checks/reviews, and any newly discovered gap is an explicit actionable task rather than a silent waiver or manual-test request. (ENG-001, OPS-001; all applicable plan Constitution Check requirements)

---

## Dependencies & Execution Order

### Phase and Story Graph

```text
T001 --------------------> Foundation T003-T011
T002 -----------------------------------------> US1 real-browser test T019
Foundation --------------> US1 (P1; T012-T020)
US1 ---------------------> US2 (P2; T021-T026)
US2 ---------------------> US3 (P2; T027-T033)
US1 + US2 + US3 ----------> T034 observability
T034 --------------------> T035 docs + T036 SQL review + T037 security review/scans
T035 + T036 + T037 -------> T038 release gates -> T039 convergence
```

US2 uses US1's status/query/UI to present the exact target. US3 uses the same query and
US2's persisted ended state. These are actual integration dependencies, not implied
independence. Each story can still be tested in isolation using established fixtures;
shared files must not be edited concurrently. Do not ship US2 as the complete feature
before US3's notification flow is ready.

### Task Prerequisites

Every listed edge is an actual prerequisite. `(ready)` edges require the test-readiness
milestone defined above, not a checked task; unqualified edges require passing completion.
Transitive prerequisites are inherited at the indicated milestone. `none` means no
prerequisites. Test and implementation tasks may finish together after their checks pass.

| Task | Depends on |
|---|---|
| T001 | none |
| T002 | none |
| T003 | T001 |
| T004 | T003 (ready) |
| T005 | T004 |
| T006 | T005 |
| T007 | T005 |
| T008 | T007 |
| T009 | T007 |
| T010 | T008, T009 |
| T011 | T003, T006, T010 |
| T012 | T011 |
| T013 | T011 |
| T014 | T011 |
| T015 | T012 (ready) |
| T016 | T014 (ready) |
| T017 | T013 (ready), T016 |
| T018 | T015, T017 |
| T019 | T002, T018 |
| T020 | T012, T013, T014, T019 |
| T021 | T020 |
| T022 | T020 |
| T023 | T021 (ready) |
| T024 | T022 (ready) |
| T025 | T023, T024 |
| T026 | T021, T022, T025 |
| T027 | T026 |
| T028 | T026 |
| T029 | T026 |
| T030 | T028 (ready) |
| T031 | T027, T029 (ready), T030 |
| T032 | T031 |
| T033 | T028, T029, T032 |
| T034 | T033 |
| T035 | T034 |
| T036 | T034 |
| T037 | T034 |
| T038 | T035, T036, T037 |
| T039 | T038 |

### Parallel Opportunities

- T001 and T002 inspect/setup different artifacts.
- After T005, T006 migration tests and T007 shared coordination service are disjoint.
- After T007, T008 confirmation and T009 create/cancel/cleanup integration can proceed
  together against that stable service contract.
- After each story's prerequisites, its API and frontend tests are file-disjoint.
- Backend/frontend implementations T015/T016 and T023/T024 can proceed independently
  against the approved contract once their respective tests exist.
- T035 documentation, T036 read-only SQL review and T037 read-only security review/scans
  can run together after all behavior/telemetry changes. Serialize any resulting fixes
  that touch the same source; rerun affected reviews/checks on those fixes.

## Parallel Example: User Story 1

After T011, run T012 (`ImportStatusTests.cs`), T013 (`ImportPage.test.tsx`) and T014
(`api.test.ts`) concurrently. Once their test-readiness milestones are met, T015's route
and T016's schemas/client can be implemented independently. T017-T020 then integrate
and verify the slice in dependency order.

## Parallel Example: User Story 2

After T020, run T021 (`ImportEndingTests.cs`) and T022 (frontend API/page tests) together.
T023's backend ending and T024's frontend exact-target recovery have no shared files;
integrate them in T025 only after both are complete.

## Parallel Example: User Story 3

After T026, run T027 (`ImportNotificationTests.cs`), T028 (`ImportEndedDialog.test.tsx`)
and T029 (`ImportPage.test.tsx`) together. T030 may implement the separate dialog once
T028 reaches readiness, while other test authoring finishes; T031 must wait for all its listed
prerequisites before editing the shared page/hook.

## Implementation Strategy

### MVP First

1. Complete setup and the protected-state foundation.
2. Complete US1 and its independent checks: early blocking, fail-closed validation and
   automatic availability refresh are the suggested MVP.
3. If stopping at the MVP, run the applicable observability, documentation, independent
   reviews and release gates for that slice before calling it releasable. Clearly
   identify US2/US3 as unbuilt, and do not claim whole-feature convergence.

### Incremental Delivery

1. US1 establishes safe status and existing-workflow preservation.
2. US2 adds exact-target recovery and durable operational ended state.
3. US3 adds the actor-identifying acknowledgement flow and complete cross-session UX.
4. Finish T034-T039 before declaring the entire feature implemented.

### Completion Discipline

- Do not mark a test-authoring task complete merely because files exist: verify the
  intended behavioral failure to reach readiness, leave it in progress while implementing,
  then verify the passing result before checking off either task. Story/foundation
  checkpoints require all their test tasks to be complete, not merely ready.
- No stage replaces authoritative server checks with a client prediction.
- No gate requires human manual testing; unavailable executable checks remain blockers.
- These tasks do not request Git commits or deployment; preserve the current worktree
  and only perform user-authorized repository operations.

## Phase 7: Convergence

- [X] T040 Move the watched-Processing explanation in `src/clutch-web/src/features/imports/ImportPage.tsx` outside the competing-import-only branch and add a focused case in `src/clutch-web/src/features/imports/ImportPage.test.tsx`; verify that a restored protected preview explains its disabled actions, offers no end control and never starts another import. Done when the focused regression, frontend typecheck/lint/tests/build and affected independent security review pass. per FR-014, T018 (partial)
