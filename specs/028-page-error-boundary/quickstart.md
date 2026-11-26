# Quickstart: Page Error Boundary

Run from `src/clutch-web`.

```powershell
npx vitest run PageErrorBoundary App.errorBoundary --reporter=dot
```

```powershell
$env:CLUTCH_E2E_WEB_PORT='5187'; npx playwright test e2e/error-boundary.spec.ts --reporter=line --output=test-results/028
```

```powershell
npm run lint; npm test; npm run build; npm audit --omit=dev
```

Expected: all pass; the browser spec covers both themes (FR-001–FR-008).
