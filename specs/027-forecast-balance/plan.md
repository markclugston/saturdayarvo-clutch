# Implementation Plan: Forecast Balance

**Branch**: `027-forecast-balance` (feature name; the branch does not exist yet and these documents are on `main`) | **Date**: 2026-11-26 | **Spec**: [spec.md](spec.md)

## Summary

A pure function projects the last Actual Balance forward by the median recent per-period reduction; `useActualBalances` returns it so the schedule's new "Forecast Balance" column and the Burndown share one calculation. The chart draws it as a solid orange line and soft area, and adds it to the legend, hover label and text alternative. Frontend only. Revised after review (research.md R9–R12, including the other series' colours), with an accepted accessibility exception (Complexity Tracking).

## Technical Context

**Baseline**: Existing stack and decisions (`docs/code-map.md`). The chart is hand-built SVG in `BurnDownChart.tsx`.

**Feature-specific changes**:
- New `forecastBalances.ts` ([data-model.md](data-model.md), research.md R1–R3).
- `actualBalances.ts`: returns `forecast`; point type and builder renamed to serve both series.
- `AmortizationSchedule.tsx`: second account column; wider minimum width when linked (R7).
- `BurnDownChart.tsx`: third series ([contract](contracts/forecast-balance-ui.md), R6 legend positions, R9–R12). Axis unchanged: forecast values always fall inside it.
- Tokens code first: `--chart-forecast-start/-mid/-end` in both themes (R12), exposed as `--color-chart-forecast-*` and added to the lint rule's token list and its test; `--chart-hatch-opacity/-width` for the Bank Schedule stripes (R10).
- Existing tests whose balances now produce a forecast (line counts, legend positions, header lists) are updated.
- No packages, endpoints, schema or .NET change.

**Performance Goals**: SC-003: forecast shown within 500 ms of the balances at 1,560 periods; one memoised linear pass.

**Constraints**: Actual Balance and Bank Schedule values unchanged; their colours, gradient range and fill edges changed after review (R9–R12). Chart stays desktop only.

**Scale/Scope**: One new helper, three components or hooks, tokens, lint list, tests, two guidance files.

## Open Issues

Found on `main` before this feature (research.md R8). Decided by the user on 2026-11-26: both are fixed separately, in the session "Fix Burndown chart contrast and style guide".

1. **Failing gate**: the burndown gradient contrast and hue browser test fails in both themes since `c9f8e62`. The fix adds the same casing (R4) to the existing lines, dot and rings, measures them against the card, replaces the green middle Actual Balance colour and darkens the Light amber end.
2. **Guidance conflict**: style guide §5 disagrees with `BurnDownChart.tsx`. The code is right; the fix updates §5.

**Withdrawn (user decision, 2026-11-26)**: both issues are closed by the accepted exception and the §5 update, and the fix below is not to be merged, as it would change the chart. The text is kept as history.

**Dependency** (not yet merged on 2026-11-26): that fix must be merged into the branch this feature is implemented on (`main`, or `027-forecast-balance` if created) before implementation, as it changes the same chart, test and guidance files. Then recheck the forecast colours against the new Actual Balance colours (R5), and extend its casing rather than adding a second pattern. "Actual Balance and Bank Schedule unchanged" means unchanged from the fixed chart.

## Constitution Check

*GATE: passed for design before Phase 0; re-checked after Phase 1 — no change. The Open Issues dependency blocks implementation, not task generation.*

