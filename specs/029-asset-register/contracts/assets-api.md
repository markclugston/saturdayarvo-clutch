# Contract: Assets API

## Common rules

- Group `/api/assets` with `RequireAuthorization()`; the owner comes from `ClaimTypes.NameIdentifier`. A foreign or unknown asset or edit returns 404 (same as unknown).
- Mutations require the existing `X-CSRF-TOKEN`. Request size limit is 64 KB; a larger body gets 413 (never 500), as `MortgageRequestLimit` does.
- There is no GET `/api/assets/{id}`: the asset detail for editing is returned in `EditLease.asset`.
- Errors use the existing ProblemDetails (`ApiProblemException`). 400 validation has `errors` keyed by field; 409 has `errors.code` with one of the codes below.
- Every asset has a `currencyCode` from GET `/api/currencies` (research R9). A valuation value is a JSON number with no more decimals than the currency's `minorUnits`, at most 999,999,999,999.99 (the established mortgage cap, which round-trips exactly through a JavaScript number); the UI converts it with `value.toFixed(minorUnits)` before `formatCurrencyAmount`, which takes a decimal string. Each `totalValue` is a decimal string with exactly the currency's minor units (for example `"15500.00"`, `"5000"` for JPY), because a sum of many assets can exceed what a JavaScript number holds exactly (SC-003); the UI passes it straight to `formatCurrencyAmount` with its `currencyCode`. Dates are `yyyy-MM-dd`. Timestamps are UTC ISO-8601.
- Coordination GETs send `Cache-Control: no-store`.

## Schemas

```text
ValuationDto      { id: uuid, value: number, valuationDate: date }
AssetListItem     { id: uuid, name: string, description: string|null, currencyCode: string,
                    latestValuation: { value, valuationDate } }
CurrencyTotal     { currencyCode: string, totalValue: string /* decimal, currency's minor units */ }
AssetList         { assets: AssetListItem[], totals: CurrencyTotal[] /* ordered by currencyCode; [] when no assets */ }
AssetDetail       { id, name, description, currencyCode, valuations: ValuationDto[] /* newest first */ }
AssetInput        { name: string, description: string|null, currencyCode: string,
                    valuations: { id?: uuid, value: number, valuationDate: date }[] }
EditLease         { editId: uuid, expiresAtUtc, serverTimeUtc, asset: AssetDetail }
EditStatus        { assetId, availability: "Available"|"Blocked",
                    activeEdit: null | { id, expiresAtUtc } /* always endable while Blocked, research R10 */,
                    watchedEdit: null
                      | { id, state: "Active", expiresAtUtc }
                      | { id, state: "Saved" | "Released" | "Expired" | "Unavailable" }
                      | { id, state: "Ended", endedAtUtc, endedBy: { userId, userName } } }
```

## Endpoints

| Method / path | Body / query | Success | Errors |
|---|---|---|---|
| GET `/api/assets` | — | 200 `AssetList` (created order; latest valuation only) | 401 |
| POST `/api/assets` | `AssetInput` (no ids) | 201 `AssetDetail`, Location | 400 fields |
| POST `/api/assets/{id}/edits` | — | 201 `EditLease` | 404; 409 `AssetEditActive` + `EditStatus` body (audited `AssetEditRejected`) |
| GET `/api/assets/{id}/edit-status` | `?editId=` optional | 200 `EditStatus` (`watchedEdit.state` `Unavailable` when `editId` has no row for this asset) | 400 bad editId; 404 |
| PUT `/api/assets/{id}` | `AssetInput` + `editId` | 200 `AssetDetail` | 400 fields; 404 `AssetNotFound`; 409 `AssetEditEnded`, `AssetEditExpired`, `AssetEditChanged` |
| DELETE `/api/assets/{id}/edits/{editId}` | — (holder releases) | 204, idempotent; an expired edit is recorded `Expired`, not `Released` (data-model.md "Release") | 404 |
| DELETE `/api/assets/{id}/active-edit` | `?editId=` required (exact target) | 204; repeat for same ended target → 204 | 400 `AssetEditTargetRequired`; 404; 409 `AssetEditChanged` |
| DELETE `/api/assets/{id}` | — | 204 | 404; 409 `AssetEditActive` |

## Validation (server; the UI enforces the same rules)

| Field key | Rule / message |
|---|---|
| `name` | required; 100 characters or fewer after trimming |
| `description` | 500 characters or fewer |
| `currencyCode` | required; one of the supported currencies ("Select a currency"). On PUT it must equal the asset's currency, which never changes ("The currency cannot be changed"); this is checked once the edit is claimed, and a refusal leaves the edit active |
| `valuations` | at least one ("Add at least one valuation") |
| `valuations[i].value` | required; ≥ 0; no more decimals than the currency's minor units ("{code} values have no decimal places" / "Enter at most 2 decimal places"); ≤ 999,999,999,999.99 ("Enter a value up to 999,999,999,999.99"). Checked against the submitted `currencyCode`. |
| `valuations[i].valuationDate` | required; valid date; not in the future; unique within the asset |
| `valuations[i].id` | when present, must be an existing valuation of this asset |

## Race rules

- Save, End and Release on one edit are serialized by conditional updates in one transaction; exactly one wins.
- End never affects an edit other than `editId`, and never affects a Saved edit.
- Save after expiry or ending stores nothing.
- An `Active` edit past `ExpiresAtUtc` counts as expired everywhere (data-model.md "Effective expiry"): it does not block acquire or DELETE, status reports it `Expired`, and GET endpoints never write.
- PUT on a deleted asset returns 404 `AssetNotFound`.
