# Startup UI Contract

## Scope

This is the browser-facing contract for initial session discovery and retry after a startup error. The existing session endpoint and authentication API remain unchanged.

## Startup states and behavior

| Condition | Background content | Blocking UI | Result |
|---|---|---|---|
| Initial request or eligible automatic retry is active | Existing sign-in/account-creation page | Full-viewport, non-dismissible modal dialog with announced loading status | Remains active only while the bounded check is running |
| Session endpoint returns a valid session | Existing signed-in experience is not exposed until validation completes | Dialog closes | Existing signed-in destination appears |
| Session endpoint returns HTTP 401 | Existing sign-in/account-creation page | Dialog closes | Auth controls become usable |
| Non-transient failure or recovery window expires | Sign-in page; no private content | No blocking dialog | Accessible error and retry action appear |
| Retry is selected | Sign-in page | Blocking dialog appears within 500 ms | A fresh bounded check begins without a page reload |

## Accessibility and responsive requirements

- Use the project-owned shadcn/ui Dialog primitive so background content is inert and keyboard focus remains within the dialog during checking.
- Give the dialog an accessible name and description and announce the loading state to assistive technology.
- Prevent Escape, backdrop interaction, and other dismissal while a check is active.
- On dialog close, restore normal page interaction and focus behavior.
- Keep loading and error presentation usable at narrow viewport sizes in Light, Dark, and System appearance modes.
- Expose errors and retry through semantic alert/status and button roles and names.

## Session service interaction

- Request: existing same-origin `GET /api/security/session`, validated against `SessionSchema`.
- Success: validated `UserSession` means signed in.
- HTTP 401: normal signed-out result.
- Retryable: network connection failures, per-request timeouts, and HTTP 502, 503, or 504.
- Non-retryable: all other failures, including malformed response/schema errors; show an actionable error instead of treating the user as signed out.
- Automatic transient recovery window: 30 seconds. Overall check/error bound: 45 seconds. Per-request timeout: 8 seconds.
- A user retry starts a new bounded attempt; the request uses the existing API client's same-origin credentials and does not persist authentication data in browser storage.
