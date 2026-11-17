# Data Model: Expandable Left Navigation

No persisted entity, schema, API payload, or migration is introduced.

## Pane state

| State | Meaning |
|---|---|
| Compact | Default when an authenticated shell is first mounted; destination icons are visible without visible text labels. |
| Expanded | Same destination icons and their labels are visible. |

Mouse hover or keyboard focus expands the pane; it collapses when neither applies. Escape dismisses an expanded pane without moving the pointer or focus, until a new hover or keyboard focus interaction. Touch users navigate directly by tapping icons. Successful sign-out or an expired session removes the signed-in shell. A transient session refresh error while cached session data remains valid does not unmount it. No expansion state is persisted.

## Existing destination state

| State | Current destination marker | Destination behavior |
|---|---|---|
| Accounts overview, details, or import | Accounts | Selecting Accounts clears the selected account and import state and opens the overview. |
| Categories | Categories | Selecting Categories opens Categories without clearing existing account/import state. |
| Administrator import limits | Neither | Selecting either destination exits administrator settings and applies that destination's existing behavior. |
| Sign-in or initial session loading | No pane | No signed-in destination control is displayed. |

These are existing application states, not new stored entities. The UI contract is defined in [navigation-ui.md](contracts/navigation-ui.md).
