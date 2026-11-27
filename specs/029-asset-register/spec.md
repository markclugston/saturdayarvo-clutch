# Feature Specification: Asset Register

**Feature Branch**: `029-asset-register`

**Created**: 2026-11-27

**Status**: Draft

**Input**: User description: "create a new navigation tab under the accounts button called "Assets". On this tab the user will be able to create assets. An asset must have Name, Description and a way to enter its value and the date the valuation was completed. The main screen shows a list of assets already entered (empty if none) with Name, Description and the most recent value and its valuation date combined as a Valuation. Only the most recent valuation is loaded for the list. Add button to add assets; trash can per asset to delete with a confirmation prompt; Cancel when adding a new asset or valuation. Assets show in the order entered. Selecting an asset allows editing its name, description and adding/deleting valuations. Asset and valuation data is saved only when the asset's Save button is pressed; OK on a valuation does not save to the database. A total row at the bottom sums every asset's most recent valuation."

## Clarifications

### Session 2026-11-27

- Q: Where should adding or editing an asset happen? → A: On its own Asset page (own URL) with Save and Cancel, returning to the Assets list afterwards.
- Q: How should a single valuation be entered? → A: An Add Valuation button opens a small dialog with Value, Valuation Date, OK and Cancel (like the mortgage Interest Rate Changes dialog).
- Q: Should audit events record valuation amounts? → A: Yes; audit details include changed name and description and each valuation added or removed with its value and date.
- Q: What happens when the same asset is edited from two tabs? → A: Follow the account import rules (`specs/012-validate-active-import`): one active edit per asset; a second session is blocked and may end the other edit before its Save is accepted; the ended session gets a blocking notice naming who ended it.
- Q: How long does an asset edit stay active? → A: 5 minutes, as for import previews; when it expires the session holding it leaves the asset and is returned to the Assets list.
- Q: How is the user told their edit expired? → A: On the Assets list, a toast says their edit expired; it stays visible until the user closes it.
- Q: Can other toasts show while the expiry toast is open? → A: Yes; they show stacked above it, and it stays until the user closes it.
- Q: Which currency do asset values use, given the app has no single display currency (each account has its own)? → A: Each asset has its own currency, chosen from the app's supported currencies as accounts do. The list shows one total row per currency.
- Q: How is an amount in another currency shown (for example USD beside AUD)? → A: The same as for accounts and mortgages: the shared formatter, with the currency's narrow symbol (for example `$2,000.00` for USD).
- Q: Can an asset's currency be changed? → A: Only while the asset is being added. Once the asset is created, its currency cannot be changed.
- Q: What happens to the expiry toast when the user signs out? → A: It is cleared.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Assets And Their Totals (Priority: P1)

The user opens Assets from the navigation and sees every asset they have entered, in the order entered, each with its name, description and current valuation in the asset's currency, followed by a total of all current valuations for each currency.

**Why this priority**: Seeing what they own and its combined worth is the reason the page exists.

**Independent Test**: With assets already stored, open Assets and check rows, order, Valuation values and the total for each currency.

**Acceptance Scenarios**:

1. **Given** the user is signed in, **When** they view the navigation, **Then** an "Assets" item appears directly below "Accounts".
2. **Given** no assets exist, **When** the user opens Assets, **Then** an empty-state message is shown with the Add Asset button available and no total row.
3. **Given** assets A, B, C were entered in that order, **When** the user opens Assets, **Then** they are listed A, B, C.
4. **Given** an AUD asset with valuations $10,000 on 2025-01-01 and $12,000 on 2026-01-01, **When** the list shows, **Then** its Valuation reads $12,000.00 with the date 1 Jan 2026.
5. **Given** two AUD assets with current valuations $12,000 and $3,500, **When** the list shows, **Then** the AUD total row reads $15,500.00.
6. **Given** AUD assets worth $12,000 and $3,500 and a USD asset worth $2,000, **When** the list shows, **Then** there are two total rows, "Total AUD" $15,500.00 and "Total USD" $2,000.00, ordered by currency code, and no amounts in different currencies are added together. Amounts are formatted as accounts and mortgages format them.

---

### User Story 2 - Add An Asset (Priority: P1)

