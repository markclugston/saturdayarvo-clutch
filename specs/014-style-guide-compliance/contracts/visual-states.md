# Contract: Visual and accessibility states (`e2e/style-guide.spec.ts`)

- **Run**: every state runs for each theme (Light and Dark) and each project (`desktop-1024` at 1024×768, `desktop-1440` at 1440×900), through `playwright.style-guide.config.ts` only. The default `playwright.config.ts` ignores this spec (`testIgnore`).
- **Per state**:
  - `toHaveScreenshot('<state>-<theme>.png')` (only when `STYLE_SCREENSHOTS=1`).
  - An axe scan with the `wcag2a`, `wcag2aa`, `wcag21aa` and `wcag22aa` tags, expecting zero violations.
  - A check that there is no horizontal page scroll.
  - A focus sweep: Tab through every focusable element; each has a computed `outline-style` other than `none` and an `outline-width` of at least 2px (D5).
  - Surface checks (computed style): the `Primary` nav background equals `canvas`; signed-in states have a `main` whose background equals `content` and whose border radius is 22px; every element marked `data-slot="card"` has background `card` and radius 16px; `nav`, `main`, `header` and cards have zero border width on all sides; the current nav item's background contrast against `canvas` is at least 3:1. Pre-auth states check the same for their own `main` and card.
- **Test names**: `<state> [Light]` and `<state> [Dark]`, so a run can be limited to one theme with `--grep`.
- **Screenshots**: taken only when `STYLE_SCREENSHOTS=1`. Baselines are created once (T055); earlier runs check axe, scroll, focus and surfaces only.
- **API**: mocked with `page.route`. "Errors" states mock the form's submit endpoint with a 400 ProblemDetails response (`{ title, detail }`), submit the form, and wait for its `role="alert"` message (R11).
- **Theme for pre-auth states**: states 1–5, 22 and 23 run before the theme preference loads, so the harness applies `document.documentElement.classList.add('dark')` for their `[Dark]` runs. Every other state reaches Dark through the mocked preference response.

| # | State | Screen or component |
|---|---|---|
| 1 | `sign-in` | AuthPage default |
| 2 | `sign-in-errors` | AuthPage after a failed submit (form-level message) |
| 3 | `sign-in-field-focused` | AuthPage email field focused and empty (floated label) |
| 4 | `sign-in-field-filled` | AuthPage email field filled and blurred |
| 5 | `startup-loading` | StartupLoadingDialog open over AuthPage |
| 6 | `accounts` | AccountsPage with accounts, including a long name |
| 7 | `accounts-create-errors` | AccountsPage create form after a failed submit |
| 8 | `nav-expanded` | Accounts with the navigation expanded by keyboard focus |
| 9 | `account-details` | AccountDetails with a wide transactions table |
| 10 | `account-details-errors` | AccountDetails edit form after a failed submit |
| 11 | `delete-transaction-dialog` | DeleteTransactionDialog open |
| 12 | `import-mapping` | ImportPage with a CSV chosen and the mapping form shown |
| 13 | `import-mapping-errors` | ImportPage mapping form after a failed submit |
| 14 | `import-review` | ImportReviewTable with a warning status and the duplicate-confirmation checkbox |
| 15 | `import-ended-dialog` | ImportEndedDialog open |
| 16 | `categories` | CategoriesPage tree, including a long name |
| 17 | `categories-errors` | CategoriesPage create form after a failed submit |
| 18 | `delete-category-panel` | CategoriesPage with the inline DeleteCategoryDialog panel open |
| 19 | `import-limits` | ImportLimitsPage as an administrator |
| 20 | `import-limits-errors` | ImportLimitsPage after a failed save |
| 21 | `theme-selector-error` | header with the theme preference load failure message |
| 22 | `sign-up` | AuthPage in create-account mode, with the password requirements description |
| 23 | `session-error` | the session load error screen (AuthPage plus "Unable to load your session" and Try again) |

Extra assertions:
- Switching the theme while dialog 11 is open updates the dialog surface. The harness toggles the `dark` class on `<html>` (the theme selector is inert behind the modal dialog) and compares the popup's computed `background-color` before and after.
- With `reducedMotion: 'reduce'`, the nav's computed `transition-duration` is under 50ms.
- Without reduced motion (a new context with `reducedMotion: 'no-preference'`), it is between 150 and 250ms.
- The dialog 11 popup meets the same two duration bounds.
- `nav-dismissed-tooltip`: Tab into the nav, then press Escape. The nav collapses, and the still-focused item shows a tooltip with its label. That tooltip passes the axe scan.
- In Dark, no element has a computed background of `rgb(0, 0, 0)` or text colour of `rgb(255, 255, 255)`.
- Surface lightness, computed from the rendered nav (`canvas`), `main` (`content`), a card and a floating field (`raised`): in Dark it strictly increases `canvas` < `content` < `card` < `raised`; in Light `content` and `raised` are darker than `canvas` and `card`, which are equal.
