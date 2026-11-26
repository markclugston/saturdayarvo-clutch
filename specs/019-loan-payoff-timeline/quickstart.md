# Quickstart: Amortization Schedule Validation

## Prerequisites

- .NET 10 SDK; Docker running (SQL Server Testcontainers fixture).
- `src/clutch-web` dependencies installed (`npm ci`); Playwright browsers installed.

## Commands

From the repository root:

```powershell
dotnet test .\tests\Clutch.API.Tests\Clutch.API.Tests.csproj --filter "FullyQualifiedName~LoanPayoffTimelinePreference"
```

```powershell
dotnet build .\saturdayarvo-clutch.slnx; dotnet test .\tests\Clutch.API.Tests\Clutch.API.Tests.csproj
```

```powershell
dotnet list .\src\Clutch.API\Clutch.API.csproj package --vulnerable --include-transitive
```

From `src/clutch-web`:

```powershell
npm run typecheck; npm run lint; npm run test; npm run build
```

```powershell
npx playwright test --config playwright.style-guide.config.ts
```

```powershell
npm run test:e2e:integration -- e2e/mortgages.spec.ts
```

## Expected outcomes

API integration (see [contract](./contracts/loan-payoff-timeline-preferences.md)):

- No row → `GET` returns `Burndown` (FR-005, SC-002).
- `PUT Schedule` then `GET` from a second client of the same user → `Schedule` (FR-008, US2-1, US2-5).
- Same `clientId`: sequence 2 committed, then sequence 1 arrives → stored stays sequence 2's view, outcome `superseded` (FR-006, SC-007).
- Many parallel PUTs with increasing sequences, one `clientId` → stored view is the highest sequence's.
- Different `clientId`s → last committed wins (FR-008).
- User B never reads user A's view (SC-004); unauthenticated `GET` and `PUT` → 401; `PUT` without a valid antiforgery token → 400/403, nothing saved (SEC-001).
- `view` missing, null, `"schedule"`, `"Table"`, `5`, `{}`; `clientId` missing, malformed or all zeros; `clientSequence` 0, negative, > 2^53 − 1, string or fractional; empty, malformed or > 1024-byte body → 400 with the contract title and detail, nothing saved, outcome `invalid` (FR-011).
- Migration applies cleanly; `Down` drops the table.

Unit: `PreferenceMetricsTests` records each Amortization Schedule outcome with duration.

Frontend unit (Vitest):

- Page stays in `Loading...` while the preference is pending; saved `Schedule` → first render shows the schedule, never the chart (FR-007, US2-3).
- No saved value, error, or no response within 2 s (fake timers) → Burndown; a late response does not change it (FR-005, SC-006).
- Switch changes the view synchronously and sends one PUT per switch with increasing `clientSequence`; three rapid switches → three PUTs started at once (FR-006, FR-012).
- Every PUT is sent with `keepalive: true`; leaving Mortgages and returning keeps the same `clientId` and continues the sequence (US2-6).
- The preference query is never refetched on focus, reconnect or remount (`staleTime: Infinity`), so another device's save does not reach an open visit (FR-008, US2-5); after a load error or timeout, remounting sends no second GET and Burndown stays.
- Remounting the page with `Schedule` cached shows the schedule on first render, with no loading state or chart (SC-003).
- An older save response arriving last does not change the shown view.
- Save failure → no toast, view stays as chosen (FR-010).
- Accessible name, tooltip text and hidden status line match each view, and the status line changes after each switch; no `aria-pressed` (FR-004).
- View kept across mortgage tabs and "Add mortgage"; unsaved mortgage shows "Please enter your mortgage details" in both views (US1-5, US1-6).
- Tooltip primitive: shows on hover and focus, stays while the pointer is over it, hides on Escape, blur and pointer leave.

Browser (Playwright):

- Mocked API (`style-guide.spec.ts`): the old side-by-side layout test is replaced by a full-width single-group test (FR-001); one "Amortization Schedule" group, never both views (SC-001); switch button same size as the trash button, at the group's top right and aligned with the title at 320 px and 1280 px (FR-003); axe passes and screenshots in light and dark for both views and for the tooltip; at 320 px no page-level horizontal scroll and the button stays visible; preference delayed 5 s → group shows Burndown 2,000 to 2,250 ms after the mocked route receives the request (SC-006).
- Real API (`mortgages.spec.ts`, integration config): switch to Schedule, reload → Schedule; sign out and in → Schedule; sign out and sign in as a second user in the same tab → Burndown; sign back in as the first user → Schedule; switch back, reload → Burndown; three rapid switches then an immediate reload → the last view; navigate away and back → the view last chosen (US2-1, US2-2, US2-4, US2-6, SC-003, SC-004, SC-007).

Reviews (final phase): independent EF query + migration review, independent OWASP Top 10 and
dependency review, UI compliance checklist from [plan.md](./plan.md).

## Results (2026-11-22, implement)

| Command | Result |
|---|---|
| `dotnet test … --filter "FullyQualifiedName~LoanPayoffTimelinePreference"` (+ `PreferenceMetrics`) | 33 passed, 0 failed |
| `dotnet build .\saturdayarvo-clutch.slnx` | 0 warnings, 0 errors |
| `dotnet test .\tests\Clutch.API.Tests\Clutch.API.Tests.csproj` (all, Docker SQL Server) | 317 passed, 0 failed |
| `dotnet list … package --vulnerable --include-transitive` | No vulnerable packages (both projects) |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass (0 warnings) |
| `npm run test` | 45 files, 512 passed, 0 failed (one test removed with the view-save toast) |
| `npm run build` | Pass, after fixing a pre-existing extensionless import in `e2e/integration-setup.ts` (from commit 3a6b42c) that failed `tsc -b` |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `npx playwright test --config playwright.style-guide.config.ts` | 188 passed, 0 failed |
| `npx playwright test e2e/navigation.spec.ts` (mocked; opens Mortgages) | 36 passed, 0 failed |
| `npm run test:e2e:integration -- e2e/mortgages.spec.ts` | 2 passed, 0 failed |

Notes:

- SC-006: the request is aborted at 2,000 ms; the chart renders a few ms later (2,025 ms measured).
  The browser test asserts 1,950 to 2,250 ms after the route received the request and passed 6 of 6
  repeats. A failed view save shows no toast (FR-010, amended 2026-11-22).
- Screenshots (`STYLE_SCREENSHOTS=1`) are opt-in. New baselines were added for every mortgage
  state, including the four Amortization Schedule states. Baselines for screens this feature does
  not touch (for example `sign-in`) already differ by about 3% from the committed images; they were
  left unchanged.
- The tooltip's "stays while the pointer is over it" behaviour needs real layout, so it is
  verified in the style-guide browser test; the jsdom component test checks the popup accepts the
  pointer.
