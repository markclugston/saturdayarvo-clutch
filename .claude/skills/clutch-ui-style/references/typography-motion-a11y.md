# Typography, motion and accessibility (style guide §7–9)

## 7. Typography

- Inter, with a `system-ui` fallback. One family for the whole product.
- Page title 24-28px/600. Section or card title 16-18px/600. Body 14px/400. Meta 12-13px/400-500. Micro labels 11px/500.
- Title Case for all visible labels, headings and button text (field labels, page, section and card titles, nav items, tab names, column headers, button and link-button text). Capitalise every word except articles (a, an, the), coordinating conjunctions (and, but, or, nor, for, so, yet) and prepositions of three letters or fewer (as, at, by, in, of, on, to, up, via), which stay lower case unless first or last. Examples: "Add Category", "Save and Close", "Monthly Repayment", "Sign In".
- Helper, error, empty-state, toast and body text stay in sentence case; they are sentences, not labels.
- Acronyms keep their own casing (API, ID, URL). Proper nouns and user-entered data are shown as written.
- Write the source string in Title Case. Small nav section headings may be rendered all caps with the `uppercase` class; the underlying string is still Title Case.

## 8. Motion

- 150-250ms, ease-out or ease-in-out. Animate colour, opacity, transform and width only. The one exception is the app shell's `grid-template-columns` (`transition-[grid-template-columns]`), which keeps the navigation column and the content in step when the navigation expands at 768px and above.
- Respect `prefers-reduced-motion`: disable, or shorten to under 50ms (`motion-reduce:transition-none` or a global media query).

## 9. Accessibility

- All text/background pairs meet WCAG 2.2 AA in **both** themes: 4.5:1 for body text, 3:1 for large text and UI components.
- Every interactive element has a visible focus ring: 2px `primary`, 2px offset, via the shared `focus-ring` utility in `index.css` (`outline: 2px solid rgb(var(--primary)); outline-offset: 2px`, applied with `focus-visible:`). It is an outline rather than a box-shadow ring because the browser tests assert the focused control's outline, and an outline offset is transparent on every surface.
- Status is never conveyed by colour alone.
