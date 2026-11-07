# Implementation Plan: VS Code-Inspired Dark Theme

**Branch**: `003-vscode-dark-theme` | **Date**: 2026-11-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-vscode-dark-theme/spec.md`

## Summary

Refresh the existing dark theme in `clutch-web` to use a VS Code-inspired charcoal palette, coordinated surfaces, readable text, and a restrained blue accent. Keep the existing semantic CSS-variable/Tailwind token architecture and make changes only to dark-mode token values and directly related surface/state styling. Preserve the light theme and the current system-preference-driven theme behavior. Validate contrast, section hierarchy, responsive behavior, and keyboard/focus states across the existing UI.

## Technical Context

**Language/Version**: TypeScript 5.9, React 19; CSS via Tailwind CSS 4.  
**Primary Dependencies**: Tailwind CSS 4 with the Vite plugin; React 19; Vitest 5, Playwright 1, and `@axe-core/playwright` for validation. No new dependency is planned.  
**Storage**: N/A; no theme preference is persisted by the frontend.  
**Testing**: Vitest + Testing Library for unit/component coverage; Playwright + axe-core for browser-level visual/accessibility checks; `npm run typecheck`, `npm run lint`, and `npm run build`.  
**Target Platform**: Existing `clutch-web` browser application, desktop and narrow/mobile viewports; Chromium is the configured Playwright project.  
**Project Type**: React web application (`src/clutch-web`).  
**Performance Goals**: No new runtime work or measurable performance target; palette changes must not add interaction latency or theme-switching work.  
**Constraints**: Preserve all `:root` light-theme values, theme preference behavior, application flows, and responsive layout. Keep colors in semantic theme tokens; meet WCAG 2.2 AA contrast for applicable text and non-text content; do not convey control/status meaning by color alone.  
**Scale/Scope**: All existing `clutch-web` screens and shared UI areas, including authentication, family/account, import, admin, tables, dialogs, and controls.

### Existing Theme Behavior

`ThemeProvider` applies the `.dark` class to the document root when `prefers-color-scheme: dark` matches and updates it when the operating-system preference changes. When the query does not match, the class is removed and the light `:root` tokens provide the default appearance. There is no in-app theme selector or browser-storage persistence in the current frontend. This design changes neither that behavior nor its default; tests should confirm both the dark match and light fallback.

## Constitution Check

*GATE: Pass before Phase 0 research; re-evaluate after Phase 1 design.*

| Principle / requirement | Applicability and design compliance |
|---|---|
| Principle I — Tooling, UI, and Architecture | UI changes remain in `clutch-web`; no new project, service boundary, dependency registration, or application architecture is introduced. |
| Principle IV; ENG-001 — Testing and Quality Gates | Add or update tests for changed theme behavior and visual states. Run targeted browser/accessibility validation and the frontend typecheck, lint, test, and production build gates. |
| Principle V; SEC-001 — Application Security | No security boundary, authentication, authorization, input handling, or dependency changes are in scope. Check existing frontend dependencies for known vulnerabilities with `npm audit` and remediate findings; the implementation must also receive the constitution-required independent OWASP Top 10 review before completion. |
| Principle VI; WEB-001 — Frontend Engineering | Use existing strict TypeScript, React function-component, Tailwind semantic-token, mobile-first, keyboard-accessible, and WCAG 2.2 AA patterns. Do not construct classes dynamically or add inline styles. Preserve the light theme. |
| Principles II–III; DOT-001/DOT-002 | Not applicable: no .NET service, database access, EF Core query, or migration changes. |
| Principle VII — Performance and Availability | No service or interaction behavior changes; do not introduce runtime work that affects current responsiveness. |
| Principle VIII; OPS-001 | No service operations, logging, health checks, database migrations, or data transformations are changed. |
| SEC-002/SEC-003 | Not applicable: no secret, credential, payment-data, logging, or diagnostic changes. |

**Gate result**: Pass. The feature is confined to frontend presentation and existing test surfaces; no constitutional conflict or unresolved specification question blocks design. Existing frontend dependencies and changed code remain subject to the security checks listed above.

## Project Structure

### Documentation (this feature)

```text
specs/003-vscode-dark-theme/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── theme-ui.md
```

### Source Code

```text
src/clutch-web/
├── src/
│   ├── components/theme/ThemeProvider.tsx
│   ├── components/ui/
│   ├── features/
│   └── index.css
└── e2e/
```

**Structure Decision**: Keep implementation in the existing `src/clutch-web` frontend. The global semantic color tokens in `src/clutch-web/src/index.css` are the primary palette surface; feature and shared components should consume those existing tokens. Update only component-specific styling where inspection shows it bypasses the semantic tokens or does not preserve perceivable interactive states.

## Phase 0: Outline & Research

The existing implementation resolves the technical context without open questions: the frontend is React 19/TypeScript with Tailwind CSS 4; dark mode is a `.dark` class over semantic OKLCH tokens; and Vitest, Playwright, and axe-core are already available. Research is recorded in [research.md](./research.md). No additional platform or dependency investigation is required.

## Phase 1: Design & Contracts

- [data-model.md](./data-model.md) records the current derived theme state and the semantic token roles; no persistence or domain data model changes are proposed.
- [contracts/theme-ui.md](./contracts/theme-ui.md) specifies the user-observable UI contract for dark and light appearances and interactive states.
- [quickstart.md](./quickstart.md) defines runnable validation for theme behavior, contrast, responsive layout, and keyboard interaction.

### Post-Design Constitution Check

Pass. The design adds no new architecture, dependencies, storage, API, or service behavior. It retains the existing frontend and token conventions, documents the browser-visible contract, and includes verification for accessible states, light-theme preservation, and existing theme behavior. Applicable gates remain Principle IV/ENG-001, Principle V/SEC-001, and Principle VI/WEB-001; the non-applicable requirements above remain unaffected.

## Complexity Tracking

No constitutional violations or unjustified complexity.
