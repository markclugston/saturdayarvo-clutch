# Implementation Plan: Actual Balance Chart Line

**Branch**: `024-actual-balance-chart-line` | **Date**: 2026-11-23 | **Spec**: [spec.md](spec.md)

## Summary

The Mortgage Burndown plots a second, dashed `chart-navy` "Actual Balance" series on top of the solid Bank
Schedule line, one point per non-blank Actual Balance cell at its row's date. The chart reads balances through
the same hook and query key as the Actual Balance column (R1), so values, loading, errors and live updates match
the column. The balance axis grows to hold actuals above the Opening Balance or below $0 (R3). Client-only
change: no server, endpoint, schema or package change.

## Technical Context

**Baseline**: The existing stack and settled decisions in the code (see `docs/code-map.md`).

**Feature-specific changes**:

- New `src/features/mortgages/actualBalances.ts`: `useActualBalances(accountId, scheduleParams)` (account lookup
  + `usePeriodBalances`, moved from `AccountSchedule`) and pure `actualBalancePoints(balances, schedule)`, see
  [data-model.md](data-model.md).
- `AmortizationSchedule.tsx`: `AccountSchedule` uses `useActualBalances`; column output unchanged.
- `BurnDownChart.tsx`: new `accountId`, `duration` and `paymentFrequency` props (the last two build the same
  balances request key as the table); Actual Balance polyline or single dot, second legend entry, axis
  range with negatives (R3), extended text alternative (R5); Bank Schedule class `text-primary` →
  `text-chart-primary` (same colour); with a negative axis, guides follow the ticks (R3). Contract: [contracts/burndown-chart-ui.md](contracts/burndown-chart-ui.md).
- `LoanPayoffTimeline.tsx`: passes `accountId` and the calculation's `duration` and `paymentFrequency` to
  `BurnDownChart`.
- Supersedes 016 FR-018 (single series) and 023's "Actual Balance not plotted" assumption.

**Performance Goals**: SC-004: both lines within 500 ms of the column's values, up to 1,560 periods; one shared
cached response, one `useMemo` pass (R6).

**Constraints**: No line whenever the Bank Schedule is not plotted (FR-005). No chart message for loading or
failure (FR-009). Chart without an account identical to today (SC-002). No status colours.

**Scale/Scope**: One new module, three component edits, their tests, e2e and style-guide snapshots.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| ID | Applies | How the plan complies | Gate / evidence | Status |
|----|---------|-----------------------|-----------------|--------|
| ARC-001 | Yes | UI-only in clutch-web; pure point mapping separate from React; only the spec'd series, legend entry, axis range and text alternative. | Review | PASS (design) |
| DOT-001 | No | No C# change. | N/A | N/A |
| DOT-002 | No | No database access or schema change. | N/A | N/A |
| AUD-001 | No | No audit reads or writes. | N/A | N/A |
| ENG-001 | Yes | Vitest: `actualBalances.test.ts` (points: blanks skipped, no Disbursal Date point, trailing blanks, negatives, mapping to schedule dates; hook: status none/loading/failed/ready, missing account as none, currency fallback, shared request key); `BurnDownChart.test.tsx` (dashed `text-chart-navy` line on top, single dot, legend present/absent, axis above Opening Balance and below $0 with $0 tick, text alternative for both/one/none, loading/failed draw no line and no message, no-account output unchanged, 1,560-period timing); `AmortizationSchedule*.test.tsx` (unchanged behaviour after refactor); `LoanPayoffTimeline.test.tsx`/`MortgagesPage.test.tsx` (account change, None, import/delete invalidation, Detail edits redraw). Playwright `mortgages.spec.ts` (line with linked account) and `style-guide.spec.ts` (two-line chart, both themes, 320 px). | Test tasks, quality gates (`npm run lint`, `typecheck`, `test`, `test:e2e`, `test:e2e:style-guide`, `build`) | PENDING |
| OPS-001 | No | No service or migration change; nothing logged. | N/A | N/A |
| SEC-001 | Yes (marginal) | No endpoint, auth or dependency change; reuses the existing owner-scoped period-balances endpoint. | Independent OWASP Top 10 and dependency review over the diff | PENDING |
| SEC-002 | No | No configuration or secrets. | N/A | N/A |
| SEC-003 | Yes | Balances shown only in the owner's session from the existing endpoint (FR-010); never logged, stored or put in error text; failure adds no message. | Security review | PENDING |
| SEC-004 | Yes (unchanged) | No new inputs or validation paths. | Security review | PASS |
| WEB-001 | Yes | TypeScript; series colours via `text-chart-primary`/`text-chart-navy` and `currentColor` (no raw colours, passes `clutch/style-tokens`); dash plus colour plus legend label so colour is not the only cue; `role="img"` text alternative names both series; Title Case "Actual Balance". | Frontend gates, UI compliance checklist | PENDING |
| Perf & Observability | Yes | Chart renders synchronously from cached data (< 500 ms, timing test). No server behaviour, so no new OpenTelemetry metric. | 500 ms feedback test | PENDING |

