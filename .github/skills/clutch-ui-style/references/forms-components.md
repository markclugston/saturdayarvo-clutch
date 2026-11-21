# Form controls and components (style guide §4–5)

Implementation: `src/clutch-web/src/components/ui/` (fields, buttons, chips, dialog, toast) and
the feature folders that use them. Read sizes, classes and variants there; reuse the nearest
existing usage as the pattern.

## 4. Form controls

- Text inputs, selects and textareas use `FloatingField` (in-field floating label). An external label needs documented justification in the plan.
- Every field has `id`/`htmlFor`, plus `aria-invalid` and `aria-describedby` when in error. Errors use `ErrorMessage`.
- **Percentage (%) and currency ($) fields (WEB-001):** build them on `FormattedNumberField` and its `formatCurrency` / `formatPercent` helpers (`src/features/mortgages/FormattedNumberField.tsx`). Do not hand-roll filtering or formatting. Each field's decimal places and range come from its spec. A value outside the allowed range shows the standard error state. Display-only amounts use `src/lib/formatCurrencyAmount.ts`.

## 5. Components

- **Buttons:** use a `Button` variant. The primary variant is for a page's main action. Use the neutral variant for a standard grey action that is neither primary nor its companion secondary action.
- **Status:** use `StatusChip`. Status MUST NOT rely on colour alone; include text or an icon.
- **Charts:** `primary` is the dominant series, `primary-tint` the overlay series, `accent-navy` the contrast series (the `chart-*` tokens in `index.css`). No boxed gridlines; faint horizontal guides only.
- **Selection** (row, column, day, tab) uses the `selected` tint, never an outline or border.
- Touch targets are at least 40x40px.
- **Tab strips** (e.g. `MortgageTabs.tsx`) are a `nav` list of buttons with `aria-current`, not ARIA tabs. They scroll within themselves, so the page never scrolls sideways.
- **Toasts** use `toast.tsx`. **Dialogs** use `dialog.tsx`.

## Patterns not yet in code

No implementation exists yet, so this guidance stays here. The first feature that builds one adds
a primitive, and that primitive then replaces the guidance.

- **Multi-select and tag fields:** selections render as removable chips (with an x) inside the field, plus a ghost "+ Add" chip.
- **Stat cards:** a large number (28-32px, semibold) with a small coloured delta indicator that is not colour-only.
- **Non-working or disabled regions** (e.g. weekends in a timeline or calendar): a subtle diagonal hatch in `raised`.
