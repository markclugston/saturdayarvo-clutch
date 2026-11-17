# Validation Guide: Active Import Coordination

## Scope and Status

The feature-specific tests and dedicated browser configuration below are implemented.
Use these checks for regression verification; task checkboxes record completed gates,
not a claim that the feature has been deployed.

See [contract](./contracts/import-coordination.md) for requests/response shapes and
[data model](./data-model.md) for locking, retained headers and deployment rules.
No manual testing, participant study, or human confirmation is a release gate.

## Prerequisites

- Run commands from the repository root unless a working-directory change is shown.
- Existing .NET 10 SDK, Node/npm, Docker with Linux containers, SQL Server 2022 container
  support, EF CLI, Playwright Chromium, and an exportable development HTTPS certificate.
- Restore/install dependencies only if the validation command reports them missing or
  implementation changes the corresponding manifests. Use the existing lockfiles.
- Testcontainers must be able to start a disposable SQL Server. Browser real-API setup
  uses `e2e/start-test-api.mjs`, which provisions SQL Server, exports the dev certificate,
  migrates and launches the API; no production database or pre-existing login is needed.
- The dedicated active-import runner chooses free loopback ports and unique container/
  certificate names. It never reuses a running server. The default browser suite uses
  port 5173 and expects an API at the configured Vite proxy target (7180 by default);
  verify these are your own services, not another worktree's. For isolated default-suite
  runs, set `CLUTCH_E2E_WEB_PORT`, `PLAYWRIGHT_BASE_URL` and `VITE_API_PROXY_TARGET`.
  The existing API helper accepts `CLUTCH_E2E_API_PORT` and a unique
  `CLUTCH_E2E_RESOURCE_NAME`. Keep test helpers attached and clean up their exact resources.
- Generate credentials only at test runtime; never commit them or signed-in storage state.

## Focused Checks

```powershell
dotnet test .\tests\Clutch.API.Tests\Clutch.API.Tests.csproj --filter "FullyQualifiedName~ImportWorkflowTests|FullyQualifiedName~ImportStateTests|FullyQualifiedName~ImportCoordinationMigrationTests|FullyQualifiedName~ImportStatusTests|FullyQualifiedName~ImportEndingTests|FullyQualifiedName~ImportNotificationTests|FullyQualifiedName~ImportMetricsTests"
```

The named groups include domain transitions, populated-schema upgrade, SQL locking/
recovery barriers, status, exact-target ending, retained notifications and metrics.
Verify that all named groups run a nonzero number of tests; an unmatched selector is
not a passing feature gate.

```powershell
Set-Location .\src\clutch-web
npm run test -- src/features/imports/ImportPage.test.tsx src/features/imports/ImportEndedDialog.test.tsx src/features/imports/api.test.ts
npm exec playwright test -- --config playwright.active-import.config.ts
```

The dedicated config reuses the ownership runner's API/database launch helper and
selects `e2e/active-import.spec.ts`. Its three real-backend journeys cover measured
preflight feedback, waiting clearance, exact-target recovery, foreground notification,
offline restoration with a replacement, acknowledgement, themes and accessibility.
These cases deliberately skip in the default browser config, then run without skips
under the dedicated config. Existing optional storage-state journeys in the default
suite still require their documented authenticated fixtures.

## Required Executable Scenarios

