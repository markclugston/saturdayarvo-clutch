# Implementation Plan: Reliable Startup Loading

**Branch**: `main` | **Date**: 2026-11-09 | **Spec**: `specs/004-reliable-startup/spec.md`

**Input**: Feature specification from `specs/004-reliable-startup/spec.md`

## Summary

Keep the existing sign-in experience rendered during session discovery and place a full-viewport, non-dismissible modal dialog over it using the project-owned shadcn/ui Dialog primitive. Replace the current attempt-count-only retry behavior with a bounded, time-aware startup policy: retry transient network and gateway/service failures for a 30-second recovery window, time out individual requests, and show a retryable error no later than 45 seconds. Preserve the existing session endpoint, authentication flow, signed-in destination, and theme preference behavior.

## Technical Context

**Language/Version**: TypeScript 5.9, React 19.3

**Primary Dependencies**: TanStack Query 5, existing typed API client and Zod schemas, Tailwind CSS 4, and the project-owned shadcn/ui Dialog primitive generated through the shadcn CLI using the existing `@base-ui/react` dependency (no new runtime dependency)

**Storage**: None; startup attempt state is transient in the browser. Session and theme data continue to come from existing API endpoints.

**Testing**: Vitest, React Testing Library, Playwright, and `@axe-core/playwright`; project scripts `typecheck`, `test`, `test:e2e`, `lint`, and `build`; run `npm audit` to check frontend dependencies for known vulnerabilities

**Target Platform**: Existing supported desktop and mobile browsers for `clutch-web`

**Project Type**: Web application (React frontend with existing .NET API)

**Performance Goals**: Retry action shows loading feedback within 500 ms; retry transient failures for at least 30 seconds; settle with a result or error within 45 seconds; individual session requests are timed out so a hung fetch cannot block the flow indefinitely.

**Constraints**: Do not change authentication, session, or theme APIs; 401 is a normal signed-out result; retry only temporary failures; never show signed-in/private UI before session confirmation; keep modal focus and background interaction behavior accessible; no dependency or persistence changes.

**Scale/Scope**: Startup session query and its loading, signed-out, authenticated, and error presentation in `src/clutch-web`; no backend, database, or other loading-state redesign.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Tooling, UI, and Architecture**: PASS. Work remains in `clutch-web`, uses the existing React application and session API, and adds no unrelated feature or provider-specific domain logic.
- **II. .NET Service Best Practices**: PASS / NOT APPLICABLE. No .NET code or service I/O changes are planned.
- **III. Data Access, Async, and Performance**: PASS / NOT APPLICABLE. No database access, queries, or migrations change.
- **IV. Testing and Quality Gates (ENG-001)**: PASS. Add executable unit/component and browser-level checks for startup outcomes, focus/inertness, timing bounds, retry, responsive display, and accessibility at 320x812 and 1280x720. Run the relevant frontend checks.
- **V. Security and Error Handling (SEC-001, SEC-003)**: PASS. Keep session validation and API error handling at existing boundaries; do not treat unresolved errors as signed out or expose private content. Run the frontend dependency vulnerability check and complete the required independent OWASP Top 10 review before implementation completion.
- **VI. Frontend Engineering (WEB-001)**: PASS. Use strict TypeScript, React hooks, existing query state, semantic UI, theme tokens/Tailwind, automated accessible-role/browser checks, and the project-owned shadcn/ui Dialog primitive. Preserve Light, Dark, System and the Light initial default.
- **VII. Performance and Availability**: PASS. Provide immediate loading feedback and bound startup/retry duration as required by the spec.
- **VIII. Observability**: PASS / NOT APPLICABLE. No long-running service operation or backend telemetry is changed.

Applicable indexed requirements are ENG-001, SEC-001, SEC-003, and WEB-001. No constitution violations or exceptions are required.

## Project Structure

### Documentation (this feature)

```text
specs/004-reliable-startup/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── startup-ui.md
```

### Source Code (repository root)

```text
src/clutch-web/
├── src/
│   ├── App.tsx
│   ├── App.test.tsx
│   ├── components/ui/
│   │   └── dialog.tsx
│   └── features/auth/
│       ├── api.ts
│       ├── StartupLoadingDialog.tsx
│       └── StartupLoadingDialog.test.tsx
└── e2e/
    └── startup.spec.ts
```

**Structure Decision**: Keep orchestration and session-query transitions in the existing `App.tsx` and auth endpoint client. Add the project-owned shadcn/ui Dialog primitive under `src/components/ui` through the configured shadcn CLI, then compose it into the startup-only blocking dialog and its interaction tests in `features/auth`; cover real browser modal and startup journeys in a focused Playwright spec. No API contract or backend source changes are planned.

## Design Decisions

- Pass TanStack Query's cancellation signal to the session request and combine it with an 8-second per-request timeout. Treat a timeout as a retryable transient failure, but do not retry an explicit query cancellation.
- Retry connection failures (`TypeError`), request timeouts, and the existing transient gateway/service statuses 502, 503, and 504 while the 30-second recovery window remains. Keep 401 as signed out; report other failures without automatic retries. Bound all attempts and error presentation to 45 seconds.
- Compose the project-owned shadcn/ui Dialog primitive around `AuthPage` for a full-viewport modal. Use dialog labeling and a status announcement, prevent dismissal while checking, and rely on the primitive's modal focus and background-inert behavior instead of hand-built focus traps or a new runtime dependency.
- On a conclusive session, retain current signed-in routing or expose the sign-in/account-creation page. On failure, close the modal and present a visible error and retry action; retry starts a fresh bounded check.

## Post-Design Constitution Check

PASS. The design adds no persistence, API, or database changes; keeps sensitive content gated on a validated session; uses the configured shadcn/ui Dialog primitive and existing frontend stack; and defines executable tests for the specified timing and accessibility outcomes at 320x812 and 1280x720. The implementation must still pass the dependency vulnerability check, independent OWASP Top 10 review, and relevant frontend checks before completion.
