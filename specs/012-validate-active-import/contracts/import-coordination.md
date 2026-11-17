# Contract: Account Import Coordination

## Common Rules

- Existing secure-cookie authentication and account-owner authorization apply to every
  operation. Unknown and inaccessible accounts/reviews are indistinguishable 404s.
- State-changing requests require the existing `X-CSRF-TOKEN`. Actor values always come
  from authentication; requests cannot name an ending user.
- Status responses use `Cache-Control: no-store`; no shared caching. Responses contain
  no staged rows, mappings, filenames, balances or transaction contents.
- Dates are UTC ISO-8601 timestamps; identifiers are UUIDs except Identity user IDs.
- Errors use existing RFC 9457 ProblemDetails and `errors.code` string arrays. New
  coordination services return typed expected outcomes, mapped at the route boundary.
- Frontend requests use existing `apiRequest` and Zod runtime schemas. Status requests
  pass an AbortSignal; abort obsolete requests and bound each read to two seconds.

## GET /api/accounts/{accountId}/import-status

Optional query: `reviewId` (UUID), identifying the preview this screen is watching.

### 200 response

```json
{
  "accountId": "11111111-1111-4111-8111-111111111111",
  "availability": "Blocked",
  "activeImport": {
    "id": "22222222-2222-4222-8222-222222222222",
    "stage": "Preview",
    "canEnd": true,
    "expiresAtUtc": "2026-11-17T07:00:00Z"
  },
  "watchedImport": null
}
```

| Field | Exact alternatives / invariant |
|---|---|
| `accountId` | Authorized account ID. |
| `availability` | `Available` or `Blocked`; never omit it or infer Available from missing data. |
| `activeImport` | Null only when Available. Otherwise object with UUID `id`, `stage`, boolean `canEnd`, nullable timestamp `expiresAtUtc`. |
| `activeImport.stage` | `Preview`, `Processing`, or `Unknown`. Only an unexpired Ready preview with a matching account lease is Preview. |
| `activeImport.canEnd` | True only for Preview. False for Processing or Unknown. The client additionally disables actions during its own claim/end mutation and pending restoration. |
| `activeImport.expiresAtUtc` | Ready preview expiry only; null for Processing/Unknown, not a processing deadline. |
| `watchedImport` | Null when reviewId was not supplied; otherwise one of the discriminated objects below. |

Watched objects:

```text
{ id, state: "Ready", expiresAtUtc }
{ id, state: "Processing" }
{ id, state: "Ended", endedAtUtc, endedBy: { userId, userName } }
{ id, state: "Expired" }
{ id, state: "Unavailable" }
```

- Every `id` matches the requested reviewId; timestamps and required nonblank strings
  are validated at runtime. Reject unknown discriminants/inconsistent combinations.
- Ended requires a retained externally ended header. `endedBy.userId` and `.userName`
  are server-resolved Identity values, disclosed only to the account owner. In this
  application username is the owner's sign-in email; show as text, do not log it.
  An identity-resolution failure is an explicit error, not a fabricated actor.
- Ended takes precedence for the watched preview even if a different import is active.
- A known expired Ready header projects Expired. A deleted review with no retained
  ending header is Unavailable; do not invent its terminal reason.
- A supplied review that exists under another account returns 404 before exposing it.
  An absent UUID returns Unavailable only after authorizing the requested account.
- If an active lease references missing/inconsistent state, return Blocked with the
  lease ID, Unknown stage and canEnd false; log a sanitized integrity failure. Do not
  release that lease merely because the projection cannot classify it.
- Load the authorized account and its active/watched headers in one no-tracking
  projection. If additional lookups are needed, verify the lease/version observed before
  returning availability; after a bounded retry, explicitly fail if state cannot be
  established consistently. Do not require enabling a new database isolation setting.
  The create mutation still enforces the final lease check.

### Errors

- 400: malformed reviewId.
- 401: unauthenticated.
- 404: account/watched review is inaccessible as described above.
- 5xx or request timeout: availability is not established; show an error and keep actions
  blocked until retry succeeds. No success-shaped empty response.

## DELETE /api/accounts/{accountId}/active-import-review?reviewId={reviewId}

Strengthen the existing endpoint to require the exact target observed in status.
Missing or malformed target returns 400 (`ImportTargetRequired`).

### Behavior

1. Authorize the account and exact target without exposing another owner's state.
2. Conditionally end only that unexpired Ready review while it owns the lease.
3. In the same transaction, remove its rows/mapping, retain its ended header/actor/time,
   release only its lease and append the canonical external-end Audit event.
4. Return 204 on successful ending. A repeated request for that already externally
   ended target returns 204 without another event and without touching any newer review.
