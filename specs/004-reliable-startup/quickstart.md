# Quickstart: Reliable Startup Loading

## Prerequisites

- Node.js and the frontend dependencies installed in `src/clutch-web` (`npm install`).
- For browser-level validation, Playwright's Chromium browser installed and available.
- No authenticated storage state or API service is required for the controlled startup scenarios; tests should stub the session endpoint responses.

## Validate startup behavior

From `src/clutch-web`:

1. Run the focused component tests:

   ```powershell
   npm run test -- src/App.test.tsx src/features/auth/StartupLoadingDialog.test.tsx
   ```

   Expected: tests prove the sign-in screen is present behind the loading dialog, dialog focus/background blocking, signed-in and signed-out outcomes, transient recovery, non-transient errors, retry, request timeout, and bounded failure timing.

2. Run the browser-level startup checks:

   ```powershell
   npm run test:e2e -- e2e/startup.spec.ts
   ```

   Expected: Playwright verifies modal interaction and focus behavior, correct routing after controlled session responses, retry without navigation, and Axe checks for the loading and error states at 320x812 and 1280x720 in Light, Dark, and System modes.

3. Run frontend gates:

   ```powershell
   npm run typecheck
   npm run lint
   npm run build
   ```

   Expected: all commands exit successfully with no type errors, lint warnings, or build failures.

4. Check frontend dependencies for known vulnerabilities:

   ```powershell
   npm audit
   ```

   Expected: review the audit results and resolve dependency vulnerabilities relevant to this change before completion; report any pre-existing findings that remain unresolved.

## Timing verification

Use controlled query timers and mocked requests for the 30-second recovery and 45-second hard bounds rather than making the automated suite wait through real service outages. Include a request that never resolves unless aborted to prove the per-request deadline yields a visible, retryable error within the overall bound.

See [the startup UI contract](./contracts/startup-ui.md) and [the startup state model](./data-model.md) for expected transitions and semantics.
