# Quickstart: Dark Theme Validation

## Prerequisites

- Node.js and npm versions supported by `src/clutch-web`.
- Frontend dependencies installed in `src/clutch-web` (`npm ci` if they are not already installed).
- For browser e2e checks, the Playwright Chromium browser installed and the API available as required by the existing e2e fixtures.

## Run Frontend Checks

From `src/clutch-web`:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

Expected result: each command completes successfully with no type errors, lint warnings, failing tests, or build errors.

## Run Browser Validation

Run the existing Playwright suite:

```powershell
npm run test:e2e
```

Expected result: existing browser journeys pass. For every route and shared surface listed in the coverage record below, run the dark-mode checks and a light-theme preservation pass. The theme class must be present only when the system preference is dark, absent for the light fallback, and updated when that preference changes.

## Accessibility and Visual Checklist

Complete the coverage record for every existing screen and shared UI area; do not treat a representative sample as full coverage. For each row, verify:

- axe-core's WCAG color-contrast checks pass in dark mode.
- Normal text pairs meet at least 4.5:1; large text pairs meet at least 3:1.
- Meaningful component/state indicators and boundaries meet applicable 3:1 non-text contrast after alpha compositing.
- Main content, navigation, and adjacent sections have distinguishable surfaces or spacing without distracting dividers.
- Keyboard focus, hover, selected, disabled, error, and status states are perceivable; status/error meaning is not conveyed by color alone.
- Narrow viewport layouts remain usable and keyboard navigable.
- The light theme and OS-preference-driven theme behavior remain unchanged.

Use this table as the single coverage record. In each check cell, enter `PASS` or `FAIL` followed by a concise evidence reference, such as a Playwright test/assertion, axe result, or manual viewport and control-state observation. For each hierarchy review, record the adjacent section pair and either the distinct semantic surface tokens used by those sections or the spacing treatment that separates them; include the measured gap when spacing is the evidence. A hierarchy check passes only when every reviewed adjacent section pair has one of these evidence entries, the boundary is apparent without a bright or distracting divider, and any boundary that conveys meaning meets the applicable non-text contrast requirement. For a failure, reference the issue or test that tracks it. Add a row before completing the review if an existing screen or shared surface is not represented. The review is complete only when every check cell for every listed or added row is `PASS` with an evidence reference and no acceptance failures remain.

| Screen or shared surface | Dark palette and contrast | Hierarchy and states | Narrow viewport and keyboard | Light theme preserved |
|---|---|---|---|---|
| Session loading and error states | | | | |
| Authentication | | | | |
| Family | | | | |
| Accounts, account details, and transactions | | | | |
| Import, mapping, and review | | | | |
| Administrator import limits | | | | |
| Shared header/navigation, dialogs, menus, forms, tables, and controls | | | | |

Refer to [the UI contract](./contracts/theme-ui.md) for user-observable behavior and [the data model](./data-model.md) for the existing state and token roles.