The user presses Add Asset, enters a name, description, currency and at least one valuation (value and valuation date), and presses Save; the asset then appears at the end of the list.

**Why this priority**: Without adding assets the list stays empty.

**Independent Test**: Add an asset with one valuation, save, and confirm it appears last in the list with that valuation and the total updates.

**Acceptance Scenarios**:

1. **Given** the user is adding an asset, **When** they add a valuation and press OK, **Then** the valuation appears in the asset's valuation list but nothing is stored yet.
2. **Given** a new asset with a name and one valuation, **When** the user presses Save, **Then** the asset and its valuations are stored together and the asset appears at the end of the list.
3. **Given** the user is adding an asset, **When** they press Cancel, **Then** nothing is stored and the list is unchanged.
4. **Given** the user is entering a valuation, **When** they press Cancel on that valuation, **Then** the valuation is discarded and the rest of the unsaved asset is kept.
5. **Given** a required field is missing or invalid, **When** the user presses Save or OK, **Then** each failing field shows its error and nothing is stored.

---

### User Story 3 - Edit An Asset (Priority: P2)

The user selects an asset in the list, changes its name or description, adds or deletes valuations, and presses Save to store all changes at once.

**Why this priority**: Assets are revalued over time, so the user must record new valuations.

**Independent Test**: Select an asset, add a newer valuation and delete an older one, save, and confirm the list shows the new current Valuation and total.

**Acceptance Scenarios**:

1. **Given** the asset list, **When** the user selects an asset, **Then** its name, description and all of its valuations are shown for editing, and its currency is shown but cannot be changed.
2. **Given** an asset being edited, **When** the user adds a valuation (OK) or deletes one, **Then** the change shows immediately but is stored only when Save is pressed.
3. **Given** unsaved edits, **When** the user presses Save, **Then** all name, description and valuation changes are stored together, or none are if saving fails.
4. **Given** unsaved edits, **When** the user tries to leave the asset, **Then** the app's existing unsaved-changes prompt is shown.

---

### User Story 4 - Delete An Asset (Priority: P2)

The user presses the trash can next to an asset, confirms, and the asset and all its valuations are removed.

**Why this priority**: Sold or mistaken assets must be removable so the total stays correct.

**Independent Test**: Delete an asset after confirming and check it is gone and its currency's total drops by its value.

**Acceptance Scenarios**:

1. **Given** the asset list, **When** the user presses an asset's trash can, **Then** a confirmation prompt names the asset.
2. **Given** the confirmation prompt, **When** the user confirms, **Then** the asset and its valuations are deleted, it leaves the list, the total updates and a success message is shown.
3. **Given** the confirmation prompt, **When** the user cancels, **Then** nothing changes.

### Edge Cases

