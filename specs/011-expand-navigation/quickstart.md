# Quickstart: Expandable Left Navigation

This guide describes checks for the expandable navigation feature.

## Prerequisites

- Run commands from `src/clutch-web` with the project's Node.js and npm dependencies available. Install dependencies only if they are missing.
- Playwright's Chromium browser must be installed. The default configuration starts the Vite server; use the existing route-interception approach for a self-contained authenticated navigation journey. Live integration journeys require a disposable API/database and any configured storage states; keep credentials and browser state outside the repository.
- Do not use production account data. Required executable checks that cannot run or fail are blockers, not passes.

## Focused automated checks

From `src/clutch-web`:

```powershell
npm test -- src/App.test.tsx
npm run test:e2e -- e2e/navigation.spec.ts --project=chromium --workers=1
```

The browser test runs without an external authenticated storage state by using controlled session and page responses.

Expected outcomes:

1. Session loading and signed-out views have no pane; the signed-in overview, account detail, import, Categories, and administrator settings have one. Successful sign-out and a 401 session refresh remove it; re-authentication starts compact. A transient refresh error retains it and shows the existing error feedback.
2. Both destinations work in both pane states. Accounts returns to the overview and clears account/import selection; Categories preserves existing state behavior. Correct current markers and accessible names are available in both states; no Accounts/Categories controls remain in the header.
3. Hover over and leave the pane, then focus its controls by keyboard; verify unchanged icons, label visibility, focus and pointer cursor. Verify Escape dismisses the pane without moving the pointer or focus and that a new hover or focus interaction reopens it. Confirm touch taps navigate directly. Verify hover and destination actions provide visible feedback within 500 ms or show a busy state when slower.
4. At 320-by-812, 1280-by-720 and 1920-by-1080, measure pane, main and heading bounding boxes to confirm expansion does not change content geometry or force an overlap. Verify that the pane overlays content where they do share space, and that keyboard-focused page controls remain visible when the pointer keeps the pane expanded. Exercise both pane states and representative controls on every signed-in screen, including deeply nested category editing and deletion; verify usable reflow, no page-level horizontal overflow, and keyboard-accessible local scrolling.
5. In Light, Dark, and System modes, exercise both pane states and run axe checks with the repository's WCAG 2.2 AA tags. Confirm System follows both OS schemes and theme selection/persistence remains unchanged. Supplement automated axe checks with executable keyboard, focus, visible-state, contrast, and layout assertions; axe alone does not establish full WCAG conformance.
6. Preserve role restrictions and verify existing theme, administrator, sign-out, and session-error controls and results.

Use the [UI contract](contracts/navigation-ui.md) and [state model](data-model.md) as the expected behavior.

## Frontend quality gates

From `src/clutch-web`:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm audit
```

Run the relevant existing browser regression tests alongside the focused journey. Require an independent OWASP Top 10 review of changed code and resolve findings. Report any failed or unavailable check explicitly; rerun affected checks after fixes.
