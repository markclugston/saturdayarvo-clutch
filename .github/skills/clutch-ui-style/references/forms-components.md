# Form controls and components (style guide §4–5)

## 4. Form controls (floating labels)

All text inputs, selects and textareas use an **in-field floating label**. External labels need documented justification.

- **Resting and empty:** the label sits inside the field at body size in `fg-muted`, vertically centred.
- **Focus or filled:** the label animates (150-200ms ease-out) to about 11-12px at the top of the field. The value sits in the lower portion. Field height is 52-56px.
- Field background is `raised`. No border at rest.
- **Focus:** 2px `primary` ring or a primary-tinted background. Never a heavy outline.
- **Error:** label and ring use `danger`, with helper text below. **Disabled:** reduced opacity, no pointer events.
- **Multi-select and tag fields:** selections render as removable chips (with an x) inside the field, plus a ghost "+ Add" chip.
- Every field MUST have `id`/`htmlFor`, and `aria-invalid` and `aria-describedby` when in error.

```tsx
// FloatingField (sketch)
<div className="relative rounded-control bg-raised">
  <input
    id={id}
    placeholder=" "
    className="peer h-14 w-full bg-transparent px-3 pt-5 pb-1.5 text-fg
               rounded-control focus-visible:outline-none
               focus-visible:ring-2 focus-visible:ring-primary"
  />
  <label
    htmlFor={id}
    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2
               text-sm text-fg-muted transition-all duration-150 ease-out
               peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-[11px]
               peer-[:not(:placeholder-shown)]:top-2
               peer-[:not(:placeholder-shown)]:translate-y-0
               peer-[:not(:placeholder-shown)]:text-[11px]"
  >
    {label}
  </label>
</div>
```

## 5. Components

- **Primary button:** solid `primary`, `primary-contrast` text, `rounded-control`. A subtle top-to-bottom gradient is allowed on primary buttons only.
- **Secondary button:** solid `neutral-strong` (light theme) or `raised` (dark theme).
- **Tertiary button:** text only. **Icon button:** square, rounded, tone-filled, no border.
- **Status chips:** pale tinted background with saturated text of the same hue (see tokens). Status MUST NOT rely on colour alone; include text or an icon.
- **Stat cards:** large number (28-32px/600) with a small coloured delta indicator.
- **Charts:** `primary` is the dominant series, a light `primary-tint` (optionally diagonal-hatched) for overlay series, `accent-navy` for contrast. No boxed gridlines; faint horizontal guides only.
- **Selected column/row/day:** `selected` tint, not an outline.
- Touch targets are at least 40x40px.
