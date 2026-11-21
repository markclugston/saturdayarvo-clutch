# Research: Remember Navigation Expanded State

No NEEDS CLARIFICATION items remained after the 2026-11-21 clarification. Each entry records a
design decision taken against the existing code; settled behaviour (auth, ownership, error format,
CSRF, React Query + Zod boundary) is reused as-is.

## R1 Storage shape

- **Decision**: New table `UserNavigationPreferences` (one row per user, `UserId` PK/FK with cascade
  delete, `State` varchar(16) with a check constraint, `UpdatedAtUtc`), mirroring
  `UserThemePreferences` (`src/Clutch.API/Infrastructure/Persistence/AppDbContext.cs`).
- **Rationale**: Follows the sibling exactly; absence of a row means Unpinned, so no backfill.
- **Alternatives**: Adding a column to `UserThemePreferences` (rejected: couples two independent
  preferences and forces a theme row to exist); a generic key/value settings table (rejected:
  ARC-001 "no unrequested features", weaker validation).

## R2 API shape and value set

- **Decision**: `GET`/`PUT /api/preferences/navigation` with body `{ "state": "Pinned" | "Unpinned" }`,
  mirroring `ThemePreferenceEndpoints.cs`. Domain enum `NavigationState` in `Domain/Preferences/`.
  Any other value → 400 ProblemDetails (FR-008); DB check constraint as a second line.
- **Rationale**: Same auth (`RequireAuthorization`, user ID from the principal only), same CSRF
  handling via `apiRequest`, same error format.
- **Alternatives**: Boolean `pinned` (rejected: spec names two states; string enum matches theme
  contract and keeps the allow-list explicit).

## R3 Last save wins (FR-005, rapid toggling)

- **Decision**: Server upsert in a serializable transaction with the execution strategy, as in
  `ThemePreferenceService.SaveAsync`. Client mutation uses a React Query v5 mutation `scope`
  (`` { id: `navigationPreference:${userId}` } ``) so one user's saves from one tab run in order and
  the last toggle is the last write.
- **Rationale**: Without scoping, parallel PUTs can commit out of order and persist an earlier state.
  The scope includes the user ID so a save still pending from a signed-out user never delays the
  next user's saves in the same tab.
- **Alternatives**: Debouncing (rejected: a page unload inside the debounce window loses the choice);
  client timestamps (rejected: trusts client clocks).

## R4 Startup gating with a 2-second limit (FR-002, FR-002a, FR-007)

- **Decision**: The preference query is enabled only once the session query has data (it needs the
  session `id`), so the 2 s limit is measured from session load. After the session query has data, `AppContent` keeps rendering the existing
  `StartupLoadingDialog` while the navigation-preference query is pending. The query's `queryFn`
  combines React Query's `signal` with `AbortSignal.timeout(2000)` and has `retry: false`,
  `staleTime: Infinity`, no refetch on focus/reconnect. Success → seed pinned from the value;
  error or timeout → seed Unpinned. Because the request is aborted at 2 s, a late value can never
  arrive in that session.
- **No jump**: `useNavigationExpansion` currently lives in `AppContent` and is created before the
  session loads, so it moves into a signed-in shell component that renders `AppShell`. That
  component mounts only after the preference query settles and is keyed by user ID, and the hook
  takes the settled value as its `useState` initial value. It is never set compact first and then
  corrected in an effect. Sign-out unmounts the shell, so no `reset()` is needed.
- **Alternatives**: Client timer racing the query (rejected: a late success would still populate the
  cache and need extra "ignore" bookkeeping); rendering compact then animating open (violates FR-007);
  localStorage cache (rejected: per-browser, can show user A's state to user B).

## R5 Save feedback and failure (FR-006, FR-010)

- **Decision**: The hamburger toggles local state synchronously, then fires the save. On save error,
  show the existing non-blocking `useToast()` message ("Your navigation setting could not be saved.
  It stays as you set it for this visit."); no inline error, no rollback. The toast comes from the
  per-call `mutate(…, { onError })` callback, which React Query skips once the shell has unmounted,
  so a save pending at sign-out never shows feedback to the next user.
- **Rationale**: Spec requires non-blocking feedback and the chosen state to remain in effect.

## R6 What does not save (FR-003)

- **Decision**: Only `toggle()` triggers a save. Hover/focus handlers never call the API, and
  sign-out unmounts the shell without saving.

## R7 Observability

- **Decision**: Add a static `PreferenceMetrics` class (`Clutch.API.Preferences` meter) with
  `clutch.preference.navigation.save.outcomes` (`outcome`: success | invalid | failure) and a
  duration histogram, registered in `Program.cs` beside the other meters; structured log on save
  failure with no request body. The endpoint records `invalid` (it validates the value, as the
  theme endpoint does); the service records `success` and `failure`.
- **Rationale**: Constitution "OpenTelemetry metrics required"; follows `MortgageMetrics.cs`.

## R8 Test impact on existing e2e mocks

- **Decision**: Every Playwright spec that routes `/api/*` (`e2e/navigation.spec.ts`,
  `e2e/style-guide.spec.ts`, `e2e/import-settings.spec.ts`) gets a
  `/api/preferences/navigation` mock returning `Unpinned`, so existing journeys start compact
  through the success path rather than through their catch-all 404 (the load-failure path).
