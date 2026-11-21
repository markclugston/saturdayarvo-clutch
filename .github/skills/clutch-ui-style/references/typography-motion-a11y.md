# Typography, motion and accessibility (style guide §7–9)

Implementation: font, focus ring and reduced-motion handling in `src/clutch-web/src/index.css`.
The `clutch/style-tokens` lint rule limits transitions, durations and easing. The style-guide
browser tests check contrast, focus outlines and timings.

## 7. Typography

- One family for the whole product (`--font-sans` in `index.css`). Use the text sizes and weights already used by the primitives and `page-heading.tsx`; do not introduce new ones without justification.
- **Title Case (not tool-enforced; review):** all visible labels, headings and button text: field labels, page, section and card titles, nav items, tab names, column headers, button and link-button text. Capitalise every word except articles (a, an, the), coordinating conjunctions (and, but, or, nor, for, so, yet) and prepositions of three letters or fewer (as, at, by, in, of, on, to, up, via), which stay lower case unless first or last. Examples: "Add Category", "Save and Close", "Sign In".
- Helper, error, empty-state, toast and body text stay in sentence case.
- Acronyms keep their own casing (API, ID, URL). Proper nouns and user-entered data are shown as written.
- Write the source string in Title Case, even when it is rendered with the `uppercase` class.

## 8. Motion

- Use only the transitions the lint rule allows. `prefers-reduced-motion` MUST be respected: the global rule in `index.css` handles CSS transitions. Add `motion-reduce:` handling for anything it does not cover.

## 9. Accessibility (WCAG 2.2 AA, both themes)

- All text/background pairs meet AA in both themes: 4.5:1 for body text, 3:1 for large text and UI components. `fg-muted` is for disabled text and decorative icons only.
- Every interactive element shows the `focus-ring` utility on `focus-visible`.
- Status is never conveyed by colour alone.
- Any accessibility need not covered by an automated check must be stated in the plan and validated by an added automated test where possible.
