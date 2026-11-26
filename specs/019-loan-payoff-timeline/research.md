# Research: Amortization Schedule Group

No NEEDS CLARIFICATION items remained after the 2026-11-22 clarifications. Each entry records a
design decision taken against the existing code. Settled behaviour (auth, ownership, error format,
CSRF, React Query + Zod boundary, toast feedback) is reused as-is from the 018 navigation
preference (`NavigationPreferenceEndpoints.cs`, `NavigationPreferenceService.cs`,
`src/clutch-web/src/features/preferences/api.ts`).

## R1 Storage shape

- **Decision**: New table `UserLoanPayoffTimelinePreferences`, one row per user (`UserId` PK/FK,
  cascade delete), `View` varchar(16) with a check constraint, `ClientId` + `ClientSequence` for
  save ordering (R3), `UpdatedAtUtc`. Mirrors `UserNavigationPreferences`.
- **Rationale**: Same sibling pattern; no row means Burndown, so no backfill (FR-005).
- **Alternatives**: Column on an existing preference table (rejected: couples independent
  preferences); generic key/value settings (rejected: ARC-001, weaker validation).

## R2 API shape and value set

- **Decision**: `GET`/`PUT /api/preferences/loan-payoff-timeline`; values `Burndown` | `Schedule`.
  Domain enum `LoanPayoffTimelineView` in `Domain/Preferences/`. Body read manually with the same
  size cap and allow-list as the navigation endpoint; anything else → 400 (FR-011). DB check
  constraint is the second line.
- **Rationale**: Identical auth, CSRF and error format to 018.

## R3 Every switch saves at once; last choice wins (FR-006, SC-007)

- **Decision**: Each switch sends its own `PUT` immediately, with no mutation `scope` (018's serial
  scope would queue, i.e. delay, later saves, which the clarification forbids). Each request carries
  `clientId` (a random GUID created once per page load and kept across sign-out and sign-in in that page; rows are per user, so sharing it is safe) and `clientSequence` (a counter
  that increases by one per switch in that page load). Inside the existing serializable upsert, the
  server skips the write when the stored row has the same `clientId` and a higher-or-equal
  `clientSequence`, and returns the stored view. A different `clientId` (another tab, device or
  visit) always writes, so the most recent save across devices wins (FR-008).
- **Page-load state**: `clientId` and `clientSequence` live together in one module-level object,
  not in component state or refs. Leaving Mortgages and returning remounts the page; if the
  sequence restarted at 1 under the same `clientId`, the server would treat every later save as
  superseded and silently drop it.
