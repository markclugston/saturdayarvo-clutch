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
- The manual visible-focus, 200% zoom, 320 CSS px, and 10-participant usability checks have not been performed.

## Browser and Accessibility Scenarios

With the API running and `PLAYWRIGHT_STORAGE_STATE` set to a secured authenticated state file, run from `src/clutch-web`:

```powershell
npm run test:e2e -- --project chromium
```

Verify the authenticated top-banner selector at desktop and narrow viewport widths:

1. The control is discoverable by its accessible label and exposes exactly Light, Dark, and System. With the selector visible, selecting any mode takes no more than two control interactions: opening it and choosing a mode count separately, while moving keyboard focus to it does not count.
2. With no saved preference, Light is selected regardless of OS appearance. Keyboard users can focus the control, change a mode, and identify the selected value; Light and Dark apply within 500 milliseconds without a reload.
3. Light and Dark remain fixed when the OS preference changes; System follows both OS transitions within one second.
4. The selected mode reappears after reload, and a second client signed in as the same user sees the latest saved mode after opening or refreshing.
5. The selector and its choices remain visible and operable without horizontal overflow; axe reports no WCAG 2.2 AA violations for the tested selector journey. Manually verify visible focus and that the page reflows without loss of content or functionality at 200% zoom and 320 CSS px width.

For SC-005, run the same usability protocol with 10 participants: ask each participant to select Light, Dark, and System in turn and identify the selected mode after each choice, without assistance. Record whether at least 9 participants complete all three selection-and-identification tasks without assistance.
