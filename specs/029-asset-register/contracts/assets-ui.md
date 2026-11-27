# Contract: Assets UI

## Navigation and URLs

- Side nav: "Assets" item directly below "Accounts". It goes through `useUnsavedChanges().run`.
- `/assets` shows the list; `/assets/new` adds; `/assets/{id}` edits. Startup and `popstate` read the path. Leaving Assets for another nav item pushes `/`. Back/Forward away from a dirty asset shows the discard prompt; Stay restores the asset URL.

## Assets list (`AssetsPage`)

- Heading "Assets"; "Add Asset" button.
- Table columns: Name, Description (truncated, full text in `title`), Valuation (right aligned: amount via `formatCurrencyAmount(value.toFixed(minorUnits), currencyCode)`, then the date via `formatDisplayDate`, for example "1 Jan 2026"), and an actions column with a quill icon button labelled "Edit {name}" followed by a trash icon button labelled "Delete {name}" that opens the delete dialog without opening the asset. `minorUnits` comes from `getCurrencies`.
- Rows are in created order. After them comes one total row per entry in `totals`, in the order returned (currency code), labelled "Total {code}" with `formatCurrencyAmount(totalValue, currencyCode)`, right aligned. Empty list: an empty-state message and no total row.
- **List load failure** (GET `/api/assets` or `getCurrencies` fails with a network error or 5xx): the existing `ErrorMessage` with the error text and a "Retry" button that refetches, as `AccountsPage` does; no rows and no total row are shown. "Add Asset" stays available.
- `formatDisplayDate` and `localToday` are imported from `features/mortgages/loanDraft.ts`, and `FormattedNumberField` from `features/mortgages/FormattedNumberField.tsx`, where they live today (`docs/code-map.md`); they are not moved.
- Only the quill button (keyboard reachable) opens `/assets/{id}`, as the Categories page uses it. Clicking the row or the name does nothing.
- Delete dialog: "Delete Asset", text naming the asset, buttons "Delete" and "Cancel". On success: list refetch and toast "{name} was deleted.". On 409 `AssetEditActive`: explain that the asset is being edited in another session.

## Asset page (`AssetPage`)

