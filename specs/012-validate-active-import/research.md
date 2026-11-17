# Research: Active Import Coordination

## 1. Reuse the authoritative account lease and state policy

**Decision**: Add a shared `ImportStateService` for owner-scoped state projection,
active/expiry classification and conditional transitions. Both preflight status and review
creation use that policy; acquisition remains a conditional update of
`Accounts.ActiveImportId`. A status GET performs no writes.

**Rationale**: `ImportReviewService.CreateAsync` currently checks the account's lease,
expires a stale review, then acquires the lease within a transaction.
`AccountImportLease.TryAcquireAsync` already updates only accounts with no lease.
Reusing these rules avoids a frontend-only interpretation of what "active" means.
An expired `Ready` review can be projected as nonblocking; creation must still conditionally
expire/delete it and release only its matching lease before acquiring a new one.

**Alternatives considered**: A separate frontend definition would drift from the server.
Treating a check as a reservation would change scope and still need atomic acquisition.
Making periodic GETs mutate expiry would unnecessarily combine observation and cleanup.

**Evidence**: `src/Clutch.API/Application/Imports/ImportReviewService.cs:23`,
`:74`, `:109`, `:311`; `src/Clutch.API/Infrastructure/Imports/AccountImportLease.cs:8`.

## 2. Make accepted confirmation a visible protected stage

**Decision**: Add `Processing`, a server-generated confirmation attempt identifier, and
processing-start time to the existing review. Commit a short, owner/lease/expiry-checked
conditional `Ready -> Processing` claim before preparing financial writes. The write
transaction must acquire a write lock through a guarded update of that same attempt before
loading/validating/writing staged rows, and hold it through commit or rollback.

**Rationale**: `ConfirmImportService` currently reads `Ready` under Serializable isolation
and deletes the review when done. There is no persisted in-progress state for another
session to display. `CancelReadyAsync` and `ExpireStaleReviewAsync` also assume every
non-Ready state is terminal and delete it; both assumptions must change together.
Conditional claim and ending transitions make one winner authoritative across API hosts.

**Failure handling**: Duplicate-confirmation-required is a rejected confirmation attempt,
not acceptance to import: return the same attempt from Processing to Ready, preserving the
updated warnings, and ask again. Other preparation/write failures roll back financial
writes and conditionally release/delete only that attempt. Never indiscriminately run
the old ready-only failure cancellation against a processing attempt or an ended header.
If commit acknowledgement is uncertain, re-query the exact attempt and lease under the
execution strategy before cleanup; do not claim zero imported rows without establishing
rollback. No new retry is allowed to insert transactions after the review was deleted.

**Alternatives considered**: A UI-only busy flag fails across sessions. A long uncommitted
state change makes status reads block and hides the protected stage. A new job queue or
distributed lock service is unnecessary for the existing synchronous import workflow.

**Evidence**: `src/Clutch.API/Application/Imports/ConfirmImportService.cs:21`, `:67`,
`:163`, `:207`; `src/Clutch.API/Application/Imports/ImportReviewService.cs:218`, `:311`;
`src/Clutch.API/Domain/Imports/ImportReview.cs:3`.

## 3. Recover abandoned processing claims without cancelling active writes

**Decision**: Use a fixed five-minute stale-claim threshold measured from the new
processing-start time, independent of preview expiry. Extend existing minute-batched
cleanup to conditionally remove abandoned Processing attempts and release their exact
lease. The guarded write transaction and recovery take the same review-row write lock
before touching the account lease; recheck state/attempt after waiting for a lock.

**Rationale**: Persisting Processing without recovery would lock an account indefinitely
after a crash. Recovery is not a user end-import action: it can win only before the
guarded write transaction begins or after that transaction rolls back. While writes are
in flight it waits for their lock; successful commit deletes the review, so recovery then
finds no matching attempt. A delayed worker must fail its guard if recovery won. Status
must never call a Processing review available merely because five minutes elapsed.

**Alternatives considered**: Preview expiry cannot safely expire Processing. Blindly
releasing old leases risks two active writers. Heartbeats, extra settings and a background
job system add complexity without improving this locked-transaction safety invariant.

**Evidence**: Existing batch scheduling and compare-and-update expiry in
`src/Clutch.API/Infrastructure/Imports/ImportReviewCleanupService.cs:13`, `:28`, `:76`;
review deletion and financial commit in
`src/Clutch.API/Application/Imports/ConfirmImportService.cs:207`.

## 4. Preserve operational ending state without changing the audit model

**Decision**: On external ending, leave a minimal `Cancelled` review header with
`EndedByUserId` and `EndedAtUtc`; clear staged rows and nullable mapping/schema fields.
Keep that header available while its account exists; normal preview cleanup must not
delete it. An account owner can query the specific watched review after another preview
replaces it. Existing successful confirmation, natural expiry and same-session cancellation
continue deleting temporary reviews. No new history browsing or acknowledgement store.

