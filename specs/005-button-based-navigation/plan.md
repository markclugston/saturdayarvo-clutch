# Implementation Plan: Button-Based Navigation and Actions

**Branch**: `005-button-based-navigation` | **Date**: 2026-11-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification for button-based navigation and actions in `clutch-web`.

## Summary

Ensure every in-app navigation control and user-triggered action that could be presented as a hyperlink is an accessible, visibly button-like control with a hand cursor on hover. Preserve existing view transitions, action outcomes, permission checks, loading/error feedback, and theme behavior. The current app already uses native buttons and local React state for navigation; the design therefore focuses on a complete UI audit, consistent button styling, and executable regression/accessibility coverage rather than introducing a router or changing navigation semantics.

## Technical Context

**Language/Version**: TypeScript 5.9, React 19.3

**Primary Dependencies**: Vite 8, TanStack Query 5, Base UI React, Tailwind CSS 4, Vitest 5, Testing Library, Playwright, axe-core

**Storage**: No navigation storage. Existing server-backed data and signed-in theme preferences remain unchanged.

**Testing**: Vitest + Testing Library for component behavior; Playwright + axe-core for critical journeys, keyboard/accessibility, theme, and responsive checks. Existing scripts: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`.

**Target Platform**: `clutch-web` browser SPA; automated end-to-end coverage currently targets Chromium.

**Project Type**: Web application frontend.

**Performance Goals**: Every user-initiated navigation/action provides a visible response within 500 ms; longer work exposes a busy state and measurable progress where available.

**Constraints**: No anchor/hyperlink controls for navigation or actions; use native named buttons, preserve keyboard operation and focus visibility, use Tailwind/theme tokens, support responsive layouts and WCAG 2.2 AA, retain Light/Dark/System theme behavior, and avoid unrelated URL/history behavior.

**Scale/Scope**: All user-facing pages and controls in `src/clutch-web/src`; no API or database contract changes.

## Constitution Check

**Pre-research gate: PASS.** The feature is confined to the existing React frontend and can preserve current behavior without architectural or data-layer changes. The specification's manual-sounding independent-test descriptions will be fulfilled with agent-executable component, browser, and accessibility checks; human testing will not be a completion gate.

| Principle / requirement | Applicability and design compliance |
|---|---|
| I. Tooling, UI, and Architecture / ARC-001 | Applicable to UI scope: all work remains in `clutch-web`; no new application boundary, dependency registration, or architecture is required. |
| II. .NET Service Best Practices / DOT-001 | Not applicable: no .NET project or service changes. |
| III. Data Access, Async, and Performance / DOT-002 | Not applicable to database access: no query or migration changes. The separate UI response target is covered under Principle VII. |
| IV. Testing and Quality Gates / ENG-001 | Applicable: add behavior tests for changed controls and executable browser/accessibility coverage; run the relevant frontend checks. Manual-only testing is excluded. |
| V. Security and Error Handling / SEC-001 | Applicable to code changes: receive the constitution-required independent OWASP Top 10 review and resolve findings before completion. No security boundary or authorization behavior is intentionally changed. |
| V. Security and Error Handling / SEC-002, SEC-003 | Not applicable: no secrets, logging, payment, or sensitive diagnostic-data changes. |
| VI. Frontend Engineering / WEB-001 | Applicable: use strict TypeScript and Tailwind, retain shadcn/Base UI project patterns, native buttons, accessible names, keyboard access, responsive/light/dark support, WCAG 2.2 AA, component tests, and browser-level journey tests. |
| VII. Performance and Availability | Applicable to UI actions: meet the 500 ms visible-response rule and show busy/progress feedback for longer actions. Service availability is outside this feature's scope. |
| VIII. Observability | Not applicable: no long-running service task or telemetry change. |
| Engineering Requirements / OPS-001 | Not applicable: no service operations, logging, health-check, migration, rollback, or backfill change. |

No constitution violations or unresolved specification clarifications are identified. Form fields and native selection controls remain appropriate form controls; the button requirement applies to navigation and action controls, not to replacing every input with a button.

## Project Structure

### Documentation (this feature)

```text
specs/005-button-based-navigation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── ui-navigation.md
```

### Source Code (repository root)

```text
src/clutch-web/
├── src/
│   ├── App.tsx
│   ├── components/
│   │   ├── theme/
│   │   └── ui/
│   ├── features/
│   │   ├── accounts/
│   │   ├── admin/
│   │   ├── auth/
│   │   ├── families/
│   │   └── imports/
│   └── test/
└── e2e/
```

**Structure Decision**: Keep implementation and tests in the existing `src/clutch-web` frontend. Audit `App.tsx` and feature-page controls; share button styling through existing UI primitives and Tailwind classes. Add component tests beside affected components and browser tests in `e2e/`. The source scan found no anchor or `href` controls, but found button controls styled with underlines; those must remain visibly buttons. No new routing layer or API contract is planned.

## Design and Validation

1. Inventory all rendered navigation/action controls, including conditional and permission-gated views. Preserve their existing callbacks, destinations, disabled/pending states, and error responses.
2. Ensure controls use native buttons with clear accessible names, visible focus, and button styling. Apply the required pointer cursor on hover consistently, including buttons outside the shared primitive. Move focus to the destination's primary heading after a view transition so keyboard users retain context when the originating button is removed.
3. Keep existing local view state and callback navigation. Do not introduce URL routing, browser-history entries, or a router dependency.
4. Verify button roles/names, keyboard activation, and destination-heading focus through Testing Library and Playwright; verify destinations/actions and feedback through user-observable behavior.
5. Run axe checks on affected views in Light, Dark, and System modes at supported narrow and desktop viewports. Assert that no navigation/action is rendered as an anchor.
6. Verify each navigation/action has a visible response within 500 ms or displays the required busy/progress state while waiting.
7. Re-evaluate the Constitution Check after design: PASS. The design has no data-layer, API, service, or dependency changes; it retains all applicable frontend, security-review, test, accessibility, and performance obligations.

## Complexity Tracking

No constitution violations require justification. No new dependency, routing abstraction, API, or persistent navigation state is proposed.
