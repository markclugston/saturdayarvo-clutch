# Quickstart: Button-Based Navigation and Actions

Run commands from the repository root unless a step changes directory.

## Prerequisites

- Node.js and npm versions supported by `src/clutch-web`.
- Dependencies installed with `npm ci` from `src/clutch-web`.
- The mock-backed authenticated account/import/admin journey runs without credentials. Live account-privacy and administrator integration journeys additionally require secured browser storage-state files through `PLAYWRIGHT_STORAGE_STATE`; the privacy journey also requires `PLAYWRIGHT_OTHER_STORAGE_STATE`, and live administrator coverage requires `PLAYWRIGHT_ADMIN_STORAGE_STATE`. Do not commit these files.
- Playwright Chromium installed with `npx playwright install chromium` if it is not already available.

## Automated Validation

```powershell
Set-Location src/clutch-web
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

`npm run test:e2e` starts the Vite development server through the existing Playwright configuration. The component suite verifies button roles and names, file selection, existing action outcomes, and destination-heading focus. Browser tests use Playwright and axe-core for no-anchor checks, keyboard activation, pointer cursor, response timing, responsive layouts, themes, and WCAG 2.2 AA accessibility. A mock-backed authenticated journey audits the Family, Accounts, Account Details, Import form/review/result, and administrator settings views without external credentials. Live account-privacy and administrator integration tests are skipped unless their required storage-state variables are supplied; startup and sign-in browser tests run without them.

## Scenarios and Expected Results

1. **Control audit**: inspect rendered user-facing views in the automated browser suite. Navigation/action controls have button roles and meaningful names; no such control is an anchor; every hovered button reports the pointer cursor.
2. **Navigation and actions**: activate each navigation and action control by role/name. The expected existing view/action result is shown, authorization remains enforced, and Back buttons restore the expected in-app view.
3. **Keyboard**: use Tab/Shift+Tab and Enter/Space to traverse and activate controls. Focus remains visible and moves to the destination heading when the active view changes.
4. **Feedback timing**: measure immediate navigation/action responses. They appear within 500 ms; operations that exceed the limit expose a busy state and progress when measurable.
5. **Responsive and themes**: cover 320×812 and 1280×720 viewports in Light, Dark, and System modes. Controls remain visible and usable; saved theme preferences and System-mode behavior remain unchanged.
6. **Accessibility**: run the existing Playwright axe-core pattern with WCAG 2.2 AA tags on each covered view. Expected result: no violations.

The browser-level scenarios are automated completion checks; manual testing is optional and is not a release gate.

## Security Review

An independent OWASP Top 10 review of the `src/clutch-web/src/` navigation and action controls found no security vulnerabilities.