| Check | Setup and assertions | Coverage |
|---|---|---|
| Early preflight | Create an owner/account with no saved mapping requirement; seed another Ready preview; open import without selecting a CSV. Assert checking then blocked message and no create call; no active preview enables normal start. | FR-001, FR-002, FR-003; SC-001 |
| Exact-target recovery | Open two contexts signed in as the same owner. A creates a preview; B opens import and ends that exact preview. Assert zero imported rows from A, lease release and B can start without navigating away. | FR-004, FR-005, FR-006; SC-002 |
| Protected claim | Use an API test interceptor/barrier to pause after the Processing claim commits but before financial writes. Assert status Processing/canEnd false and end/ordinary cancel refusal; then release and confirm exactly once. No production pause endpoint. | FR-004, FR-005, FR-007; SC-003 |
| Race winner | Coordinate concurrent end vs confirmation with SQL Server and independent scopes. Assert at most one winning transition; if end wins there are zero imported rows, and if claim wins end cannot succeed. Repeat both orderings deterministically, not with sleep-only tests. | FR-005 through FR-007; SC-003 |
| Stale target | Observe preview A, end it, create B, then retry an old end targeting A. B remains active and untouched; repeated ending of retained A creates no duplicate event. Concurrent starts leave one lease. | FR-005, FR-007; SC-003 |
| Ended-session modal | Measure from successful ending to A's named modal: at most five seconds. Assert correct authenticated username, underlying controls inert, focus inside, Tab trapped, Escape/outside click ineffective. Acknowledge and assert the correct account's transactions screen and refreshed data. | FR-008, FR-009, FR-010, FR-015; SC-004 |
| Restoration | Pause/background or disconnect A, end its preview, then restore/reconnect A. Assert no confirmation/cancel/start is possible before fresh status and the same actor modal. A replacement active preview must not hide the old ended result. | FR-011, FR-012; SC-005 |
| Waiting availability | In separate cases complete, expire, and self-cancel the competing preview. Measure availability within five seconds, no refresh click and zero automatic create calls. If a replacement wins first, B stays blocked with the new eligibility. | FR-018; SC-007 |
| Failure and identity isolation | Fail/timeout status and end calls; assert visible retry and no optimistic availability. A third, unrelated owner receives 404 for status/end/watched resources, without username details. Missing CSRF fails without mutation; invalid response shapes fail closed. | FR-013, FR-014; SC-005, SC-006 |
| Expiry and terminal distinctions | Advance injected TimeProvider for server cases; expiry must never label the actor as having ended the preview. For watched Expired/Unavailable, assert a non-attributed explanation, disabled preview mutations and Return to transactions for the correct account without a cancel request; a failed status read still offers Retry. Confirm duplicate-required returns to Ready with warnings, while Processing is not removed by preview cleanup. | FR-002, FR-004, FR-012 |
| Abandoned claim safety | Age a claimed attempt without starting writes; cleanup releases only it, and its delayed worker cannot insert. In another case hold the guarded financial transaction while cleanup attempts recovery; cleanup cannot interrupt it or release its lease, and rechecks after commit/rollback. | FR-007; SC-003; OPS-001 |
| Atomicity and upgrade | Fail staging-removal/audit/save inside ending; no partial ending. Fail financial writes/settings save; rollback and clean only the matching claim. Apply migration to populated previous schema; preserve existing staging, mappings/settings, transactions and immutable Audit rows. | FR-006, FR-012; DOT-002, AUD-001 |
| Feedback and appearance | Hold status/end requests and assert visible busy feedback within 500 ms. Run keyboard, accessible-role/name and automated accessibility checks on desktop and narrow viewports in Light and Dark; System follows OS changes and saved mode remains unchanged. | FR-014, FR-015, FR-016, FR-017; SC-006 |

Use the real backend for the successful two-session end/notification/return journey.
Use isolated component/browser fixtures for deterministic timeout, background, keyboard
and response-shape variations, plus SQL integration tests for all financial race invariants.
Fake time alone cannot satisfy the real-browser five-second elapsed-time measurements.

## Quality and Review Gates

From `src\clutch-web`:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm audit
```

From the repository root:

```powershell
dotnet build .\saturdayarvo-clutch.slnx
dotnet test .\tests\Clutch.API.Tests\Clutch.API.Tests.csproj
dotnet list .\src\Clutch.API\Clutch.API.csproj package --vulnerable --include-transitive
dotnet list .\tests\Clutch.API.Tests\Clutch.API.Tests.csproj package --vulnerable --include-transitive
git --no-pager diff --check
```

Run focused cases first; run the applicable frontend release gates and backend
regressions after feature checks pass. Preserve existing import metrics and audit
immutability tests. Report missing tools, Docker/network/registry failures and unmatched
selectors explicitly; they do not waive the underlying gate.

Before acceptance, obtain independent agent reviews of (1) generated SQL, migration,
lock order, recovery guards, indexing and round trips and (2) changed code against OWASP
Top 10, CSRF, authorization and sensitive-data handling. Resolve findings and rerun
affected checks and dependency scans. These are implementation reviews, not prerequisites
for writing this design.

## Deployment Verification

Follow the maintenance/drain and forward-recovery procedure in
[data-model.md](./data-model.md). Automated upgrade verification must confirm no Audit
updates/deletes, no lost Ready previews, and correct classification after deployment.
Do not run an old API cleanup worker against the expanded state model or roll back
schema columns carrying unacknowledged ended-preview state.
