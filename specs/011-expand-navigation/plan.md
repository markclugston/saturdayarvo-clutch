# Implementation Plan: Expandable Left Navigation

**Branch**: `agents/hamburger-navigation-expansion` | **Date**: 2026-11-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/011-expand-navigation/spec.md`

## Summary

Replace the signed-in header's Accounts and Categories buttons with a persistent left navigation pane. The pane expands on hover or keyboard focus to show labels beside the same icons, overlaying any page content in its path without resizing or moving it. Preserve the existing navigation handlers, header actions, session behavior, access rules, and theme preferences. Use existing React state, Lucide icons, Tailwind theme tokens, and accessible button semantics; verify with component and browser-level checks.

## Technical Context

**Language/Version**: TypeScript 5.9 with strict settings; React 19 function components.

**Primary Dependencies**: Existing React, TanStack Query, Tailwind CSS, Lucide React, and project-owned UI components; no new dependency planned.

**Storage**: Transient client state for pane expansion only; no new persistent data, API, or database changes.

**Testing**: Vitest and Testing Library for application behavior; Playwright and axe-core for browser journeys, responsive layout, and automated accessibility checks.

**Target Platform**: Existing responsive web client, including 320-by-812 and 1280-by-720 browser viewports.

**Project Type**: Existing web application frontend.

**Performance Goals**: Visible response within 500 ms for hover expansion and navigation; show a busy state for longer actions and progress when measurable.

**Constraints**: Navigation uses buttons, not anchors; WCAG 2.2 AA, keyboard access, direct touch navigation, Light/Dark/System themes, overlay expansion without content resizing, and preservation of existing screen behavior. No human confirmation or participant study as a completion gate.

**Scale/Scope**: Two navigation destinations; all signed-in screens including account detail, import, Categories, and administrator settings.

## Constitution Check

*Pre-research and post-design gates: PASS, conditional on completing the checks below during implementation. No exception or amendment proposed.*

| Requirement | Design and verification |
|---|---|
| **ARC-001 / Principle I** | Change remains in `clutch-web`, uses the approved specification, and does not change application boundaries. |
| **ENG-001 / Principle IV** | Add focused behavior tests and an executable browser journey; run frontend typecheck, zero-warning lint, tests, production build, and the required checks. No manual gate or participant study. |
| **SEC-001 / Principle V** | Preserve existing authentication, authorization, error handling, and access controls; require an independent OWASP Top 10 review of changed code and dependency vulnerability checks, with findings resolved before completion. |
| **WEB-001 / Principle VI** | Use strict typed React, existing state and query patterns, Tailwind theme tokens, existing button/UI primitives where suitable, and existing Lucide icons. Buttons replace header buttons without anchors. Test accessible names, current state, focus, keyboard interaction, pointer cursor, responsive layout, all theme modes, and WCAG 2.2 AA. Use shadcn/ui as the default source for any new primitives; no new primitive is anticipated. |
| **Principle VII** | Check user-visible hover expansion and navigation response against 500 ms; retain existing pending feedback where applicable. |

Database, .NET service, audit, new secrets, payment-data processing, logging, and operational changes are not planned; their specialized gates do not apply. If the design expands to include them, re-evaluate the applicable requirements before implementation.

## Project Structure

### Documentation (this feature)

```text
specs/011-expand-navigation/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── navigation-ui.md
└── tasks.md             # Generated later by /speckit-tasks
```

### Source Code (repository root)

```text
src/clutch-web/
├── src/
│   ├── App.tsx                  # Signed-in shell and existing navigation behavior
│   ├── App.test.tsx             # Existing session and navigation tests
│   ├── components/ui/           # Existing owned primitives
│   ├── components/theme/        # Existing theme behavior, unchanged
│   ├── features/               # Existing destination pages, unchanged except as required for reflow
│   └── index.css               # Existing semantic theme tokens
├── e2e/                         # Existing Playwright journeys and fixtures
├── package.json
└── playwright.config.ts
```

**Structure Decision**: Integrate the pane at the signed-in application shell in `App.tsx`. Derive expansion from mouse hover and keyboard focus; reserve compact width and overlay content only where it shares the expanded pane's space. Do not force overlap by moving content or widening the pane. Reuse existing page handlers exactly, including Accounts resetting selected account/import and Categories leaving them unchanged. Ensure transient session refresh failures with valid cached session data do not unmount the pane.

## Phase 0: Research

See [research.md](research.md) for choices on state lifetime, accessibility, responsive behavior, icons, and validation. All design decisions are resolved.

## Phase 1: Design

- [data-model.md](data-model.md) defines transient pane state and the existing destination state transitions.
- [navigation-ui.md](contracts/navigation-ui.md) defines the user-facing interface contract and regression boundaries.
- [quickstart.md](quickstart.md) defines executable validation and prerequisites.
- Post-design constitution check: **PASS**. No new server interface, storage, dependency, or exception is introduced. Implementation and review gates remain mandatory.

## Complexity Tracking

No constitution violations or exceptions are anticipated.
