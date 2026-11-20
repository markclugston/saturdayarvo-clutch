# Typography, motion and accessibility (style guide §7–9)

## 7. Typography

- Inter, with a `system-ui` fallback. One family for the whole product.
- Page title 24-28px/600. Section or card title 16-18px/600. Body 14px/400. Meta 12-13px/400-500. Micro labels 11px/500.
- Sentence case for labels and buttons. All-caps only for small nav section headings.

## 8. Motion

- 150-250ms, ease-out or ease-in-out. Animate colour, opacity, transform and width only.
- Respect `prefers-reduced-motion`: disable, or shorten to under 50ms (`motion-reduce:transition-none` or a global media query).

## 9. Accessibility

- All text/background pairs meet WCAG 2.2 AA in **both** themes: 4.5:1 for body text, 3:1 for large text and UI components.
- Every interactive element has a visible focus ring: 2px `primary`, 2px offset, via the shared `focus-ring` utility in `index.css` (`outline: 2px solid rgb(var(--primary)); outline-offset: 2px`, applied with `focus-visible:`). It is an outline rather than a box-shadow ring because the browser tests assert the focused control's outline, and an outline offset is transparent on every surface.
- Status is never conveyed by colour alone.
