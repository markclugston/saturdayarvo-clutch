# Implementation Plan: Page Error Boundary

**Branch**: `main` (shared checkout) | **Date**: 2026-11-26 | **Spec**: [spec.md](spec.md)

## Summary

One approved class error boundary wraps the signed-in page content, with a second instance around the
Categories add form (FR-001, FR-006). It stores only a failed flag, shows `ErrorMessage` and a
`Button`, and on retry drops inactive cached queries. A third placement of the same boundary wraps
`App`'s whole tree, inside the theme and query providers so the theme stays applied (FR-009, FR-010).
The React root's caught, recoverable and uncaught error handlers are replaced so no raw error reaches
the console (FR-008).

## Technical Context

**Baseline**: The existing stack and settled decisions in the code (see `docs/code-map.md`).

**Feature-specific changes**: One new component folder; no packages, endpoints or schema changes.

**Performance Goals**: Constitution defaults.

**Constraints**: No test-only fault hooks in app code; browser tests inject faults by replacing a
dev-server module.

**Scale/Scope**: Frontend only.

## Constitution Check

| ID | Applies | How the plan complies | Gate / evidence | Status |
|----|---------|-----------------------|-----------------|--------|
| ARC-001 | Yes | clutch-web only; nothing beyond the spec | Review | PASS |
| DOT-001 | No | No C# changes | — | N/A |
| DOT-002 | No | No data access | — | N/A |
| AUD-001 | No | No audit records | — | N/A |
| ENG-001 | Yes | Component and browser tests written first | Test tasks, quality gates | PASS |
| OPS-001 | No | No service or migration | — | N/A |
| SEC-001 | Marginal | No endpoint, input or dependency change; covered by the diff review | Independent security review | PASS |
| SEC-002 | No | No configuration or credentials | — | N/A |
| SEC-003 | Yes | Error never stored, rendered or logged; fixed console notices | Tests assert no marker text; security review | PASS |
| WEB-001 | Yes | TypeScript; `ErrorMessage` + `Button`; class component is the approved boundary exception | Frontend gates, checklist below | PASS |
| Perf & Observability | Yes | Retry gives immediate feedback (FR-004); client has no telemetry today | Component tests | PASS |

Status was re-checked after implementation; evidence is in [tasks.md](tasks.md).

Style guide sections: §2–3 (content panel surfaces, reused by the app-level message), §5 (buttons),
§6 (tokens), §7–9, §11.

| Item | Check |
|---|---|
| [x] Only tokens used: no raw colours, default palette, non-token radius, extra ring or shadow, or `dark:` colour | Lint |
| [x] No borders or divider lines on layout containers (hairline utilities only) | Lint, Review |
| [x] Transitions, durations and easing within the allowed set; `prefers-reduced-motion` respected | Lint, Browser |
| [x] Surface hierarchy follows canvas, content, card, raised | Browser, Review |
| [x] Built from existing primitives and variants; none restyled ad hoc | Review |
| [x] Form fields use floating labels (no fields added) | Review |
| [x] Labels, headings and button text use Title Case; helper, error and body text use sentence case | Review |
| [x] % and $ fields use the shared formatted field (none added) | Component |
| [x] Numbers and currency amounts, and their column headers, are right aligned (none added) | Lint, Component, Review |
| [x] Navigation expand/collapse behaviour unchanged unless an approved spec amends it | Browser |
| [x] Dark theme has no pure black surface or pure white text | Browser |
| [x] Both themes verified (screenshots) | Browser |
| [x] WCAG 2.2 AA (axe) and contrast pass in both themes | Browser |
| [x] Visible focus ring on every interactive element | Browser |
| [x] Status not conveyed by colour alone | Review |

## Project Structure

### Source Code (files this feature touches)

```text
src/clutch-web/src/components/error-boundary/PageErrorBoundary.tsx       new
src/clutch-web/src/components/error-boundary/PageErrorBoundary.test.tsx  new
src/clutch-web/src/components/error-boundary/rootErrorOptions.ts         new
src/clutch-web/src/App.tsx                  wrap app, page content and add form; key by destination
src/clutch-web/src/App.errorBoundary.test.tsx                            new
src/clutch-web/src/main.tsx                 pass root error options
src/clutch-web/e2e/error-boundary.spec.ts   new (playwright.config.ts)
docs/code-map.md                            pointer
```

**Structure Decision**: Cross-cutting component folder, like `components/unsaved-changes/`. New test
files keep this feature out of files other sessions are editing.

## Complexity Tracking

None.
