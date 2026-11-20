# Form controls and components (style guide §4–5)

## 4. Form controls (floating labels)

All text inputs, selects and textareas use an **in-field floating label**. External labels need documented justification.

- **Resting and empty:** the label sits inside the field at body size in `fg-secondary` (`fg-muted` fails AA for label text), vertically centred.
- **Focus or filled:** the label moves up and shrinks to about 75% (150-200ms ease-out, `transform` only) at the top of the field. The value sits in the lower portion. Field height is 52-56px.
- Field background is `raised`. No border at rest.
- **Focus:** the shared `focus-ring` utility (2px `primary` outline, 2px offset). Never a heavy outline.
- **Error:** label and ring use `danger`, with helper text below. **Disabled:** reduced opacity, no pointer events.
- **Multi-select and tag fields:** selections render as removable chips (with an x) inside the field, plus a ghost "+ Add" chip.
- Every field MUST have `id`/`htmlFor`, and `aria-invalid` and `aria-describedby` when in error.

```tsx
// FloatingField (sketch). The label floats with transform, so only colour and transform transition.
<div className="relative rounded-control bg-raised">
  <input
    id={id}
    placeholder=" "
    className="peer h-14 w-full rounded-control bg-transparent px-3 pt-5 pb-1.5 text-fg
               placeholder:text-transparent focus-visible:focus-ring"
  />
  <label
    htmlFor={id}
    className="pointer-events-none absolute left-3 top-4 origin-left text-sm text-fg-secondary
               transition-[color,transform] duration-150 ease-out
               peer-focus:[transform:translateY(-0.625rem)_scale(0.75)]
               peer-not-placeholder-shown:[transform:translateY(-0.625rem)_scale(0.75)]"
  >
    {label}
  </label>
</div>
```

## 5. Components

- **Primary button:** solid `primary`, `primary-contrast` text, `rounded-control`. A subtle top-to-bottom gradient is allowed on primary buttons only.
- **Secondary button:** the `secondary-solid` / `secondary-solid-contrast` pair, which is `neutral-strong` in the light theme and `raised` in the dark theme, with no `dark:` variant.
- **Tertiary button:** text only. **Icon button:** square, rounded, tone-filled, no border.
- **Status chips:** pale tinted background with saturated text of the same hue (see tokens). Status MUST NOT rely on colour alone; include text or an icon.
- **Stat cards:** large number (28-32px/600) with a small coloured delta indicator.
- **Charts:** `primary` is the dominant series, a light `primary-tint` (optionally diagonal-hatched) for overlay series, `accent-navy` for contrast. No boxed gridlines; faint horizontal guides only.
- **Selected column/row/day:** `selected` tint, not an outline.
- Touch targets are at least 40x40px.
