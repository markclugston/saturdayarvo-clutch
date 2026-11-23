# Quickstart: Mortgage Area Chart validation

Run from `src/clutch-web`.

## Per task

```powershell
npx vitest related src/features/mortgages/BurnDownChart.tsx src/features/mortgages/chartGeometry.ts --run --reporter=dot
```

## Phase end

```powershell
npm run lint
```

```powershell
npm run typecheck
```

```powershell
npm test -- --reporter=dot
```

## Completion

```powershell
npx playwright test e2e/mortgages.spec.ts --reporter=line
```

```powershell
npx playwright test --config playwright.style-guide.config.ts -g "burndown|tooltip|reduced motion" --reporter=line
```

```powershell
npm run build
```

```powershell
npm audit --omit=dev
```

Screenshot baselines for the burndown change intentionally; regenerate them once with `--update-snapshots` on the style-guide config, review the images, then rerun without the flag.

## Expected outcomes

| Scenario | Evidence |
|---|---|
| Same plotted points (FR-001, SC-005) | Component test: path vertices equal the 023/024 point lists |
| No overshoot (FR-005) | `chartGeometry.test.ts`: control points stay within neighbouring y values |
| Gradients and fills (FR-002, FR-003) | Component test: gradient stops use the four tokens; area paths close at y($0), incl. negative Actual Balance |
| Line contrast ≥ 3:1 (FR-004, SC-002) | Style-guide test samples each gradient in both themes |
| Label values (FR-007, FR-008, SC-001) | Component test: each hovered date's amounts equal the schedule table text; no Actual Balance on blank rows |
| Keyboard (FR-009, SC-004) | Component test: focus shows nothing; Right/Home → first, Left/End → last, Page Down/Up ≈ ±1 year, Escape hides; status text only after keys |
| Shared ownership (FR-009a) | Component test: pointer then key continues; keyboard label survives pointer leave; blur hides |
| Inside chart, reduced motion, 320 px (FR-010) | Style-guide test: label box within chart box at first/last dates, both themes, 320 px, reduced motion |
| 100 ms at 1,560 periods (SC-003) | Browser test in `e2e/mortgages.spec.ts` times pointer move to label shown on a mocked 1,560-period schedule; the component timing is an early warning only |
| axe WCAG 2.2 AA with label shown | Style-guide test, both themes |
