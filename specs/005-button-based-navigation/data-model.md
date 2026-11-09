# Data Model: Button-Based Navigation and Actions

This feature does not add persisted data or change API schemas. The model describes the existing view state and its user-facing controls so the behavior can be preserved and tested.

## View State

| View | State / identifying data | Entry and exit behavior | Validation / access |
|---|---|---|---|
| Family | Default view; family query state is held by the feature component | Initial authenticated view; successful family creation or “View accounts” enters Accounts | Preserve query loading and error feedback |
| Accounts | `showAccounts` | Enter from Family; selecting an account enters Account Details | Preserve the existing account list and selection behavior |
| Account Details | `selectedAccountId` | Enter by selecting an account; Back returns to Accounts; Import enters Import | The account identifier must be the selected account's existing identifier |
| Import | `selectedAccountId` plus `isImporting` | Enter from Account Details; Back returns to Account Details | Preserve current account association, pending state, and import result/error behavior |
| Administrator settings | `showAdminSettings` | Open with the administrator-only header control; Back restores the underlying view state | Only render the entry control for a session with the Administrator role |

These are views of one in-memory SPA state, not URL routes. `App.tsx` currently represents them using `showAccounts`, `selectedAccountId`, `isImporting`, and `showAdminSettings`; the plan does not require changing this representation.

## Navigation / Action Control

| Field | Requirement |
|---|---|
| Accessible role | Native `button` for navigation and action controls |
| Accessible name | Visible text or an equivalent accessible name that identifies the purpose |
| Operation | Existing navigation callback or user action; no new destination or outcome |
| Availability | Preserve existing permission checks and pending/disabled state |
| Feedback | Preserve existing result, busy, and error presentation; show a visible response within 500 ms |
| Focus | Keep visible keyboard focus; after a view transition, focus the destination's primary heading |
| Presentation | Button-like styling and hand pointer cursor on hover; never hyperlink-like underline styling |

Native inputs, selects, and other form controls remain unchanged when they are not being used as navigation/action proxies.

## State Transitions

- Family → Accounts after the existing navigation action or successful family creation.
- Accounts → Account Details with the selected account identifier.
- Account Details → Accounts through the existing back action.
- Account Details → Import for the same selected account.
- Import → Account Details through the existing back action.
- Any underlying view → Administrator settings only when the session includes the Administrator role; Back restores the prior underlying state.
- Sign-out continues to run its existing mutation, resets view and theme state, and returns to the signed-out experience.

## Action Lifecycle

Actions that involve asynchronous work retain their existing lifecycle:

1. Available button accepts pointer or keyboard activation.
2. The interface responds visibly within 500 ms.
3. If work continues, the button or related region exposes its existing busy/disabled state; measurable progress is shown when available.
4. Completion displays the existing result; failure displays the existing error feedback without a success-shaped fallback.