| ID | Applies | How the plan complies | Gate / evidence | Status |
|----|---------|-----------------------|-----------------|--------|
| ARC-001 | Yes | Only the requested column and series; pure calculation separate from components; UI in clutch-web | Review | PASS |
| DOT-001 | No | No .NET change | — | N/A |
| DOT-002 | No | No database access change | — | N/A |
| AUD-001 | No | No audit records | — | N/A |
| ENG-001 | Yes | Unit, component, browser and lint-rule tests for every behaviour change | 2026-11-26: lint, typecheck, build pass; vitest 785 pass (`LoanDetailsForm` "name too long", unchanged here, has timed out in some full runs); style-guide Playwright 254 pass and 4 fail ("gradient contrast and hue", since removed under the accepted exception), chart subset rerun after the removal 70 pass, 0 fail; mocked Playwright 42 pass. Final rerun on the combined working tree (with the error boundary, header and slow-test work): lint, typecheck, build pass, `npm audit --omit=dev` 0 vulnerabilities, vitest 798 pass, style-guide Playwright 274 pass (full-page screenshot comparison off), mocked Playwright 46 pass; integration run 2026-11-26 once the ports were free: 35 pass including all 6 `mortgages.spec.ts` journeys, 1 fail: `import-settings.spec.ts` "saves, reuses, edits, and exposes defaults" finds two `status` messages (failed 3 of 3 runs: a test fault outside this feature). Fixed by finding the message by its text; integration then 36 pass, 0 fail, with lint and typecheck passing. After the other sessions finished, every gate was rerun on the final working tree: lint, typecheck and build pass, `npm audit --omit=dev` 0 vulnerabilities, vitest 802 pass, style-guide Playwright 274 pass (full-page screenshot comparison off), mocked Playwright 51 pass, integration Playwright 36 pass | PASS |
| OPS-001 | No | No service, logging or migration change | — | N/A |
| SEC-001 | No | No endpoint, auth, input or dependency change | Independent review (separate agent) 2026-11-26: one Low finding, the chart crashed past about 124,000 periods; fixed with a component test (T028). `npm audit --omit=dev`: 0 vulnerabilities. Pre-existing, not fixed here: no React error boundary; no size limit on balance strings or array in the client schema | N/A |
| SEC-002 | No | No secrets or configuration | — | N/A |
| SEC-003 | Yes | Derived in the browser from balances already shown; nothing logged, stored or sent | Independent review 2026-11-26: no logging, storage, new request or disclosure | PASS |
| SEC-004 | No | No data entry; balances are already schema-validated by the API client | — | N/A |
| WEB-001 | Yes | Tokens first, Title Case names, right-aligned amounts, existing keyboard and announcements. Every series reaches 3:1 on the card. Contrast over the filled areas, the Actual Balance hue and colour-only legend samples are an accepted exception (Complexity Tracking) | Frontend gates, UI checklist below (validated 2026-11-26) | PASS with recorded exception |
| Perf & Observability | Yes (performance and observability) | Derived with the balances, under 500 ms. No OpenTelemetry metric: a recorded deviation (Complexity Tracking) | Column and chart timing tests at 1,560 periods pass | PASS |

**Style guide sections**: §5 Charts, §6 tokens, §7–9 (Title Case, motion, contrast, focus), §11 checklist.

**UI compliance checklist** (`clutch-ui-style/references/compliance-checklist.md`):

Validated 2026-11-26. Unchecked items are covered by the accepted exception (Complexity Tracking).

| Item | Check | Plan and evidence |
|---|---|---|
| [x] Only tokens used: no raw colours, default palette, non-token radius, extra ring or shadow, or `dark:` colour | Lint | Lint passes; `text-chart-forecast-*` stops, stripe strength from tokens |
| [x] No borders or divider lines on layout containers (hairline utilities only) | Lint, Review | None added |
| [x] Transitions, durations and easing within the allowed set; `prefers-reduced-motion` respected | Lint, Browser | No motion added; reduced-motion browser tests pass |
| [x] Surface hierarchy follows canvas, content, card, raised | Browser, Review | Unchanged; style-guide states pass |
| [x] Built from existing primitives and variants; none restyled ad hoc | Review | Existing table, legend, label and ring patterns |
| [x] Form fields use floating labels | Review | N/A — no fields |
| [x] Labels, headings and button text use Title Case; helper, error and body text use sentence case | Review | "Forecast Balance" |
| [x] % and $ fields use the shared formatted field | Component | N/A — no entry fields |
| [x] Numbers and currency amounts, and their column headers, are right aligned (`text-right`, `tabular-nums`) | Lint, Component, Review | New header, cells and label amount; component tests pass |
| [x] Navigation expand/collapse behaviour unchanged unless an approved spec amends it | Browser | Unchanged; browser tests pass |
| [x] Dark theme has no pure black surface or pure white text | Browser | Style-guide Dark states pass |
| [x] Both themes verified (screenshots) | Browser | All 32 forecast screenshots reviewed (chart, hover and table, including 320 px) |
| [ ] WCAG 2.2 AA (axe) and contrast pass in both themes | Browser | axe and the card contrast tests pass; exception: contrast over the filled areas |
| [x] Visible focus ring on every interactive element | Browser | No new interactive element; focus checks pass |
| [ ] Status not conveyed by colour alone | Review | Label names each series; exception: legend samples differ only by colour |

