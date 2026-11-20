# Contract: Mortgages UI

Accessible names and roles that tests (Vitest, Playwright, axe) rely on.

## Navigation

- Side nav button "Mortgages", directly above "Categories"; `aria-current="page"` when shown.
- Every nav click and Sign out goes through the unsaved-changes guard.

## Screen states (content panel)

| State | Shows |
|---|---|
| Loading | `role="status"`: spinning `LoaderCircle` (as `StartupLoadingDialog`) + "Loading..." |
| Load failed | `role="alert"`: "We couldn't load your mortgages. Please try again." + button "Retry" (returns to Loading at once) |
| Loaded | Tab strip → Loan details panel → Burn Down (left) and Amortization Schedule (right); stacked, chart first, below 768 px |

## Tab strip

- `nav` labelled "Mortgages" containing a `list`; each item holds a select button (mortgage name, `aria-current="true"` when selected) and its "Delete {name}" button. The last item is the "Add mortgage" button. Tab/Shift+Tab move between buttons; Enter/Space selects. The strip scrolls horizontally within itself. No `tablist`/`tab` roles (a tablist may not own the delete buttons).
- One select button per mortgage (name, truncated with full name in `title` and accessible name), then button "Add mortgage" (no trash). At 20 mortgages "Add mortgage" is `aria-disabled="true"` (not the `disabled` attribute, so it stays focusable and hoverable): the text "You can save up to 20 mortgages" is its native `title` (shown on hover) and its accessible description (`aria-describedby` to visually hidden text). Clicking it or pressing Enter/Space does nothing.
- Each mortgage's select button has a sibling button "Delete {name}" (Trash2 icon) → dialog "Delete {name}?" with "Delete" / "Cancel"; Cancel returns focus to the trash button. Delete shows busy text "Deleting…" and is disabled while the request runs. On 409 the dialog stays open with `role="alert"` "This mortgage was changed elsewhere; reload to see the latest" + button "Reload" (closes the dialog and refreshes, through the guard when dirty).

## Loan details panel (styled like `AddCategoryForm`)

- Region heading "Loan details". Floating-label fields: "Name", "Starting balance", "Number of periods", "First repayment date" (`type="date"`), "Repayment frequency" (select: Weekly, Fortnightly, Monthly).
- Group "Interest rate changes": rows of "New interest rate" (%) and "Effective date" (`type="date"`), each with "Remove interest rate change {n}"; button "Add interest rate change" disabled with hint "Enter the first repayment date, number of periods and repayment frequency first" until those are valid, and disabled at 60 rows.
- Buttons: "Save" (busy text "Saving…"), "Cancel". No Delete button.
- Field errors under each field, linked by `aria-describedby`, `aria-invalid="true"`; a summary is announced via `role="alert"`. Errors without a field input (`mortgages`, set-level `interestRateChanges`) appear in that summary; set-level `interestRateChanges` also shows under the "Interest rate changes" group.
- Conflict: `role="alert"` "This mortgage was changed elsewhere; reload to see the latest" + button "Reload".
- Other save failures (500, 413, network error, unreadable response): `role="alert"` "The mortgage could not be saved. Please try again." above Save; values kept; no error details (SEC-003).
- Other delete failures (500, network error): the delete dialog stays open with `role="alert"` "The mortgage could not be deleted. Please try again."; Delete becomes available again.

## Dialogs

- Discard-or-stay (rendered by `UnsavedChangesProvider`): title "Discard unsaved changes?", buttons "Discard changes" / "Stay on this page".
- Session expired (only when a request returns 401 while the Loan details are dirty): title "Your sign-in has expired", text says signing in again loses unsaved changes, buttons "Stay on this page" / "Sign in again". A 401 while clean, including on load, returns to the sign-in screen with no dialog and no load-failed alert.
- Browser refresh/close while dirty: native `beforeunload` prompt.

## Burn Down group

- Heading "Mortgage Burndown"; SVG `role="img"` with label describing a balance-over-time line chart for the Bank schedule, not yet calculated; legend "Bank schedule"; message "The burn down will appear once the schedule is calculated."
- New/unsaved mortgage: "Please enter your mortgage details" instead of the chart.

## Amortization Schedule group

- Heading "Amortization Schedule"; `role="table"` with columns "Period", "Date", "Bank schedule"; rows 1..N+1 (`aria-rowcount`), cells "Not yet calculated"; sticky header; scrolls inside the group; no inputs.
- New/unsaved mortgage: "Please enter your mortgage details" instead of the table.

## Toast

- "Mortgage saved", `role="status"`, bottom-right (bottom-centre < 768 px), close button "Dismiss", auto-closes after 5 s unless hovered or focused.
- "This mortgage was deleted elsewhere": same toast, shown when a save, delete or Reload finds the mortgage gone (404).
