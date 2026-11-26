# Contract: Amortization Schedule Preference API

Base path: `/api/preferences/loan-payoff-timeline`. Both operations require an authenticated
session cookie (`RequireAuthorization`). The user is taken from the principal; no user ID is
accepted. `PUT` requires the existing antiforgery header (sent by `apiRequest`).

## GET `/api/preferences/loan-payoff-timeline`

| Status | Body |
|---|---|
| 200 | `{ "view": "Burndown" \| "Schedule" }` (`Burndown` when nothing saved) |
| 401 | ProblemDetails |

## PUT `/api/preferences/loan-payoff-timeline`

Request (JSON, at most 1024 bytes):

```json
{ "view": "Schedule", "clientId": "3f2b8c1e-5d7a-4c2e-9b1f-0a6d4e8c7b21", "clientSequence": 3 }
```

| Field | Rules |
|---|---|
| `view` | Required string, exactly `Burndown` or `Schedule` (case-sensitive) |
| `clientId` | Required GUID string, not all zeros |
| `clientSequence` | Required integer, 1 to 2^53 − 1 |

| Status | Body | When |
|---|---|---|
| 200 | `{ "view": "Burndown" \| "Schedule" }` (the stored value; may differ from the request when superseded) | Valid request |
| 400 | ProblemDetails, title `The Amortization Schedule view is invalid.`, detail `Choose Burndown or Schedule.` | Missing, null, wrong-case or other `view`; missing or invalid `clientId`/`clientSequence`; non-JSON or oversized body |
| 400/403 | ProblemDetails | Missing or invalid antiforgery token (existing behaviour) |
| 401 | ProblemDetails | No session |

## Client schema (`src/clutch-web/src/lib/api/schemas.ts`)

```ts
LoanPayoffTimelineViewSchema = z.enum(['Burndown', 'Schedule'])
LoanPayoffTimelinePreferenceSchema = z.object({ view: LoanPayoffTimelineViewSchema })
```

## Client behaviour

- Query key `['loanPayoffTimelinePreference', userId]`; enabled once `userId` is known;
  `retry: false`, `staleTime: Infinity`, no refetch on focus/reconnect; request aborted after 2000 ms. An errored or timed-out
  load is not re-requested on remount within the visit, so the page keeps Burndown until a switch.
- Switch: `setQueryData` with the new view, then `PUT` at once (no mutation scope, no debounce,
  `keepalive: true` so a reload does not cancel it). `clientId` and `clientSequence` come from one
  module-level page-load state, so remounting the page never restarts the sequence.
  Responses never write the cache. On error: no message (toasts are only for saving data); the view stays as chosen.

## UI contract (`LoanPayoffTimeline.tsx`)

| Element | Contract |
|---|---|
| Group | `section` card, `aria-labelledby` the `h2` "Amortization Schedule"; full content width below Details |
| Switch button | `Button variant="icon" size="icon"`, top right beside the title; `RefreshCw` icon `aria-hidden`; `aria-label` "Show Amortization Schedule" when Burndown is shown, "Show Burndown Chart" when Schedule is shown; no `aria-pressed` |
| Tooltip | Same text as `aria-label`; on hover and focus; Escape dismisses; hoverable |
| Status | Visually hidden `role="status"`: "Showing Burndown Chart" / "Showing Amortization Schedule" |
| Body | Exactly one of `BurnDownChart` or `AmortizationSchedule` content, unchanged from 016 |
