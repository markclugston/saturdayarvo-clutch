# Research: Reliable Startup Loading

## Session query retries and request bounds

- **Decision**: Keep the application-wide TanStack Query retry default disabled and configure startup-specific time-aware retries. Forward the query cancellation signal to the session request and combine it with an 8-second per-request timeout. Retry transient network errors, timeouts, and HTTP 502/503/504 during the 30-second recovery window; do not retry explicit cancellation, 401, or other failures. Ensure the overall attempt reaches a result or visible error within 45 seconds.
- **Rationale**: The app already uses a per-query retry override for startup, while `apiRequest` accepts `RequestInit` and forwards its signal to `fetch`. TanStack Query's retry function is the right boundary for classifying errors, and its query-function signal allows canceled or obsolete work to stop. A per-request timeout is necessary because retry counts and backoff alone cannot bound a request that never settles.
- **Alternatives considered**: A fixed number of retries does not guarantee a time window; infinite retries can leave startup unresolved. A timeout without Query cancellation does not stop work when the query becomes obsolete. A hand-built timer/controller is possible, but the platform `AbortSignal.timeout()` and `AbortSignal.any()` compose the deadline and query cancellation without another dependency.
- **Sources**:
  - [TanStack Query: Query Retries](https://tanstack.com/query/latest/docs/framework/react/guides/query-retries)
  - [TanStack Query: Query Functions](https://tanstack.com/query/latest/docs/framework/react/guides/query-functions)
  - [TanStack Query: Query Cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation)
  - [MDN: AbortSignal.timeout()](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static)

## Blocking loading dialog and accessibility

- **Decision**: Add the project-owned shadcn/ui Dialog primitive through the configured shadcn CLI and compose it for the full-screen startup blocker. Use a programmatic label and description plus a separately announced loading status; prevent dismissal while the check is active. Style the dialog and backdrop responsively with existing Tailwind/theme tokens.
- **Rationale**: The constitution requires shadcn/ui as the default source for UI primitives. The project already configures shadcn with the Base UI style and has `@base-ui/react` installed, so the generated Dialog can provide modal focus and background-inert behavior without adding a runtime dependency or hand-built focus management.
- **Alternatives considered**: A plain overlay would require separate inert and focus-trap management and would not follow the required primitive convention. A native HTML `<dialog>` can provide modal behavior but conflicts with the constitution's required default for UI primitives. The design does not need a third-party spinner library.
- **Sources**:
  - [WAI-ARIA APG: Alert and Message Dialogs](https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/)
  - [WAI-ARIA APG: Alert Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/alert/)
  - [MDN: inert global attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert)

## Repository integration

- **Decision**: Keep the feature in the existing `App` session query and authentication UI. Preserve `GET /api/security/session`, Zod `SessionSchema` validation, `ApiError` classification, and current theme behavior; add no server endpoint or persisted state.
- **Rationale**: The current app already distinguishes authenticated sessions, 401 signed-out responses, and other errors, and its API client validates boundary responses. The startup fix can address loading and recovery without changing authentication semantics.
- **Alternatives considered**: A new authentication endpoint, browser-stored session state, or broader route/loading redesign is unnecessary and risks changing the existing security boundary.
- **Sources**: `src/clutch-web/src/App.tsx`, `src/clutch-web/src/features/auth/api.ts`, `src/clutch-web/src/lib/api/client.ts`, `src/clutch-web/src/lib/api/schemas.ts`, `src/clutch-web/src/main.tsx`, and `src/clutch-web/src/components/theme/ThemeProvider.tsx`.
