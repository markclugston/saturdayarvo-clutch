# Quickstart: Navigation State Validation

## Prerequisites

- .NET 10 SDK; Docker running (SQL Server Testcontainers fixture).
- `src/clutch-web` dependencies installed (`npm ci`).
- Playwright browsers installed; the navigation spec mocks `/api/*`, so no API or storage state is needed for it.

## Commands

From the repository root:

```powershell
dotnet test .\tests\Clutch.API.Tests\Clutch.API.Tests.csproj --filter "FullyQualifiedName~NavigationPreference"
```

```powershell
dotnet test .\tests\Clutch.API.Tests\Clutch.API.Tests.csproj
```

From `src/clutch-web`:

```powershell
npm run typecheck; npm run lint; npm run test; npm run build
```

```powershell
npm run test:e2e -- e2e/navigation.spec.ts --project chromium
```

```powershell
npm run test:e2e -- --project chromium --workers=1
```

## Expected outcomes

API integration (see [contract](./contracts/navigation-preferences.md)):

- No saved row → `GET` returns `Unpinned` (FR-002, SC-002).
- `PUT Pinned` then `GET` from a second client of the same user → `Pinned` (FR-004, US2-1).
- Two sequential saves from two clients of the same user → the later one is returned to both (FR-005, US2-2).
- User B never sees user A's state (SC-003); unauthenticated → 401.
- `state` missing, `"pinned"`, `"Expanded"` → 400 ProblemDetails; nothing saved (FR-008).
- Migration applies cleanly on the disposable database.

Frontend unit (Vitest):

- Startup dialog stays up while the preference is pending; first shell render is pinned when saved `Pinned` (FR-007, US1-4/5).
- Preference error, or no response within 2 s (fake timers) → shell appears compact; a late response does not change it (FR-002a, US1-6).
- Toggle flips `aria-expanded` immediately and sends one PUT with the new state; hover/focus send none (FR-003, FR-010).
- Save failure → toast shown, navigation stays as chosen (FR-006).
- Rapid toggles → saves run in order; last PUT carries the final state.
- Sign out then sign in as another user → that user's state, not the previous one.

Browser (Playwright, mocked API):

- Saved `Pinned` → navigation pinned and content laid out expanded on first paint, with no geometry change after load, at 1280 px and at 767 px (overlay) (US1-1, edge case narrow viewport).
- Saved `Unpinned` → compact; hover still expands (US1-2, amended 2026-11-22).
- Preference route delayed 5 s → signed-in screen within 2.5 s of the session response (2 s cap plus render tolerance), compact (SC-006).
- axe reports no WCAG 2.2 AA violations in both themes with the pinned start.
- Existing 011/015 navigation journeys still pass (FR-009).

Reviews (final phase): independent EF query + migration review, independent OWASP Top 10 and
dependency review, UI compliance checklist from [plan.md](./plan.md).

## Results (2026-11-21, after T031)

Run on `main` at `806a751` plus T031 and the uncommitted 016/017 mortgage changes in the working tree.

| Command | Result |
|---|---|
| `dotnet test … --filter "FullyQualifiedName~NavigationPreference"` | Pass: 15/15 |
| `dotnet build saturdayarvo-clutch.slnx` | Pass: 0 warnings, 0 errors |
| `dotnet test …Clutch.API.Tests.csproj` (all, SQL Server fixture) | Pass: 281/281 |
| `dotnet list … package --vulnerable --include-transitive` | Pass: no vulnerable packages |
| `npm run typecheck` / `npm run lint` | Pass / Pass |
| `npm run test` | Pass: 477/477 in 43 files |
| `npm run build` | Pass (chunk-size advisory only) |
| `npm run test:e2e -- e2e/navigation.spec.ts --project chromium` | Fail: 23 passed, 12 failed; after `07ae269`: Pass 35/35 |
| `npm run test:e2e -- --project chromium --workers=1` | Fail: 33 passed, 29 failed, 10 skipped |

E2E failure notes:

- All 018 journeys pass: pinned first paint at 1280 and 767 px, compact start with hover, toggle saves and reload restores, slow preference shows a compact shell within 2.5 s, axe and screenshots for the pinned start in both themes, and reduced motion.
- The 12 navigation failures were older 011/015 keyboard-focus and layout journeys that also failed at the pre-018 commit `3ee7739`. Commit `07ae269` fixed them: one app fix (a focused control below 768px now sits above the open navigation) and out-of-date tests updated. Rerun on `main` at `07ae269`: `navigation.spec.ts` 35/35 pass and `App.test.tsx` 35/35 pass. Since `cbc27b3` keyboard focus no longer expands the navigation; specs 011/015/018 were amended on 2026-11-22 to match. Later the same day, hover stopped expanding the navigation below 768px (WCAG 2.2 SC 1.4.13, 011 FR-014): navigation e2e now 36/36, Vitest 479/479, typecheck, lint and build pass.
- The other 17 failures (accounts-import, accounts-transaction-delete, categories-groups, mortgages) are `502` proxy errors on `/api/security/csrf-token`. These specs need a running API, and none was running, so they were not exercised. Rerun them with the API up.

## Results (2026-11-22, after T033-T037)

Run on `main` at `d2bc013` (`c7db67b` cherry-picked) plus the uncommitted 016/017/018 working tree.

| Command | Result |
|---|---|
| `dotnet build saturdayarvo-clutch.slnx` | Pass: 0 warnings, 0 errors |
| `dotnet test …Clutch.API.Tests.csproj` (all, SQL Server fixture) | Pass: 285/285 |
| `npm run typecheck` / `npm run lint` | Pass / Pass |
| `npm run test` | Pass: 480/480 in 43 files |
| `npm run build` | Pass (chunk-size advisory only) |
| `npx playwright test --config playwright.style-guide.config.ts` | Pass: 166/166 |
| `npx playwright test --config playwright.ownership.config.ts` | Pass: 3/3 |
| `npx playwright test --config playwright.transaction-delete.config.ts` | Pass: 14/14 (42/42 over 3 repeats) |
| `npx playwright test --config playwright.active-import.config.ts` | Pass: 3/3 |
| `npx playwright test --config playwright.config.ts` (no API running) | 46 passed, 10 skipped, 17 failed |

Notes:

- The 17 `playwright.config.ts` failures are the same API-backed specs as above: it starts only Vite, so `/api/security/csrf-token` gets `ECONNREFUSED`. Their dedicated configs start the API and pass them (ownership covers accounts-import, categories-groups and mortgages; transaction-delete covers accounts-transaction-delete). The 10 skips need an owner storage state.
- T034: the 3:1 focus-contrast failure was a test race, not a style defect. `transition-colors` animates the outline from the white button text colour, so the probe now waits for animations to finish.
- T037: the "Sign In" heading match in `startup.spec.ts` is now exact. A 503 error heading containing "Sign In" satisfied it before the retry. Passed 20/20 after the change.
