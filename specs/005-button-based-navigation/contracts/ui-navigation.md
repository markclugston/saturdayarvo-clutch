# UI Contract: Navigation and Actions

## Scope

This contract covers user-facing navigation and action controls in `clutch-web`. It does not change server endpoints, API payloads, authorization rules, data persistence, or browser URL/history behavior.

## Control Contract

- Navigation and user-triggered action controls are native buttons, not anchors or generic elements with `role="button"`.
- Each button has an accessible name that communicates its purpose and a visible keyboard focus state.
- Enter and Space activate the button using native browser behavior.
- Buttons are visually identifiable as buttons and show a hand pointer cursor when hovered. Navigation buttons do not use hyperlink-like underline styling.
- Existing permissions, destinations, outcomes, disabled states, loading states, and error feedback are preserved.
- A view-changing button moves focus to the destination view's primary heading. An action that does not change views retains normal button focus behavior.
- A user action has visible feedback within 500 ms. Longer operations show a busy state and progress when measurable.
- Native form controls (including the theme selector) remain form controls; they are not navigation controls.

## Navigation Behavior

| Control purpose | Result |
|---|---|
| Open Accounts | Show the existing accounts view |
| Select an account | Show details for that account |
| Return from Account Details | Show Accounts |
| Start Import | Show the import view for the selected account |
| Return from Import | Show Account Details for the same account |
| Open Import Limits | Show administrator settings only to an authorized administrator |
| Return from administrator settings | Restore the underlying view |

Action controls retain their existing behavior, including family creation, account updates, transaction/import operations, retry, and sign-out.

## Existing Control Inventory

| View | Control | Existing result | Pending / unavailable / error behavior |
|---|---|---|---|
| Sign-in | Sign in / Create account | Submit credentials and invalidate the session query; the secondary button switches between sign-in and registration | Submit is disabled with a progress label while pending; API errors are announced |
| Session recovery | Try again | Refetch the session | Startup loading dialog is shown during the retry; the existing error remains visible on failure |
| Application header | Import limits | Open administrator settings; only rendered for an Administrator role | Import limits query and save feedback remain within the settings view |
| Application header | Sign out | Sign out, clear the selected view and theme preference cache, reset to Light, and return to the signed-out experience | Button is disabled while pending; an error alert is shown on failure |
| Family | View accounts | Show the accounts view | No asynchronous work |
| Family | Create Family | Create the user's Family, refresh Family data, then show Accounts | Disabled with a progress label while pending; API errors are announced |
| Accounts | Account selection | Show details for the selected account ID | Account and currency query errors remain announced |
| Accounts | Add account | Create the account, refresh Accounts, then show its details | Disabled with a progress label while pending; validation and API errors remain announced |
| Account Details | Back to accounts | Return to Accounts | No asynchronous work |
| Account Details | Import transactions | Open Import for the selected account | No asynchronous work |
| Account Details | Save description | Update the selected account description and refresh account data | Disabled while unchanged or pending; validation/API errors remain announced |
| Transactions | Load more | Fetch and append the next transaction page | Disabled with a loading label while pending; fetch errors remain announced |
| Import | Back to account / Cancel import review | Return to Account Details, cancelling the active review first when one exists | Disabled while confirm/cancel is pending; cancellation failures remain announced |
| Import | Choose CSV file | Open the file chooser; read only CSV headers in the browser | Header-reading status and file errors remain visible |
| Import | View or change settings / Use saved settings | Toggle between the account's compatible saved mapping and the editable mapping form | Saved-settings lookup and mapping errors remain announced |
| Import | Review import with saved settings / Review import | Create a review for the selected account using the selected or saved mapping | Disabled with a progress label while pending; server validation and review-recovery errors remain announced |
| Import review | Confirm import | Confirm the review and display the imported count/settings result | Disabled until required duplicate acknowledgement and while pending; duplicate/API errors remain announced |
| Import review | Cancel review | Cancel the active review and return to the import form | Disabled while confirm/cancel is pending; cancellation errors remain announced |
| Import recovery | Discard active review | Cancel an active review for the selected account | Disabled with a progress label while pending; API errors remain announced |
| Import result | Return to account | Return to Account Details after showing the completed import result | No asynchronous work |
| Administrator settings | Back to the application | Restore the underlying application view | No asynchronous work |
| Administrator settings | Save limits | Persist shared import limits and refresh the settings query | Disabled when unchanged or pending; API errors remain announced |

## Accessibility and Responsive Behavior

- Automated UI tests query buttons by accessible role and name.
- Every flow is operable with keyboard-only input.
- Button controls remain visible, usable, and legible at narrow and desktop viewports in Light, Dark, and System modes.
- Automated accessibility checks target WCAG 2.2 AA and require no axe-core violations on covered views.
- No navigation/action control is rendered as an anchor.
