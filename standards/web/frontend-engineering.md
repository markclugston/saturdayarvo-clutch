# WEB-001 — Frontend Engineering

**Applies when:** A change creates or modifies `clutch-web`, its UI, frontend dependencies, or
frontend tests.

**Owner:** clutch-web maintainers

## Accessibility, themes, and responsive design

- Every page MUST support both light and dark themes, keyboard access, responsive layouts, and
  WCAG 2.2 AA.
- Feature specifications MUST define theme selection, default, and persistence behavior, and any
  additional accessibility requirements.

## React

- `clutch-web` MUST use the current stable React major version with function components and hooks.
- Class components MUST NOT be used, except for error boundaries where a maintained library is
  not used.
- `useEffect` MUST NOT derive state that can be computed during render.
- Server state MUST be managed by a dedicated data-fetching and caching library rather than
  ad hoc effect-based fetching.
- List items MUST use stable identifiers as keys, not array indexes, unless the list is static.
- `dangerouslySetInnerHTML` MUST NOT be used with untrusted content. Any use MUST be sanitized and
  reviewed under SEC-001.

## TypeScript and API boundaries

- All frontend code MUST be TypeScript with `strict` and `noUncheckedIndexedAccess` enabled.
- `any` MUST NOT be used; use `unknown` and narrow it. `@ts-ignore` MUST NOT be used, and
  `@ts-expect-error` requires an explanatory comment.
- Data crossing a system boundary, including API responses, URL parameters, and browser storage,
  MUST be validated at runtime before being treated as trusted.
- Generated API types MAY provide compile-time checks but MUST NOT replace runtime validation.
- API clients MUST handle RFC 9457 `ProblemDetails` responses as a typed case.

## Styling and components

- Styling MUST use Tailwind utility classes. Custom CSS is permitted only for global theme tokens
  and base layers, or where a documented browser or design requirement cannot be expressed with
  Tailwind utilities.
- Reusable colors, spacing, radii, and typography MUST come from theme tokens (semantic CSS
  variables); one-off arbitrary values require a clear design or technical rationale.
- Class names MUST NOT be constructed by string concatenation. Conditional and merged classes
  MUST use the shared `cn()` helper (`clsx` + `tailwind-merge`).
- Layouts MUST be mobile-first. Inline `style` is permitted only for values computed at runtime.
- shadcn/ui MUST be the default source for UI primitives. Components MUST be added through the
  shadcn CLI into the repository and then reviewed, typed, and tested as project-owned source.
- Modifications to generated components SHOULD be avoided in favor of composition via wrappers.
  The reason MUST be recorded when a generated component is modified.
- A competing component library MUST NOT be introduced without a constitution amendment.
- Components from third-party or community registries are untrusted code and MUST receive the
  SEC-001 security review before being added. Radix UI and other dependencies MUST be covered by
  the dependency vulnerability checks in SEC-001.
- shadcn/ui does not by itself satisfy WCAG 2.2 AA; each feature remains responsible for
  conformance.

## Frontend testing and CI

- `clutch-web` MUST include unit and component tests for meaningful components, hooks, utilities,
  and state behavior, using the project's established frontend test tools.
- UI tests MUST verify user-observable behavior through accessible roles and names rather than
  component implementation details.
- Critical user journeys MUST have browser-level end-to-end tests.
- Frontend CI MUST pass type checking, linting with zero warnings, automated tests, and a
  production build. The type check MUST run `tsc --noEmit`, and linting MUST use
  `typescript-eslint`.
