# Lists (style guide §12)

Every list follows the Assets list (WEB-001). Its parts are shared: build every list from them
and do not restyle them. Open the Assets list before planning or building any list, and take sizes
and wording patterns from it.

| Concern | Reference (`src/clutch-web/src/`) |
|---|---|
| Card, region, table, header, rows, cells, row buttons, loading, failure and empty states | `components/ui/list.tsx` |
| Delete confirmation | `components/ui/delete-dialog.tsx` |
| The reference list, with its footer and truncated cells | `features/assets/AssetsPage.tsx` |
| Removing an unsaved row from a form | `features/assets/AssetForm.tsx` |
| Scrolling | `lib/usePinnedList.ts` |
| Tests | `components/ui/list.test.tsx`; `pinnedLists` in `../e2e/style-guide.spec.ts` |

For a list, follow these files, not the nearest sibling.

**What is a list:** any collection of records shown as rows or items (table, grid, `ul`/`ol`),
on a page, in a card or in a dialog. Navigation, tab strips, drop-down options, chart legends and
toasts are not lists.

## Deviations need the user's approval

A list may differ from this section only when the user explicitly approves that difference.

- Ask before planning or building it. Name the list, the rule, what would differ and why.
- Approval is the user's own words naming the difference: their answer, or a feature description
  that asks for it. A justification, an assumption written into a spec or plan, a similar
  difference elsewhere or no reply is not approval.
- Record it in the plan's Complexity Tracking with the date and the user's words. It covers that
  list and that difference only.
- A rule that cannot work in a context (for example, inside a dialog) is also a difference: ask.

## Structure and header

- The list sits in a `Card`. No card title when the page heading already names the list;
  otherwise a `CardTitle` above the scrolling region.
- A semantic `table` with a screen-reader-only `caption` and `th scope="col"` headers.
- The rows are inside a labelled, keyboard-focusable region with the `focus-ring`.
- The column header is sticky, on the `raised` tone, with Title Case labels. Numeric and currency
  headers are right aligned. The actions column's header is "Actions", for screen readers only.

## Line styles and cells

- One `hairline-b` under each row. No other borders, vertical lines, row striping or hover tint.
- Cell padding, text size and width are those of the reference.
- The item's name is medium weight. Long names and descriptions truncate to one line and carry the
  full text in `title`; descriptions use the secondary text colour.
- Numbers and currency amounts are right aligned, use tabular figures and do not wrap. A related
  value (such as its date) sits beneath in smaller secondary text.
- A missing optional value leaves the cell empty.
- Totals are footer rows on the `raised` tone, semibold, one per currency, each with a row header.

## Scrolling

`ListCard` wires `usePinnedList`; a card that holds more than a list uses the hook with
`ListRegion`. Do not re-implement it or give a list its own vertical scrollbar.

- A card taller than the content panel stops at its top, with a margin, while one page scroll
  moves the rows. The column header stays where it is in the card. Scrolling back reverses this.
- Footers, "Load More", its errors and anything else after the rows are reached at the end of the
  list, never held in view.
- A list that fits looks and scrolls normally. With too little height, the page scrolls normally.
- A wide table scrolls sideways within its card, header aligned with its columns.
- A row control that receives keyboard focus is brought fully into view, below the header.

## Edit and remove buttons

Show only the actions the spec asks for.

- In the last column, right aligned, on one line: edit first, then delete.
- Each is an icon-only `Button` (`size="icon"`, `variant="tertiary"`) with an accessible name that
  identifies the row, such as "Edit {name}" and "Delete {name}".
- Edit and rename use the Lucide `Feather` icon. Delete and remove use `Trash2` in the `danger`
  colour.
- **Deleting saved data** is confirmed in an alert dialog that follows the reference: a Title Case
  title, a description naming the item and saying it cannot be undone, a danger "Delete" button and
  a secondary "Cancel" button that has initial focus. While deleting, both are disabled and the
  label shows progress. Failures show in the dialog; an item already gone offers "Close". Success
  closes the dialog, refreshes the list and shows a toast naming the item.
- **Removing an unsaved row** from a form applies at once, without a dialog, and moves focus to a
  stable control.

## Around the list

- A page that adds items has a primary "Add {Item}" button with the `Plus` icon at the end of the
  page heading row. A list that is one section of a form puts a secondary one beside its card title.
- Loading: a spinner with a "Loading {items}…" status, motion-safe.
- Load failure: `ErrorMessage` and a secondary "Retry" button.
- Empty: a `Card` with one secondary-colour sentence saying what to do next, and no table.

## Tests

A new or changed list has component tests for its headers, cells, row actions, dialog and states.
Add it to `pinnedLists` and to the style-guide states in `e2e/style-guide.spec.ts`.

## Approved differences

The user approved these on 2026-11-28 (their words, or the option they chose). Each covers only
what it names, and none is a pattern to copy. Do not change them unasked (ARC-001).

| List (`features/`) | Approved difference | Approval |
|---|---|---|
| `categories/CategoriesPage.tsx` | Everything, including its states and delete dialog | "Approve as is"; "just like categories is different" |
| `accounts/AccountsPage.tsx` | Everything: account tiles, states and the add form | "the account table should stay as is. its not a list in the same way as the others"; "dont change accounts" |
| `mortgages/InterestRateChangesDialog.tsx` | Scrolls within the dialog, with no pinned scrolling | "Table styled like Assets, still scrolling below the add inputs" |
| `mortgages/InterestRateChangesDialog.tsx` | Adds through inputs above the table | "Inputs stay above the table; recorded as an approved difference" |
| `accounts/AccountDetails.tsx` (transactions) | Secondary "Import Transactions" button above the heading, not a primary "Add" button | "No change to the button; recorded as an approved difference" |
