# UI Contract: Shared List Primitives

Classes and behaviour are moved unchanged from `features/assets/AssetsPage.tsx` and
`DeleteAssetDialog.tsx` (paths under `src/clutch-web/src/`).

## `components/ui/list.tsx`

| Export | Shape |
|---|---|
| `ListCard` | `label`, `title?`, `end?`, `empty?`, `className?`, `as?`, `aria-labelledby?`, children (a `ListTable`). Renders track, sticky `Card`, region and spacer with `usePinnedList`. Passing `end` (a node or `null`) keeps the wrapper that holds content reached after the rows. `empty` replaces the region and keeps the card and title, so a focused title button survives. |
| `ListRegion` | `label`, `ref?`, `scroll: 'page' \| 'self'`, `className?`. Labelled, focusable region; `page` hides vertical overflow, `self` scrolls it. |
| `ListTable` | `caption`, table attributes, `ref?` |
| `ListHead`, `ListBody` | Sticky raised `thead`; isolated `tbody` |
| `ListRow` | `tr` with the hairline |
| `ListHeaderCell` | `th scope="col"`, `numeric?` |
| `ListCell` | `td`, `numeric?` |
| `ListActionsHeader`, `ListActionsCell` | Screen-reader "Actions" header; right-aligned, unwrapped cell |
| `EditButton`, `DeleteButton` | `label` (accessible name) and button attributes |
| `ListLoading` | `children` (message): spinner status |
| `ListLoadError` | `children` (message), `onRetry` |
| `ListEmpty` | `children`: card with one secondary sentence |

Truncated text stays at the call site (`block truncate` with `title`), with the reference widths.
The import review has no empty state: the server refuses a file with no rows.

## `components/ui/delete-dialog.tsx`

`DeleteDialog`: `title`, `description`, `busy`, `message?`, `gone`, `onConfirm`, `onClose`.

## Lint

`clutch/numeric-align` also reports a `ListCell` or `ListHeaderCell` that shows a formatted amount
without `numeric`.

## Per-list columns

| List | Region label | Caption | Columns |
|---|---|---|---|
| Transactions | Transactions | unchanged | unchanged |
| Valuations | Valuations | unchanged | unchanged |
| Import review | Validated transactions | unchanged | unchanged |
| Schedule | Schedule Rows | Repayment schedule by period | unchanged; fixed widths (`table-fixed`) |
| Rate changes | Interest Rate Changes | Interest rate changes, oldest first | Interest Rate (numeric), Effective Date, Actions |
