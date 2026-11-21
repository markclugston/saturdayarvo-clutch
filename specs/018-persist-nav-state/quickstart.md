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
- Saved `Unpinned` → compact; hover and keyboard focus still expand (US1-2).
- Preference route delayed 5 s → signed-in screen within 2.5 s of the session response (2 s cap plus render tolerance), compact (SC-006).
- axe reports no WCAG 2.2 AA violations in both themes with the pinned start.
- Existing 011/015 navigation journeys still pass (FR-009).

Reviews (final phase): independent EF query + migration review, independent OWASP Top 10 and
dependency review, UI compliance checklist from [plan.md](./plan.md).
