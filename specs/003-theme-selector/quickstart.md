# Quickstart: Theme Selector Validation

## Prerequisites

- .NET 10 SDK.
- Node.js and npm for `src/clutch-web` (dependencies installed from `package-lock.json`).
- Docker available for API SQL Server Testcontainers integration tests.
- For the authenticated browser journey, a secured Playwright storage-state file and a running API reachable by the Vite development server.

## Automated Validation

From the repository root, run:

```powershell
dotnet test .\tests\Clutch.API.Tests\Clutch.API.Tests.csproj
Push-Location .\src\clutch-web
npm run typecheck
npm run lint
npm run test
npm run build
Pop-Location
```

Expected outcomes:

- API integration tests migrate a disposable SQL Server database and verify authenticated preference reads/writes, invalid modes, persistence across clients for one user, user isolation, and replacement by a later saved mode.
- API integration tests verify that a user without a saved preference receives Light.
- Frontend tests verify the unsaved default is Light, select Light/Dark/System by accessible label, and verify applied appearance, OS change handling, and visible save-failure feedback.
- Type checking, linting, tests, and production build complete without errors or warnings.

## Implementation Validation Results

Validation run on 2026-11-09:

- `dotnet test .\tests\Clutch.API.Tests\Clutch.API.Tests.csproj`: passed (99 tests).
- Frontend typecheck, lint, test, and production build: passed (60 tests).
- `npm run test:e2e -- theme-selector.spec.ts --project=chromium`: both authenticated browser tests were skipped because `PLAYWRIGHT_STORAGE_STATE` was not configured.
- The manual visible-focus, 200% zoom, and 320 CSS px reflow checks have not been performed.

Convergence validation run on 2026-11-09:

- Independent EF Core query and migration review: no significant issues found. The `UserId` primary key supports the preference lookup without another index; the migration only creates the preference table and its rollback only drops that table. Sequential saves are covered; concurrent-save behavior was not directly tested.
- Independent OWASP Top 10 review of the theme preference API and frontend persistence flow: no vulnerabilities found.
- Re-ran `dotnet test .\tests\Clutch.API.Tests\Clutch.API.Tests.csproj`: passed (99 tests).
- Re-ran frontend typecheck, lint, unit tests, and production build: passed (60 tests).
- `npm run test:e2e -- --project chromium`: 3 passed and 5 skipped. The authenticated theme journeys were skipped because `PLAYWRIGHT_STORAGE_STATE` is not configured. The existing sign-in journey now verifies that the Light default remains fixed when the OS preference changes.
- `npm run test:e2e -- e2e/family-accounts-import.spec.ts -g 'sign-in journey' --project=chromium`: passed (1 test); this validates only signed-out keyboard/accessibility behavior and Light-default behavior, not the authenticated selector.
- Manual visible-focus and 200% zoom/320 CSS px reflow checks remain unperformed and require a browser/manual session.

Authenticated validation run on 2026-11-09:

- With a localhost-scoped storage state and `PLAYWRIGHT_BASE_URL=http://localhost:5173`, `npm run test:e2e -- theme-selector.spec.ts --project=chromium` passed both tests, including desktop and 320 CSS px axe checks.
- `npm run test:e2e -- --project chromium --workers=1` passed 6 tests and skipped 2; the skipped administrator and other-user journeys require separate storage states.
- A subsequent parallel run passed 5, skipped 2, and failed the import-settings journey after the repeated runs reached the import attempt limit. The theme tests passed. These import tests create accounts and transactions in the development database.
- Visible-focus and 200% zoom/320 CSS px reflow checks remain manual and unperformed; T024 remains open.

T024 validation rerun on 2026-11-09:

- API integration tests passed (99 tests); frontend typecheck, lint, tests (60 tests), and production build passed.
- Authenticated Chromium run with `--workers=1` passed 6 tests, including both theme-selector tests and their desktop and 320 CSS px axe checks. Two unrelated journeys were skipped because administrator and second-user storage states were not provided.
- The user manually confirmed the keyboard focus indicator was visible and that the selector, choices, and page content remained visible and operable without horizontal overflow or loss of functionality at 200% zoom and 320 CSS px width.

## Browser and Accessibility Scenarios

With the API running and `PLAYWRIGHT_STORAGE_STATE` set to a secured authenticated state file, run from `src/clutch-web`:

```powershell
npm run test:e2e -- --project chromium --workers=1
```

The hostname in `PLAYWRIGHT_BASE_URL` must match the one used to create the storage state. The default is `http://127.0.0.1:5173`; set it to `http://localhost:5173` for localhost-scoped cookies.

Verify the authenticated top-banner selector at desktop and narrow viewport widths:

1. The control is discoverable by its accessible label and exposes exactly Light, Dark, and System. With the selector visible, selecting any mode takes no more than two control interactions: opening it and choosing a mode count separately, while moving keyboard focus to it does not count.
2. With no saved preference, Light is selected regardless of OS appearance. Keyboard users can focus the control, change a mode, and identify the selected value; Light and Dark apply within 500 milliseconds without a reload.
3. Light and Dark remain fixed when the OS preference changes; System follows both OS transitions within one second.
4. The selected mode reappears after reload, and a second client signed in as the same user sees the latest saved mode after opening or refreshing.
5. The selector and its choices remain visible and operable without horizontal overflow; axe reports no WCAG 2.2 AA violations for the tested selector journey. Manually verify visible focus and that the page reflows without loss of content or functionality at 200% zoom and 320 CSS px width.