Seen in the 320 px screenshots and not changed by this feature: the app header's logo overlaps the Theme field and buttons.

## Project Structure

### Documentation (this feature)

```text
specs/027-forecast-balance/
├── plan.md
├── research.md
├── data-model.md        # derived values only, no schema
├── quickstart.md
├── contracts/
│   └── forecast-balance-ui.md
└── tasks.md             # /speckit-tasks output
```

### Source Code (files this feature touches)

```text
src/clutch-web/src/features/mortgages/forecastBalances.ts                  # NEW
src/clutch-web/src/features/mortgages/forecastBalances.test.ts             # NEW
src/clutch-web/src/features/mortgages/actualBalances.ts                    # forecast in the hook; BalancePoint rename
src/clutch-web/src/features/mortgages/actualBalances.test.ts
src/clutch-web/src/features/mortgages/AmortizationSchedule.tsx             # Forecast Balance column; scroll anchoring off
src/clutch-web/src/features/mortgages/AmortizationScheduleAccount.test.tsx
src/clutch-web/src/features/mortgages/BurnDownChart.tsx                    # series, legend, label, text alternative
src/clutch-web/src/features/mortgages/BurnDownChart.test.tsx
src/clutch-web/src/features/mortgages/MortgagesPage.test.tsx               # column and refresh assertions
src/clutch-web/src/features/mortgages/LoanPayoffTimeline.test.tsx          # series line count
src/clutch-web/src/index.css                                               # series and stripe tokens, both themes
src/clutch-web/eslint-rules/clutch-style.js                                # TOKEN_COLOURS += chart-forecast-*
src/clutch-web/eslint-rules/clutch-style.test.js
src/clutch-web/e2e/style-guide.spec.ts                                     # forecast fixture, states, contrast tests, scroll test, screenshots
src/clutch-web/e2e/mortgages.spec.ts                                       # linked-account journey: new column
.claude/skills/clutch-ui-style/references/forms-components.md              # §5 forecast series (+ .github mirror via sync script)
docs/code-map.md                                                           # pointer to forecastBalances.ts
```

**Structure Decision**: Existing layout; pure helper beside the hook, following `chartGeometry.ts`.

## Complexity Tracking

| Deviation | Why needed | Simpler alternative rejected because |
|---|---|---|
| Performance & Observability: no OpenTelemetry metric added | The forecast is display-only derivation with no request, data change or service behaviour (024 and 026 took the same position) | A client telemetry pipeline is out of scope (ARC-001) and would send usage of balance views off-device (SEC-003) |
| ARC-001: the Amortization Schedule turns off scroll anchoring, which no 027 requirement asks for | Found while testing the forecast rows: ordinary scrolling bounced. The user asked for it to be fixed in the same session (2026-11-26); a browser test covers it | A separate change would touch the same uncommitted files |
| **Exception (user decision, 2026-11-26; permanent, not to be revisited)**, WEB-001 and 026 FR-002 and FR-004, for the Mortgage Burndown only: (1) series lines may be below 3:1 against the filled areas behind them (WCAG 2.2 SC 1.4.11); (2) the Actual Balance green may match the success colour's hue; (3) legend samples may differ by colour alone (SC 1.4.1) | The user chose to keep the built colours, fills, solid lines and legend after seeing options for changing them. Still required: every series 3:1 against the card (browser test), axe, the forecast's distinct colours, and series names in the legend, hover label and text alternative | Fainter fills washed the chart out; a dotted forecast fill or names beside the lines change the look the user chose |