**Applicable style guide sections**: §5 Components (chart inside the existing card), §6 Tokens (`chart-primary`,
`chart-navy`; no status colours), §7 Typography (axis and legend label sizes unchanged), §9 Accessibility (text
alternative, colour not the only cue, both themes, 320 px).

**UI compliance checklist** (style guide §11):

- [x] Only tokens used: no raw colours, default palette, non-token radius, extra ring or shadow, or `dark:` colour
- [x] No borders or divider lines on layout containers (hairline utilities only)
- [x] Transitions, durations and easing within the allowed set; `prefers-reduced-motion` respected (no animation added)
- [x] Surface hierarchy follows canvas, content, card, raised
- [x] Built from existing primitives and variants; none restyled ad hoc
- [x] Form fields use floating labels (not applicable: no form field change)
- [x] Labels, headings and button text use Title Case; helper, error and body text use sentence case
- [x] % and $ fields use the shared formatted field (not applicable: no entry field)
- [x] Numbers and currency amounts, and their column headers, are right aligned (not applicable: no new table or field)
- [x] Navigation expand/collapse behaviour unchanged unless an approved spec amends it
- [x] Dark theme has no pure black surface or pure white text
- [x] Both themes verified (screenshots)
- [x] WCAG 2.2 AA (axe) and contrast pass in both themes
- [x] Visible focus ring on every interactive element (no new interactive element)
- [x] Status not conveyed by colour alone

**Post-design re-check (Phase 1)**: No violations. FR-004 and the loading/failure edge cases now state the
legend explicitly (R5); R4's `text-primary` → `text-chart-primary` swap is the same colour value, as SC-002
allows.

## Project Structure

### Documentation (this feature)

```text
specs/024-actual-balance-chart-line/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── burndown-chart-ui.md
└── tasks.md             # /speckit-tasks output
```

### Source Code (files this feature touches)

```text
src/clutch-web/
├── src/features/mortgages/actualBalances.ts               # new: useActualBalances, actualBalancePoints
├── src/features/mortgages/actualBalances.test.ts          # new
├── src/features/mortgages/AmortizationSchedule.tsx        # changed: uses useActualBalances
├── src/features/mortgages/AmortizationSchedule*.test.tsx  # changed only if refactor needs it
├── src/features/mortgages/BurnDownChart.tsx               # changed: second series, legend, axis, label
├── src/features/mortgages/BurnDownChart.test.tsx          # changed
├── src/features/mortgages/LoanPayoffTimeline.tsx          # changed: passes accountId
├── src/features/mortgages/LoanPayoffTimeline.test.tsx     # changed
├── src/features/mortgages/MortgagesPage.test.tsx          # changed: live updates of the line
├── e2e/mortgages.spec.ts                                  # changed: Actual Balance line
└── e2e/style-guide.spec.ts (+ snapshots)                  # changed: two-line chart, both themes
```

**Structure Decision**: Existing layout; `actualBalances.ts` is a sibling of `scheduleCalculation.ts`.

## Complexity Tracking

No constitution violations to justify.
