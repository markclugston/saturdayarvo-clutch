# Validation: Sticky List Headers (2026-11-28, revised behaviour)

Replaces the record for the first design (header held at the top of the content panel), which the
spec revision superseded.

## Quality gates (T020)

| Gate | Result |
|---|---|
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm test` | 1030 passed (64 files) |
| `npm run build` | Passed, with Vite's chunk-size warning |
| `npm audit --omit=dev` | 0 vulnerabilities |
| Style-guide browser states, full run | 430 passed and 2 failed: the assets keyboard test at 1440 px pressed Tab too few times to leave the visible rows. Test fixed, all 8 runs of it passed. |
| Mocked browser journeys (`playwright.config.ts`, all, includes `assets.spec.ts`) | 61 passed |
| Real-API browser journeys (`playwright.integration.config.ts`, all) | 38 passed |

The `.NET` gates were not run: no .NET code changed.

Tests-first: the hook tests and the changed component tests were run and seen to fail before
implementation. The browser tests were written after it.

## Success criteria (T019)

| Criterion | Evidence (Chromium, 1024 and 1440 px, Light and Dark, both lists) |
|---|---|
| SC-001 | Every 90 px from stopping to the end of the list: card at the panel's padding above and below, header in its resting place within the card and painted over the rows, rows moved by the distance scrolled. Same after a window resize and at 320 px scrolled sideways. |
| SC-002 | Wheel over the list reaches the last row with the panel only ever moving down; Page Down and Tab do too. Assets totals out of view until the end. |
| SC-003 | Content added after each group scrolls into view once its list ends. |
| SC-004 | A group that fits, and a 330 px high window, scroll as ordinary pages. `assets` and `assets-delete-dialog` screenshots match their baselines; `account-details`, `account-details-errors` and `delete-transaction-dialog` are pixel-identical to screenshots of the unchanged `TransactionsTable.tsx`. |
| SC-005 | axe WCAG 2.2 AA, surfaces, focus rings and Dark colour checks pass with each group stopped. Eight new baselines: `transactions-list-pinned`, `assets-list-pinned`. |

Also covered: keyboard focus is always fully showing and never paints over the header; a click on
a row control cut off at either edge works without moving the page; scrolling to a row, as find
in page does, moves the page with it; Load More is reached only at the end, has room for its focus
ring, and adds rows without moving those on screen.

Screenshot comparison (`STYLE_SCREENSHOTS=1`) is opt-in. The tracked `account-details` and
`account-details-errors` baselines predate this feature and no longer match; they were not
regenerated.

## Extension to the amortization schedule (T027, T028)

The results above are for the two-list build. These are for all three lists.

| Gate | Result |
|---|---|
| `npm run lint`, `npm run typecheck` | Passed |
| `npm test` | 1037 passed (64 files) |
| `npm run build` | Passed, with Vite's chunk-size warning |
| `npm audit --omit=dev` | 0 vulnerabilities |
| Style-guide browser states, full run | 460 passed |
| Longest-schedule test (417,000 weekly periods), added after that run | 4 passed |
| Mocked browser journeys, all | 61 passed |
| Real-API browser journeys, all | 38 passed, on ports 7190 and 5183: a debug session held 7180 and 5173, which the style-guide and mocked runs reused for the web server |

Tests-first: the new component and hook tests were seen to fail before implementation.

| Criterion | Evidence for the schedule (Chromium, 1024 and 1440 px, Light and Dark) |
|---|---|
| SC-001 | Plain and balance columns, at positions from stopping to the last period: card at the panel's padding, view switch and header in place, every row in view rendered in order. |
| SC-002 | Wheel and Page Down move the rows with the panel; period 360 fully visible at the end. |
| SC-003 | The schedule is the last item on its page; the shared behaviour is covered on the other lists. |
| SC-004 | A six-period schedule and a 330 px high window scroll as ordinary pages; the burndown card is not positioned and its screenshots are unchanged. No before/after screenshot of a fitting schedule was compared. |
| SC-005 | axe, surfaces, focus rings and Dark colour checks pass on the existing schedule states and at 320 px sideways. |

The 16 tracked `mortgages-schedule-forecast-*` screenshots were regenerated: they now show the
stopped card. Old and new were compared by eye for two of them, and a third new one inspected.

`/speckit-converge` (T030): converged, no tasks appended.

Found and fixed: under reduced motion the schedule's spacer rows resized a frame late, so the
list's height jumped and the panel moved by several hundred pixels (research R7).

## UI compliance checklist (T021, T029)

Rechecked for the schedule: every result below holds. Its changes add layout classes, one
`transition-none`, and a named focusable group with the shared focus ring; no text, token,
primitive, field or numeric column changed.

| Item | Result | Evidence |
|---|---|---|
| Only tokens used | Pass | Lint; only layout classes added |
| No borders or divider lines on layout containers | Pass | Lint; none added |
| Transitions within the allowed set; reduced motion respected | Pass | Lint; no transition or animation added; reduced-motion browser tests |
| Surface hierarchy | Pass | Header keeps `bg-raised` on the card; surface checks and screenshots |
| Existing primitives and variants, none restyled | Pass | Review: `Card` and `Button` unchanged; the card only gains positioning |
| Floating labels | N/A | No form fields changed |
| Title Case labels, sentence case text | Pass | Review: no visible text changed |
| % and $ shared formatted field | N/A | No entry fields changed |
| Numbers and their headers right aligned | Pass | Lint; component tests on Amount, Balance and Valuation headers |
| Navigation expand/collapse unchanged | Pass | Navigation browser tests |
| Dark theme: no pure black or white | Pass | Pinned-list Dark states |
| Both themes verified (screenshots) | Pass | Eight new baselines; one Light and one Dark inspected |
| WCAG 2.2 AA and contrast, both themes | Pass | axe on the pinned-list states, including 320 px sideways |
| Visible focus ring on every interactive element | Pass | Focus sweep (first 60 tab stops) on the pinned-list states; Load More room measured |
| Status not conveyed by colour alone | N/A | No status shown or changed |

Plan style-guide sections: §2–3, the content panel is the only vertical scroller and a stopped
group keeps its padding above and below; §6, the header keeps `bg-raised`; §7–9, no motion added
and SC 2.4.11 met as above.

Accessibility note: Load More and its error are now inside the "Transactions" region (research R6).

## Completion review

A separate pass by the implementing agent over the diff.

| Requirement | Result |
|---|---|
| ARC-001 | Pass: clutch-web only; only the two named lists change |
| ENG-001 | Pass: gates above |
| WEB-001 | Pass: checklist above |
| Perf & Observability | Pass: passive scroll listeners, one update per frame (plus one at once after focus or list scrolling); no user action or server behaviour added |
| Security (SEC-001..004 N/A in the plan) | No findings: no endpoint, input, secret, dependency, unsafe HTML, network call or newly disclosed data |

`/speckit-converge` (T022): converged, no tasks appended.

Not verified: browsers other than Chromium, and touch scrolling.