- **Reload during a save (US2-6)**: each `PUT` is sent with `fetch` `keepalive: true`
  (`apiRequest` passes `init` through), so a save started just before a reload or navigation is
  not cancelled by the browser. The body is far below the 64 KB keepalive limit. The CSRF token is
  already cached by the time a user can switch (the page's earlier requests fetched it).
- **Rationale**: Parallel requests can commit out of order; the sequence makes a late, older
  request from the same page a no-op without trusting client clocks. Every switch still starts and
  reaches the server (none skipped or merged).
- **Alternatives**: Serial mutation scope (rejected: delays saves); client timestamps (rejected:
  clock skew across devices, as in 018 R3); debounce (rejected: merges and delays switches);
  client-side corrective re-save after out-of-order responses (rejected: response order does not
  prove commit order).

## R4 Load before first render; 2-second limit; no swap (FR-005, FR-007, SC-006)

- **Decision**: `MortgagesPage` receives `userId` from `App.tsx` and starts the preference query in
  parallel with the mortgages query. The page keeps its existing `Loading...` status while either is
  pending. The query mirrors `useNavigationPreference`: aborted at 2000 ms, `retry: false`,
  `staleTime: Infinity`, no refetch on focus/reconnect. Success → that view; error or timeout →
  Burndown, and the aborted request can never apply late. Unlike 018 (loaded once at startup), this
  page remounts on navigation, and React Query re-requests an errored query on mount by default; the
  hook turns that off (e.g. `retryOnMount: false`) so a failed load is not retried within the visit.
- **Rationale**: The group never renders before its view is known, so there is no chart-to-schedule
  swap. Loading in parallel keeps the page's wait to at most the slower of the two, capped at 2 s
  for the preference.
- **Alternatives**: Gating in the App startup dialog like 018 (rejected: delays every screen for a
  Mortgages-only setting); rendering Burndown then correcting (violates FR-007); localStorage
  (rejected: per-browser, can leak between users, SC-004).

## R5 Where the current view lives in the client (FR-009, US1-5, FR-010)

- **Decision**: The query cache entry `['loanPayoffTimelinePreference', userId]` is the single
  source of the shown view. A switch writes the new view to the cache synchronously
  (`setQueryData`), then fires the save. Save responses never write the cache, so an older response
  cannot flip the view back. A failed save shows no message (toasts are only for saving data) and leaves the cache as chosen.
- **Rationale**: One value for all mortgage tabs and "Add mortgage"; survives navigating away and
  back within the visit; sign-out already removes every non-session query in `App.tsx`, so user A's
  view never reaches user B (SC-004).

## R6 Switch button and tooltip (FR-003, FR-004)

- **Decision**: `Button` with `variant="icon" size="icon"` (the trash button in
  `DeleteMortgageControl.tsx`) holding the lucide `RefreshCw` circular-arrows icon at `size-4`,
  `aria-hidden` (lucide-react is already a dependency). `aria-label` is "Show Amortization
  Schedule" or "Show Burndown Chart"; no `aria-pressed`. A visually hidden `role="status"` line reads
  "Showing Burndown Chart" / "Showing Amortization Schedule".
- **Tooltip**: No tooltip primitive exists, and the style guide says the first feature needing a
  pattern adds the primitive. Add `components/ui/tooltip.tsx` (no new package): shows on hover and
  keyboard focus, stays while hovered, dismisses on Escape (WCAG 2.2 SC 1.4.13), tokens only, linked
  through `aria-describedby` only when its text differs from the accessible name (here it is the
  same, so it is `aria-hidden` to avoid a double announcement).
- **Alternatives**: Native `title` (rejected: not shown on focus, not dismissible); a third-party
  tooltip package (rejected: new dependency and independent third-party review for a small need).

## R7 Group container

- **Decision**: New `LoanPayoffTimeline.tsx` renders one card `section` titled "Loan Payoff
  Timeline" with the switch button top right, and renders `BurnDownChart` or `AmortizationSchedule`
  as body content. Those two components lose their own card `section` and `h2` (content otherwise
  unchanged, FR-002). The two-column grid in `MortgagesPage.tsx` is removed (FR-001).

- **Height (FR-013)**: `ContentPanel` and its inner wrapper become flex columns, `MortgagesPage`, the group and `BurnDownChart` use `flex-1`, and `AmortizationSchedule` windows its rows against the nearest scrolling ancestor (the content area) instead of its own `h-96` scroller.

## R8 Observability

- **Decision**: Extend `PreferenceMetrics` with
  `clutch.preference.loan_payoff_timeline.save.outcomes` (`outcome`: success | superseded | invalid
  | failure) and a duration histogram. Structured error log on save failure, no request body.

## R9 Test impact on existing e2e mocks

- **Decision**: `e2e/style-guide.spec.ts` (mocked `/api/*`, opens Mortgages) gets a
  `/api/preferences/loan-payoff-timeline` mock returning `Burndown`, so it starts through the
  success path rather than its catch-all 404. `e2e/mortgages.spec.ts` runs against the real API
  (`playwright.integration.config.ts`) and needs no mock. The only side-by-side assertion is the 016
  test "Burndown sits above the schedule at 320 px and to its left on desktop (FR-011)" in
  `style-guide.spec.ts`; it is replaced by a single-group layout test (T030).