**Rationale**: Existing cancellation immediately deletes its review and rows; returning
404 cannot distinguish an external end or identify its actor. These fields are live
notification state for one known preview, not a second audit trail. The canonical event
is still appended to `Audit` in the same transaction. Feature 010 deliberately removed
account/review identifiers from Audit, so neither adding those columns back nor parsing
human-readable descriptions is appropriate.

**Alternatives considered**: Browser broadcasts/local storage miss other devices and
offline sessions. A new event/audit table violates the constitution. Five-minute tombstone
expiry would lose the required notice for a session returning after preview expiry.

**Evidence**: `src/Clutch.API/Application/Imports/ImportReviewService.cs:218`;
`src/Clutch.API/Domain/Audit/Audit.cs:3`;
`src/Clutch.API/Infrastructure/Imports/ImportAuditWriter.cs:8`;
`specs/010-unify-audit-events/data-model.md`.

## 5. Poll minimal status using existing server-state tooling

**Decision**: One account-status query, optionally watching the current review, every two
seconds while visible and not in a completed/acknowledged state. Force revalidation on
focus/reconnect and block actions during restoration until a fresh result arrives.
Use a bounded request timeout and no hidden retry chain for status. Errors are visible,
retain blocking, and offer Retry. Abort obsolete requests and prevent stale responses
from clearing a newer blocked/ended state.

**Rationale**: React Query already owns server state, and the five-second requirements do
not require a new push service. Query account and watched-review state together so a
replacement import cannot hide the previous preview's ended result. A successful
same-page create establishes ownership of the new review; do not misclassify that review
as a competing import during subsequent polls.

**Alternatives considered**: SSE/WebSockets introduce connection infrastructure. Polling
only after a failed upload violates early validation. A polling interval alone does not
prove the five-second requirement; real-browser checks must measure elapsed behavior.

**Evidence**: `src/clutch-web/src/features/imports/ImportPage.tsx:38`, `:129`;
`src/clutch-web/src/features/imports/api.ts:89`;
`src/clutch-web/src/lib/api/client.ts:31`.

## 6. Reuse identity, modal and navigation boundaries

**Decision**: Derive the ending actor from authenticated server identity and resolve its
existing Identity username for the owner-only status response. This application's username
is its sign-in email; show it only to that same authorized owner, as escaped text, never
in logs or telemetry. No identity API/profile redesign or client-supplied actor value.
Compose the existing controlled dialog without outside/Escape dismissal, then invalidate
account/transaction data and call the existing `onBack` on acknowledgement.

**Rationale**: There is no display-name field in `ApplicationUser`; inventing one would
expand scope. Both authorized sessions belong to the same owner. `App` already returns
from `ImportPage` to the selected account's `AccountDetails`. Theme preferences and the
existing dialog primitives already support the required appearance.

**Alternatives considered**: "Another user" alone fails actor identification. A raw opaque
user identifier is not recognizable. Device identification and shared account access are
not requested.

**Evidence**: `src/Clutch.API/Api/Security/SecurityEndpoints.cs:35`;
`src/Clutch.API/Infrastructure/Identity/ApplicationUser.cs:5`;
`src/clutch-web/src/components/ui/dialog.tsx:1`;
`src/clutch-web/src/App.tsx:180`;
`src/clutch-web/src/components/theme/ThemeProvider.tsx:11`;
`src/clutch-web/src/features/preferences/api.ts:9`.

## 7. Use production-provider races and a real-browser flow

**Decision**: Extend SQL Server integration tests for lock/claim races, migration, cleanup
and failed writes. Use focused component tests for status lifecycle and modal behavior;
add a dedicated real-API Playwright configuration following the existing ownership setup.
Two contexts sign in as the same owner; a third unrelated owner verifies isolation.

**Rationale**: Default browser tests include mocks and cannot prove shared persisted
state, CSRF, or SQL concurrency. Existing Testcontainers and real-API browser launch
scripts provide the required environment without new tooling.

**Alternatives considered**: In-memory persistence cannot verify SQL Server locks.
Manual two-tab verification is not a completion gate. Do not rely on externally supplied
signed-in state files to make the new journey executable.

**Evidence**: `tests/Clutch.API.Tests/Integration/Accounts/SqlServerFixture.cs`;
`src/clutch-web/playwright.ownership.config.ts:4`;
`src/clutch-web/e2e/start-test-api.mjs:15`;
`src/clutch-web/e2e/accounts-import.spec.ts:93`;
`src/clutch-web/package.json:11`.

## Research Completion

All technical decisions are resolved. No external service, library upgrade, or further
product clarification is required. Actual SQL/security review, migration execution and
behavioral measurements are implementation gates, not completed research experiments.
