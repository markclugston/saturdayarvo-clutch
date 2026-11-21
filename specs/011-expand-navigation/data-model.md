# Data Model: Expandable Left Navigation

No persisted entity, schema, API payload, or migration is introduced.

## Pane state

| State | Meaning |
|---|---|
| Compact | Default when an authenticated shell is first mounted; destination icons are visible without visible text labels. |
| Expanded | Same destination icons and their labels are visible. |

Mouse hover expands the pane at 768 CSS pixels and wider, and the hamburger pins it open at any width until activated again; it collapses when neither applies. Keyboard focus on a destination does not expand it, and below 768px hover does not expand it (amended 2026-11-22). Escape dismissal was dropped: the only expansion that can cover content, the pinned one below 768px, is a deliberate user action that the hamburger reverses. Touch users navigate directly by tapping icons. Successful sign-out or an expired session removes the signed-in shell. A transient session refresh error while cached session data remains valid does not unmount it. The pinned state is persisted per user by 018.

## Existing destination state

| State | Current destination marker | Destination behavior |
|---|---|---|
| Accounts overview, details, or import | Accounts | Selecting Accounts clears the selected account and import state and opens the overview. |
| Categories | Categories | Selecting Categories opens Categories without clearing existing account/import state. |
| Administrator import limits | Neither | Selecting either destination exits administrator settings and applies that destination's existing behavior. |
| Sign-in or initial session loading | No pane | No signed-in destination control is displayed. |

These are existing application states, not new stored entities. The UI contract is defined in [navigation-ui.md](contracts/navigation-ui.md).