- Floating-label fields: Name, Description and, only when adding an asset, Currency (the `FloatingField as="select"` used by `AccountsPage`, options "{name} ({code})" with "Select a currency" first, from `getCurrencies`). An existing asset has no currency control: its currency cannot be changed (FR-007) and is shown under the heading as text, "Currency: {name} ({code})", as `AccountDetails` shows an account's. A Valuations table, newest first: Value (right aligned), Valuation Date (`formatDisplayDate`), and a trash button per row. Deleting the last valuation is allowed in the draft; Save then shows "Add at least one valuation" and stores nothing. "Add Valuation", "Save" and "Cancel" buttons.
- "Add Valuation" is enabled once a currency is selected. It opens `AddValuationDialog` with Value (`FormattedNumberField` with `decimals` set to the asset currency's minor units, formatted in that currency) and Valuation Date, plus OK and Cancel. OK validates (field errors for duplicate or future date, negative value and over the cap) and adds the valuation to the draft only.
- When adding, changing Currency re-validates the draft: each valuation with more decimals than the new currency allows shows an error on its row, and Save is blocked until it is deleted (and re-added).
- Client rules mirror contracts/assets-api.md "Validation" for every field: Name required and 100 characters or fewer after trimming, Description 500 characters or fewer, Currency required, at least one valuation, and the valuation rules.
- The draft is dirty if it differs from what was loaded, and reports `setDirty`. Save sends the full set, then the list refetches, a toast shows and the page returns to `/assets`. Cancel goes back to `/assets` through `run`.
- Field-level errors come from the client rules and from server `errors` keys (contracts/assets-api.md).
- Each valuation row's Value is formatted with `formatCurrencyAmount` in the draft's currency, padded to its minor units, right aligned with `tabular-nums`, under a right-aligned Value header. When adding, changing Currency reformats every row; a value the new currency cannot hold is shown as entered, never rounded, beside its row error.
- Existing asset: page opens by POST `.../edits`. While that request is pending, the page shows the heading and a loading indicator (the existing loading pattern, `aria-busy`) within 500 ms, and no fields are editable.
  - **Open failure** (the opening POST `.../edits` fails with a network error or 5xx): an `ErrorMessage` with "Retry" (repeats the acquire) and "Return To Assets"; no fields are editable and no release is sent, because no edit is held.
  - **Blocked** (409 `AssetEditActive`): read-only notice "This asset is being edited in another session." with "End Other Edit" targeting `activeEdit.id` (always offered while Blocked, research R10). Polls `edit-status` every 2 s while focused and online. When Available, it acquires automatically within 5 s.
  - **Status check failure while Blocked** (a poll or focus/reconnect revalidation fails or exceeds the 2 s bound): stays Blocked, never enables editing, and shows an `ErrorMessage` with "Retry Availability Check", as `ImportPage` does (012 FR-014). Polling continues; the error clears on the next successful check.
  - **Status check failure while editing** (this session holds the edit): editing stays enabled, because Save is checked by the server; the error is shown with "Retry Availability Check" until a check succeeds. After a reconnect or return from background, editing stays disabled until one check succeeds (FR-020).
  - **End Other Edit failure** (network error or 5xx): an error toast; the page stays Blocked with End Other Edit enabled again for retry. Nothing else changes.
  - **End refused** (End Other Edit returns 409 `AssetEditChanged`, because the targeted edit is no longer the active one): refetch `edit-status` at once. If another edit is active, stay Blocked with the new `activeEdit` (End Other Edit targets the new id); if none is, acquire automatically. No error toast; nothing else changes.
  - **Ended** (`watchedEdit.state === "Ended"`): `AssetEditEndedDialog`, titled "Edit Ended", names `endedBy.userName` and says it was ended in another session. It is modal with no Escape or outside dismissal, and its one button "Return To Assets" goes back without the discard prompt (`setDirty(false)`). The ended state is latched.
  - **Expired** (client timer from `expiresAtUtc` and `serverTimeUtc` offset, or status `Expired`, or Save 409 `AssetEditExpired`): `setDirty(false)`, navigate to `/assets`, then `showPersistent("Your edit of {name} expired.")`. Leaving sends the usual release, which the server records as `Expired` (data-model.md "Release").
  - **No longer active** (status reports `watchedEdit.state` `Saved`, `Released` or `Unavailable` for the edit this page holds, which happens only after this page lost track of its own edit, for example a page restored from the back/forward cache after its `pagehide` release): `setDirty(false)`, navigate to `/assets`, then the toast "Your edit of {name} is no longer active.". No user is named (012 FR-012) and no release is sent.
  - Leaving an edit by Cancel or nav sends a fire-and-forget release (`DELETE .../edits/{editId}`). On `pagehide` (reload or close) the same release is sent with `keepalive: true`, following `features/preferences/api.ts`. If it does not arrive, the next open of the asset is Blocked by the stale edit and End Other Edit frees it.
  - **Save refused** (409): `AssetEditExpired` follows the Expired flow. `AssetEditEnded` refreshes `edit-status` and shows `AssetEditEndedDialog` with `endedBy.userName`. `AssetEditChanged`: `setDirty(false)`, navigate to `/assets`, then the toast "Your edit of {name} is no longer active.". Nothing is stored in any case.
  - **Asset gone** (Save 404 `AssetNotFound`, or 404 from the opening POST `.../edits` for a deleted, unknown or foreign asset): `setDirty(false)`, navigate to `/assets` (which refetches the list), then show the toast "This asset no longer exists.". After an opening 404 no edit is held, so no release is sent.
- **Save failure** (network error or 5xx): an error toast; the page, the draft and the dirty state are kept, and Save can be retried. Nothing is stored.

## Pending states (within 500 ms)

- Save: button shows pending and is disabled, fields disabled, until the response.
- Delete (in the delete dialog): Delete button shows pending and both buttons are disabled until the response. On a network or 5xx failure the dialog stays open with an error and the list is unchanged.
- End Other Edit: button shows pending and is disabled until the response.
- Opening an existing asset: loading indicator until the acquire response (see Asset page).
- OK in `AddValuationDialog` is client-only and completes immediately.
- `useAssetEditStatus` follows the `useImportStatus` pattern: 2 s poll, 2 s request bound, revalidate on focus and reconnect before enabling editing.

## Toasts

- `useToast()` returns `{ show, showPersistent, clearPersistent }`. Persistent toasts have no timeout and sit in their own stack at the viewport's toast edge; the regular toast viewport is placed directly above that stack, so regular toasts show above the persistent ones (spec FR-020: "stacked above it"). They are removed only by their "Dismiss" button, or by `clearPersistent`, which `App` calls when the sign-in ends (sign out or session expiry), so one user's asset name is never shown to the next (SEC-003). Regular toasts never replace, hide, overlap or push them out.

## Accessibility

- All controls are keyboard reachable with a visible focus ring. Dialogs trap focus. Amounts are right aligned with `tabular-nums`. Title Case for labels and buttons. Blocked and ended states show text and an icon, not colour alone.
