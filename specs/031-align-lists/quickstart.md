# Quickstart: Validate Align Existing Lists

Run from `src/clutch-web`. Expected: every command passes.

```powershell
npm run lint
```

```powershell
npm test -- --reporter=dot
```

```powershell
npm run build
```

```powershell
npx playwright test accounts-transaction-delete accounts-import assets mortgages --reporter=line
```

```powershell
npm run test:e2e:style-guide -- --reporter=line
```

```powershell
npm audit --omit=dev
```

Agent config, from the repository root:

```powershell
.\scripts\sync-agent-config.ps1 -Check
```
