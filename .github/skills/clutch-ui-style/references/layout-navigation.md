# Layout and navigation (style guide §2–3)

Implementation: `app-shell.tsx`, `side-nav.tsx`, `content-panel.tsx`, `card.tsx` in
`src/clutch-web/src/components/ui/`. Read sizes, widths, padding and timings there.

## 2. Layout model

- Three nested surfaces: canvas (shell and navigation), content panel, cards; controls sit on `raised`. Each step is one tone change, applied by the primitives.
- Layout containers (navigation, panels, cards, table regions) MUST NOT have borders or divider lines. Exceptions are the `hairline-t` / `hairline-b` utilities inside a card, and focus rings.
- Shadows are for floating elements only (popovers, dragged items, dialogs, toasts) and use `shadow-float`. Static panels MUST NOT have shadows.

## 3. Navigation

- **Existing expand/collapse behaviour MUST be preserved** (triggers, persisted state, breakpoints, widths) unless an approved spec amends it. Specs 015 and 018 define the current behaviour; `side-nav.tsx` and `e2e/navigation.spec.ts` implement and test it.
- The navigation sits on `canvas`; its boundary with the content panel is the tone change alone.
- The active item uses the `selected` tint with `primary` text and heavier weight, never the solid `primary` fill reserved for primary buttons.
- Hover never expands the rail where it would cover content (WCAG 2.2 SC 1.4.13), and keyboard focus never expands it.
- Icons come from Lucide, in one consistent outline style.
- Group headings are written in Title Case; they may render all caps with the `uppercase` class.