- Two valuations of one asset share the latest date → not allowed; each valuation date is unique within an asset and the error shows on the date field.
- Valuation date in the future → rejected with a field error.
- Deleting the only valuation of an asset → Save is blocked with an error until a valuation is added.
- Value of $0.00 → accepted; negative values → rejected.
- A value with more decimal places than the asset's currency allows (for example any decimals for JPY) → the entry control does not accept the extra digits, and the server rejects it with a field error.
- While adding an asset, changing its currency to one with fewer decimal places while a valuation has more → the value is shown as entered, never rounded, and Save is blocked with an error on each such valuation until it is deleted and re-added.
- A Save of an existing asset that names a different currency → refused with a field error on the currency, nothing is stored.
- Save or delete fails (network or server error) → user sees an error, unsaved edits are kept, list is unchanged.
- Loading the list, opening an asset, checking edit status or ending another edit fails (network or server error) → the user sees an error with a way to retry; a failed status check never enables editing of a blocked asset, as for imports.
- The page's own edit is found to be no longer active for a reason other than expiry or being ended elsewhere → the session returns to the Assets list with a toast saying the edit is no longer active, naming no user.
- The asset was deleted elsewhere while being edited → Save reports the asset no longer exists and the list refreshes.
- An asset URL is opened (reload, bookmark or Back) for an asset that no longer exists or belongs to another user → the session returns to the Assets list and a toast says the asset no longer exists.
- Long names and descriptions → truncated in the list with the full text available in the edit view.
- Two sessions open the same asset for editing at the same moment → at most one gets the active edit; the other sees the blocked state.
- Save and "end the other edit" race → exactly one succeeds; an ended edit never stores changes, and an edit whose Save has been accepted cannot be ended.
- A stale "end the other edit" request → never ends a newer edit; the blocked screen refreshes its status and either stays blocked (offering to end the newer edit) or takes the edit if none is active.
- The active edit reaches 5 minutes → it expires and no longer blocks; the session holding it leaves the asset, unsaved edits are discarded without the unsaved-changes prompt, and the Assets list is shown with a toast saying the edit expired that stays until the user closes it.
- Save pressed after the edit has expired → refused, nothing is stored, and the session is returned to the Assets list.
- Deleting an asset that has an active edit elsewhere → blocked with the same conflict explanation.
- The page holding an edit is reloaded or closed → the app releases the edit as the page unloads, best effort. If the release does not reach the server, the edit stays active until it expires or is ended: reopening the asset shows the blocked state with End Other Edit, and deleting it is blocked with the conflict explanation.
- Save reaches the server after the edit was ended elsewhere → refused, nothing is stored, and the blocking notice naming who ended it is shown.
- Save reaches the server after the edit stopped being the asset's active edit for any other reason → refused, nothing is stored, the session returns to the Assets list and a toast says the edit is no longer active.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Navigation MUST show an "Assets" item directly below "Accounts" that opens the Assets page.
- **FR-002**: The Assets page MUST list the signed-in user's assets in the order they were created, showing Name, Description and Valuation (most recent value with its valuation date, shown in the app's display date format, for example "1 Jan 2026").
- **FR-003**: Loading the list MUST retrieve only each asset's most recent valuation, not its full valuation history.
- **FR-004**: The most recent valuation MUST be the one with the latest valuation date.
- **FR-005**: The list MUST end with one total row per currency that has assets, ordered by currency code and labelled "Total {code}", each summing the most recent valuation value of every asset in that currency. Amounts in different currencies MUST NOT be added together. An empty list has no total row.
- **FR-006**: The page MUST provide an Add Asset button that opens a new asset on its own Asset page (separate URL); a successful Save returns to the Assets list.
- **FR-007**: An asset MUST have a Name (required, 1–100 characters), a Description (optional, up to 500 characters) and a Currency (required, one of the app's supported currencies, chosen with the same currency selector accounts use). The currency is chosen while the asset is being added and MUST NOT change once the asset is created.
- **FR-008**: A valuation MUST have a Value (required, in the asset's currency, zero or more, at most 999,999,999,999.99, with no more decimal places than the currency's minor units, for example 2 for AUD and 0 for JPY) and a Valuation Date (required, not in the future).
- **FR-009**: An asset MUST have at least one valuation to be saved, and valuation dates MUST be unique within an asset.
- **FR-010**: An Add Valuation button MUST open a dialog with Value, Valuation Date, OK and Cancel; OK adds the valuation to the asset's unsaved valuations, Cancel discards it.
- **FR-011**: Adding a new asset MUST offer Cancel, which discards the unsaved asset without storing anything and returns to the Assets list.
- **FR-012**: Selecting an asset MUST open it on its own Asset page for editing with its name, description, currency and full valuation list, allowing name and description changes and adding and deleting valuations. The currency is shown as it is for an existing account and cannot be changed.
- **FR-013**: Asset and valuation changes MUST be stored only when the asset's Save button is pressed, as one all-or-nothing change.
- **FR-014**: Leaving an asset with unsaved changes MUST use the app's existing unsaved-changes prompt.
- **FR-015**: Each asset row MUST have a trash can button that asks for confirmation naming the asset; on confirmation the asset and all its valuations are deleted and a success message is shown.
- **FR-016**: All asset and valuation fields MUST be validated in the UI with field-level errors and again on the server, which returns errors identifying each failing field.
- **FR-017**: Users MUST only see, change and delete their own assets.
- **FR-018**: Creating, updating and deleting an asset MUST be recorded as audit events whose details include the name and description (those changed, for an update), the currency (for a create or delete) and each valuation added or removed with its value, currency and date.
- **FR-019**: Values MUST be entered with the app's established currency entry control, limited to the asset currency's decimal places, and displayed formatted in the asset's currency and right aligned, including the totals.
- **FR-020**: Concurrent editing MUST follow the account import rules (`specs/012-validate-active-import`), with the asset in place of the account and the open edit in place of the import preview:
  - Opening an existing asset for editing MUST take a server-coordinated edit lease; at most one active edit per asset across sessions. The edit expires 5 minutes after it was opened, as an import preview does.
  - When the edit expires, the session holding it MUST leave the asset and show the Assets list, discarding unsaved edits without the unsaved-changes prompt; a Save that reaches the server after expiry MUST be refused and store nothing.
  - On arriving at the Assets list after expiry, the app MUST show a toast stating that the edit of the named asset expired. Unlike other toasts, it MUST NOT close automatically; it stays visible until the user closes it. Other toasts MUST still show while it is open, stacked above it, and MUST NOT hide, replace or push it out. Signing out, or the sign-in ending another way, MUST clear it.
  - A session opening an asset with another active edit MUST be told an edit is already active and MUST NOT be able to edit or delete it.
  - While the other edit's Save has not been accepted, the blocked session MUST be offered an action to end that specific edit; ending rechecks eligibility, never ends a newer edit, and is mutually exclusive with Save.
  - A connected, foreground session whose edit was ended elsewhere MUST show, within five seconds, a blocking notice naming the user who ended it; acknowledging returns to the Assets list, and the ended edit stores nothing. On reconnect or return from background the same check runs before editing is enabled.
  - A blocked session MUST refresh automatically and allow editing within five seconds once no active edit remains.
  - Rejected concurrent edits and edits ended elsewhere MUST be audited, as imports are. A delete refused because another edit is active stores nothing and is not audited, as imports audit only a refused concurrent start; it is counted in metrics.
  - Leaving an asset by Cancel or navigation MUST release its edit; reloading or closing the page MUST attempt the release as the page unloads (best effort).
  - Adding a new asset takes no lease.

### Key Entities *(include if feature involves data)*

- **Asset**: Something of value the user owns; name, optional description, currency, owning user, creation order.
- **Valuation**: The value of an asset as at a date; value, valuation date, belongs to one asset (deleted with it).
- **Asset Edit**: The single active edit of an asset; owning session, expiry, whether its Save has been accepted, and, if ended elsewhere, who ended it and when.

### Constitution Scope

Tick each that applies, so plan can pick requirement IDs without rereading the spec:

- [x] Stores, changes or deletes data (DOT-002, OPS-001 migrations)
- [x] Creates or reads audit records (AUD-001)
- [x] Adds or changes endpoints, auth or input handling (SEC-001, SEC-004)
- [x] Handles personal, payment or financial data (SEC-003)
- [x] Changes UI in clutch-web (WEB-001, style guide)

## Success Criteria *(mandatory)*

- **SC-001**: A user can add an asset with one valuation in under 1 minute.
- **SC-002**: The Assets list with 100 assets is shown within 2 seconds of selecting Assets.
- **SC-003**: Each currency's total always equals the sum of the current valuations of the listed assets in that currency, to the currency's smallest unit.
- **SC-004**: Cancelling an add, or leaving without saving, stores nothing in 100% of cases.
- **SC-005**: No asset or valuation data is stored or deleted without an explicit Save or delete confirmation.

## Assumptions

- Sign-in, per-user ownership, error format, audit storage, validation and data fetching follow the existing implementation (see `docs/code-map.md`); mortgages (`src/Clutch.API/Application/Mortgages/MortgageService.cs`) are the nearest pattern.
- "Under the accounts button" means the next item below Accounts in the side navigation. The app has no last-visited page preference (navigation state stores only Pinned or Unpinned), so none is added; the `/assets`, `/assets/new` and `/assets/{id}` URLs reopen the same page on reload.
- Description is optional; Name is the only required asset field.
- Every saved asset has at least one valuation, so every list row has a Valuation.
- Existing valuations can be deleted but not edited; correcting one means deleting it and adding another.
- In the edit view valuations are listed newest first.
- The app has no single display currency (each account has its own), so each asset has its own currency from the supported list (`Domain/Shared/Currency.cs`). There is no currency conversion: totals are per currency.
- No limit on the number of assets or valuations is introduced.
- Assets are standalone and are not linked to accounts or mortgages, and do not change any other page's totals.
