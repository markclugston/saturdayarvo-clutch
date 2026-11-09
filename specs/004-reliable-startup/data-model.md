# Data Model: Reliable Startup Loading

## Overview

This feature introduces no persisted entities, database tables, or API schemas. Startup state is ephemeral and derived from the existing TanStack Query for `['session']`.

## Startup state

| State | Data | Entry condition | User-visible behavior |
|---|---|---|---|
| Checking | Start time and current request/retry metadata; no session value yet | Initial session query or an explicit retry begins | Sign-in page remains mounted beneath a blocking loading dialog |
| Signed out | No session; the existing API reports HTTP 401 | Session check conclusively reports authentication required | Dialog closes; sign-in and account creation are usable |
| Signed in | `UserSession` validated by `SessionSchema` | Session endpoint returns a valid session | Dialog closes; existing signed-in experience is shown |
| Failed | Typed API/network/timeout error; no confirmed session | A non-transient failure occurs or bounded recovery ends | Dialog closes; accessible error and retry action are shown; private UI remains hidden |

## Existing session data

- **Entity**: `UserSession`
- **Fields**: `id` (non-empty string), optional `roles` (string array)
- **Validation**: `SessionSchema` in `src/clutch-web/src/lib/api/schemas.ts`; the API client parses the response before the data enters the query cache.
- **Relationship**: The session query determines whether the app exposes the auth experience or existing signed-in app content. Theme preference continues to be queried only for a confirmed signed-in user.

## Recovery rules

- Retry eligible errors only: network `TypeError`, request timeout, and HTTP 502/503/504.
- HTTP 401 is the ordinary signed-out state and is not retried.
- Other HTTP/API/schema failures go directly to the retryable error state.
- Retry transient errors for the 30-second recovery window; each request is bounded, and the entire check must settle within 45 seconds.
- Selecting retry starts a new attempt window and returns to Checking immediately.
