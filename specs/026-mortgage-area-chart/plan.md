# Implementation Plan: Mortgage Area Chart

**Branch**: `026-mortgage-area-chart` | **Date**: 2026-11-24 | **Spec**: [spec.md](spec.md)

## Summary

Redraw the Mortgage Burndown (`BurnDownChart.tsx`) as an area chart: each series is a monotone-smoothed line through the same plotted points, stroked and filled with a left-to-right SVG gradient built from four new chart tokens (Bank Schedule blue→purple, Actual Balance teal→cyan), Actual Balance still dashed. Add one shared hover label (band, rings, HTML label) driven by the pointer or the keyboard (focusable chart group, Arrow/Home/End/Page keys, Escape), with a polite live region announcing keyboard moves only. Pure geometry helpers (smoothing, nearest date, year step, pointer-to-viewBox) live in a new `chartGeometry.ts` with unit tests.

## Technical Context

**Baseline**: Existing stack and decisions (`docs/code-map.md`). The chart is hand-built SVG in `BurnDownChart.tsx`; no chart library.

**Feature-specific changes**:
- Tokens (code first, `index.css`, both themes): `--chart-schedule-start`, `--chart-schedule-end`, `--chart-actual-start`, `--chart-actual-end`, exposed as `--color-chart-schedule-start` … and added to `TOKEN_COLOURS` in `eslint-rules/clutch-style.js` (+ rule test). Values: [research.md](research.md) R1.
- `BurnDownChart.tsx`: gradients, filled areas, smoothed paths, legend samples, hover band/rings/label, keyboard handling, live region. Points, axes, messages, text alternative unchanged (FR-001, FR-011).
- New `chartGeometry.ts` (pure functions). No new packages, endpoints, data or schema.
- Existing tests that find the chart by `polyline` (`BurnDownChart.test.tsx`, `LoanPayoffTimeline.test.tsx`, `MortgagesPage.test.tsx`, `e2e/mortgages.spec.ts`, `e2e/style-guide.spec.ts` reach states) move to the contract's `path[data-series][data-part]` selectors.
- Style guide: `clutch-ui-style/references/forms-components.md` §5 Charts updated for the gradient series tokens (the burndown's series), keeping `primary`/`primary-tint`/`accent-navy` as the series colours for other charts, then `scripts/sync-agent-config.ps1 -From claude`.

**Performance Goals**: SC-003 hover ≤ 100 ms at 1,560 periods: binary search over precomputed x positions; paths memoised on schedule/points/axis, so pointer moves re-render only the overlay. Gate: a Playwright test measures pointer move to label shown in the browser at 1,560 periods (the jsdom component timing is an early warning only).

**Constraints**: Desktop only (no touch). Text alternative and `role="img"` name stay as 024 (e2e locators depend on them). No transitions on the overlay (reduced motion satisfied by having none).

**Scale/Scope**: One component, one new helper module, tokens, lint list, style-guide reference.

## Constitution Check

*GATE: passed before Phase 0; re-checked after Phase 1 — no change.*

| ID | Applies | How the plan complies | Gate / evidence | Status |
|----|---------|-----------------------|-----------------|--------|
| ARC-001 | Yes | Only the requested chart treatment and hover label; reference header, controls, footer excluded (FR-012). UI stays in clutch-web. | Review | Pass |
| DOT-001 | No | No .NET change. | — | N/A |
| DOT-002 | No | No database access change. | — | N/A |
| AUD-001 | No | No audit records. | — | N/A |
| ENG-001 | Yes | Unit tests for `chartGeometry.ts`; component tests for series, legend, label values, keyboard, live region, pointer/keyboard ownership; e2e and style-guide browser tests (contrast along gradients, axe, screenshots, 320 px, reduced motion). | Lint, typecheck, vitest, Playwright (mocked + style-guide), build, `npm audit --omit=dev` | PENDING |
| OPS-001 | No | No service, logging or migration change. | — | N/A |
| SEC-001 | No | No endpoint, auth or input change; keyboard/pointer input is local UI state only. | Completion security review (required for every completion) | N/A |
| SEC-002 | No | No secrets. | — | N/A |
| SEC-003 | Yes | Hover label shows balances already on screen in the schedule; nothing logged, stored or sent; live region text stays in the page. | Security review | Pass |
| SEC-004 | No | No data entry. | — | N/A |
| WEB-001 | Yes | Tokens first (`index.css`, lint list, rule test, browser tests), Title Case legend/label names, right-aligned label amounts (`text-right tabular-nums`), WCAG 2.2 AA (focus ring, keyboard, 4.1.3 status, 1.4.11 line contrast, 1.4.10 at 320 px), no new primitive; label styled like the tooltip popup surface. | Frontend gates, UI compliance checklist below | PENDING |
| Perf & Observability | Yes (performance); metrics N/A | Hover/keyboard feedback is synchronous (< 100 ms, SC-003). The OpenTelemetry metrics clause covers user-initiated actions and service behaviour; hover and keyboard here change only transient client-side view state, start no request and change no data, and clutch-web has no telemetry pipeline, so no metric is added. | Browser latency test at 1,560 periods (component timing as early warning) | PENDING |

**Style guide sections**: §5 Charts (tokens, faint guides), §6 tokens, §7–9 (Title Case, motion, contrast, focus), §11 checklist.

**UI compliance checklist** (`clutch-ui-style/references/compliance-checklist.md`):

| Item | Check | Plan |
|---|---|---|
| [ ] Only tokens used: no raw colours, default palette, non-token radius, extra ring or shadow, or `dark:` colour | Lint | Gradient stops use `text-chart-*` + `stopColor="currentColor"`; label uses `bg-raised text-fg rounded-control shadow-float` |
| [ ] No borders or divider lines on layout containers (hairline utilities only) | Lint, Review | None added |
| [ ] Transitions, durations and easing within the allowed set; `prefers-reduced-motion` respected | Lint, Browser | Overlay has no transitions; browser test under reduced motion |
| [ ] Surface hierarchy follows canvas, content, card, raised | Browser, Review | Chart on card; label on raised |
| [ ] Built from existing primitives and variants; none restyled ad hoc | Review | Label is an in-chart overlay, not the hover-trigger `Tooltip` (R5); reuses the tooltip popup's token classes |
| [ ] Form fields use floating labels | Review | N/A — no fields |
| [ ] Labels, headings and button text use Title Case; helper, error and body text use sentence case | Review | "Bank Schedule", "Actual Balance"; instructions sentence case |
| [ ] % and $ fields use the shared formatted field | Component | N/A — no entry fields |
| [ ] Numbers and currency amounts, and their column headers, are right aligned (`text-right`, `tabular-nums`) | Lint, Component, Review | Label amounts in a right-aligned column |
| [ ] Navigation expand/collapse behaviour unchanged | Browser | Unchanged |
| [ ] Dark theme has no pure black surface or pure white text | Browser | Tokens only |
| [ ] Both themes verified (screenshots) | Browser | Updated burndown screenshots + hovered-label screenshots, both themes, 320 px |
| [ ] WCAG 2.2 AA (axe) and contrast pass in both themes | Browser | axe with label shown; sampled gradient contrast ≥ 3:1 (SC-002) |
| [ ] Visible focus ring on every interactive element | Browser | `focus-visible:focus-ring` on chart group; focused-group screenshot and ring style check, both themes |
| [ ] Status not conveyed by colour alone | Review | Dashed vs solid lines; label names each series |

## Project Structure

### Documentation (this feature)

```text
specs/026-mortgage-area-chart/
├── plan.md
├── research.md
├── data-model.md        # view-state only, no schema
├── quickstart.md
├── contracts/
│   └── burndown-chart-ui.md
└── tasks.md             # /speckit-tasks output
```

### Source Code (files this feature touches)

```text
src/clutch-web/src/index.css                                  # 4 chart tokens, both themes
src/clutch-web/eslint-rules/clutch-style.js                   # TOKEN_COLOURS += chart-schedule-*/chart-actual-*
src/clutch-web/eslint-rules/clutch-style.test.js              # accepts new tokens
src/clutch-web/src/features/mortgages/chartGeometry.ts        # NEW: monotone path, area path, nearest index, year step, pointer→viewBox
src/clutch-web/src/features/mortgages/chartGeometry.test.ts   # NEW
src/clutch-web/src/features/mortgages/BurnDownChart.tsx       # area treatment, legend, single dot, hover overlay, keyboard, live region
src/clutch-web/src/features/mortgages/AmortizationSchedule.tsx # closing balance uses the shared cents formatter (label = table, FR-007)
src/clutch-web/src/features/mortgages/BurnDownChart.test.tsx  # new behaviour; existing assertions updated (polyline → path)
src/clutch-web/src/features/mortgages/LoanPayoffTimeline.test.tsx # existing polyline locators → contract path selectors
src/clutch-web/src/features/mortgages/MortgagesPage.test.tsx  # existing polyline locators → contract path selectors
src/clutch-web/e2e/mortgages.spec.ts                          # series locators; hover + keyboard journey; hover latency (SC-003)
src/clutch-web/e2e/style-guide.spec.ts                        # existing burndown reach-state locators; gradient contrast, success hue, axe with label, focus ring, screenshots, reduced motion, 320 px
.claude/skills/clutch-ui-style/references/forms-components.md # §5 Charts: gradient series tokens (+ .github mirror via sync script)
```

**Structure Decision**: Existing layout; pure helpers beside the component, following `scheduleCalculation.ts` / `repaymentDates.ts`.

## Complexity Tracking

| Deviation | Why needed | Simpler alternative rejected because |
|---|---|---|
| Performance & Observability: no OpenTelemetry metric added | Hover and keyboard change only transient client-side view state; no request, no data change, no service behaviour. clutch-web has no telemetry pipeline (023 and 024 took the same position). | Adding a client telemetry pipeline for a hover overlay is out of scope (ARC-001) and would send usage of balance views off-device (SEC-003). If the constitution's metrics clause is meant to cover client-only UI state, it needs a scoped amendment via `/speckit-constitution`; this plan does not change the constitution. |
