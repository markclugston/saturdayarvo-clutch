# Theme Preference API Contract

The API persists the mode for the authenticated account. All routes require the existing application cookie authentication. Mutation requests use the existing `X-CSRF-TOKEN` antiforgery header. The user ID is derived only from the authenticated principal.

## `GET /api/preferences/theme`

Returns the authenticated user's saved mode.

**Success `200 OK`**

```json
{ "mode": "Light" }
```

The response is `Light` when the user has not saved a preference. Valid values are exactly `Light`, `Dark`, and `System`.

**Errors**

- `401 Unauthorized`: no authenticated user.
- Standard RFC 9457 ProblemDetails for other request failures.

## `PUT /api/preferences/theme`

Replaces the authenticated user's saved mode. A successful write is the authoritative latest saved preference for that user.

**Request**

```json
{ "mode": "Dark" }
```

**Success `200 OK`**

Returns the persisted canonical value:

```json
{ "mode": "Dark" }
```

**Errors**

- `400 Bad Request`: invalid mode or invalid/missing antiforgery token; response uses the application's ProblemDetails behavior.
- `401 Unauthorized`: no authenticated user.
- Standard RFC 9457 ProblemDetails for other request failures.

## Client Behavior

- Runtime-validate both response bodies and request values.
- Apply the chosen mode immediately; saving is asynchronous and must not block the current appearance.
- On a failed save, retain the current-visit choice and present a user-visible error. A later visit without a persisted mode starts in Light mode.
- A newly opened or refreshed device loads the server's latest saved mode.
