# Quickstart: Validation

Run from `src/clutch-web`. Script names come from `package.json`; read it rather than assuming.

## Component tests

```bash
npx vitest related src/components/ui/app-shell.tsx src/components/ui/side-nav.tsx src/App.tsx --run --reporter=dot
```

Expect: `AppShell` applies the 4rem/10rem columns only for `navExpanded` at `md:`; `SideNav` keeps `w-16`/`w-40` below `md`; triggers and Escape are unchanged.

## Browser tests

```bash
npx playwright test e2e/navigation.spec.ts --reporter=line
```

Expect, in Light, Dark and System:

| Viewport | Expand | Collapse |
|---|---|---|
| 1280, 1920, 768 | Main left edge moves right and width shrinks by the nav growth (96px); nav does not cover content | Main section returns to the compact position and width |
| 767, 320 | Nav overlays; main geometry unchanged; no page horizontal scroll | Overlay removed |

Also asserted: focus and typed value survive expand and collapse; repeated hover at the nav edge settles without oscillation; reduced-motion emulation applies the final size with no transition; no seam between nav and content.

## Quality gates (completion)

```bash
npm run lint
npm run test
npm run build
npm audit --omit=dev
```

Style guide change: run `.\scripts\sync-agent-config.ps1 -From claude` after editing `layout-navigation.md`.
