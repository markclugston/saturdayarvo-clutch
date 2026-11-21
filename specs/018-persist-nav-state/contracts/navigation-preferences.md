# Contract: Navigation Preference API

Base path: `/api/preferences/navigation`. Both operations require an authenticated session cookie
(`RequireAuthorization`). The user is taken from the principal; no user ID is accepted in the
request. `PUT` requires the existing antiforgery header (sent by `apiRequest`).

## GET `/api/preferences/navigation`

| Status | Body |
|---|---|
| 200 | `{ "state": "Pinned" \| "Unpinned" }` (`Unpinned` when nothing saved) |
| 401 | ProblemDetails |

## PUT `/api/preferences/navigation`

Request:

```json
{ "state": "Pinned" }
```

| Status | Body | When |
|---|---|---|
| 200 | `{ "state": "Pinned" \| "Unpinned" }` (the saved value) | Valid state |
| 400 | ProblemDetails, title `The navigation state is invalid.`, detail `Choose Pinned or Unpinned.` | Missing, null, wrong case or any other value |
| 400/403 | ProblemDetails | Missing or invalid antiforgery token (existing behaviour) |
| 401 | ProblemDetails | No session |

## Client schema (`src/clutch-web/src/lib/api/schemas.ts`)

```ts
NavigationStateSchema = z.enum(['Pinned', 'Unpinned'])
NavigationPreferenceSchema = z.object({ state: NavigationStateSchema })
```

## Client query behaviour

- Query key `['navigationPreference', userId]`, enabled only once the session `id` is known; `retry: false`, `staleTime: Infinity`, no refetch on
  window focus or reconnect; request aborted after 2000 ms.
- Save mutation scoped `` { id: `navigationPreference:${userId}` } `` (serial per user); on success writes the cache; on
  error shows a toast (per-call `onError`, so none after sign-out) and keeps the on-screen state.