5. Client immediately invalidates/refetches status. A 204 alone does not establish that
   the account is now available.

### Errors / races

| Condition | Result |
|---|---|
| Exact target is Processing | 409, `ImportNotEndable`; leave import/lease/data unchanged. |
| A different review now owns the lease | 409, `ImportChanged`; do not end it. |
| Exact target expired, completed, self-cancelled or otherwise disappeared | 409, `ImportChanged`; revalidate status, which may now be Available. |
| Account/review belongs to another owner | 404 without actor or stage disclosure. |
| Unauthorized / invalid CSRF | Existing 401 / 400 behavior. |
| Unknown transaction outcome | Explicit failure; re-query exact status before enabling anything or retrying. |

Retained ended targets remain idempotent even if a replacement is active; a non-ended
stale target never becomes an instruction to cancel the current active import.

## Existing Import Mutations

### POST /api/accounts/{accountId}/import-reviews

Keep current multipart input, 201 review response and Location. Reuse the shared policy,
then atomically claim the account lease and stage the preview. Concurrent start still
returns 409 with existing `ConcurrentImport`. Client refetches status on conflict instead
of offering a blind discard action.

Malformed 201 response recovery must still use its validated Location to cancel that
exact created review. If creation outcome has no usable review ID, query account status
before offering exact-target recovery. Never cancel an unknown current import.

### POST /api/import-reviews/{reviewId}/confirm

Keep current request/response, duplicate warning behavior and successful settings-save
contract. Accept only an authorized, unexpired Ready review holding its lease, through
the persisted conditional Processing claim.

- If ending wins first, return 409 `ImportEndedElsewhere` for a retained ended header;
  client fetches the watched status and presents the modal, never retries confirmation.
- If confirmation wins, all external end attempts fail until that attempt finishes or
  is rejected/failed. Processing does not expire at the preview timestamp.
- Duplicate-confirmation-required rejects this attempt and returns Ready with updated
  warnings; the existing duplicate acknowledgement is still required.
- Other known failures release only this exact attempt after rollback. An unknown
  commit outcome is not falsely reported as zero imported transactions. If persistence
  verification cannot distinguish success from a lost terminal result, return an
  explicit `ImportOutcomeUnknown` failure instructing the owner to check transactions
  before retrying; do not auto-submit another import.

### DELETE /api/import-reviews/{reviewId}

Keep same-screen cancellation, but only Ready may cancel. A retained externally ended
header returns 409 `ImportEndedElsewhere` so a stale cancel cannot erase its notice;
Processing returns 409 `ImportNotEndable`. No endpoint may classify Processing as a
terminal lease that can be cleared.

## Browser Interaction Contract

- One query key includes accountId and optional watched reviewId; scope/clear account
  data using existing authenticated-session query lifecycle. Poll every two seconds only
  while the screen is active/visible; refetch immediately on focus/reconnect.
- Routine polling preserves the displayed state, focus and enabled controls until a
  different result or error arrives. Initial entry, explicit revalidation and foreground/
  reconnect restoration still require a successful current check before enabling actions.
- Gate file-start actions on confirmed availability; gate review actions on fresh
  Ready state for that same review. Treat the screen's own review as owned, not a conflict.
- Hide end controls when eligibility is unknown or state restoration is pending.
  During end/claim mutations disable competing actions and revalidate after the outcome.
- On watched Ended, latch that specific review's modal so an older response or
  replacement account import cannot dismiss it. Stop polling that ended preview.
- On watched Expired, explain that the preview expired; on Unavailable, explain only
  that the preview is no longer available, without inventing a reason or ending actor.
  Disable preview mutations and offer Return to transactions. Invalidate the account
  and transaction queries and invoke the existing account-return callback directly;
  do not issue a cancel request for that preview. A transport/validation failure is
  still an explicit error with Retry, never an Unavailable result.
- Dialog title: "Import ended". Description identifies the ending username and that it
  happened in another session. One explicit acknowledgement button returns to the
  ended account's transactions screen after invalidating relevant queries.
- Dialog is modal, named/described, keyboard focused/trapped, and cannot dismiss through
  Escape or outside pointer interaction. No import interaction remains beneath it.
- No local/session storage of credentials or new preview-resumption mechanism. A mounted
  or restored screen still identifying a preview revalidates before actions are enabled.
- Completion/expiry/cancellation of a competing import refreshes availability within five
  seconds when connected/foreground; revalidation never auto-submits an import.
- Preserve the shared Light/Dark/System selection and persisted preference, with Light
  while preferences are loading. No changes to theme storage or navigation architecture.
