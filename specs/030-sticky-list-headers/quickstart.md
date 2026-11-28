# Quickstart: Sticky List Headers validation

Run from the repository root. Behaviour is in [spec.md](./spec.md); markup and hook in [contracts/pinned-list-ui.md](./contracts/pinned-list-ui.md).

```powershell
cd src/clutch-web; npm run lint; npm run typecheck; npm test -- --reporter=dot; npm run build
```

Expected: pass. Unit and component tests prove the height limit, spacer, scroll mapping in both directions, focus handling and the markup of all three lists.

```powershell
cd src/clutch-web; npx playwright test -c playwright.style-guide.config.ts --reporter=line
```

Expected: pass in Light and Dark. The pinned-list states prove, for transactions and assets:
- the group stops with the panel's margin above and below, with its header in place, at every position to the end of the list (SC-001);
- wheel and keyboard scrolling reach every row, and the assets totals only at the end (SC-002);
- content after the group scrolls into view (SC-003);
- a group that fits, and a short panel, behave as before (SC-004);
- sideways scrolling at 320 px, keyboard focus, clicks, find-style scrolling, Load More and resizing;
- axe WCAG 2.2 AA and screenshots pass with each group stopped (SC-005);
- the amortization schedule does the same, and the burndown chart view is unchanged.

```powershell
cd src/clutch-web; npx playwright test e2e/assets.spec.ts --reporter=line
```

```powershell
cd src/clutch-web; npx playwright test -c playwright.integration.config.ts --reporter=line
```

Expected: existing journeys still pass. The second needs Docker and the real API.
