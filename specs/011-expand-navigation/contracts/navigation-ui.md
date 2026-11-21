# UI Contract: Expandable Left Navigation

## Visibility and destinations

- During an authenticated session, a left-hand primary navigation landmark is present on every signed-in screen. It is absent from sign-in, initial session loading, and expired-session screens.
- Accounts and Categories are named buttons in the pane, not in the header. Each opens the same destination and applies the same state changes as its previous header button.
- Accounts is current for its overview, detail, and import screens; Categories is current on its screen; neither is current on administrator settings. Expose the active destination with `aria-current="page"`.
- Theme selection, administrator import limits, sign-out, session errors, and page-specific actions retain their current locations, permissions, and behavior.

## Expansion and presentation

- At 768 CSS pixels and wider, hovering with a mouse expands the pane; it collapses when the pointer leaves unless pinned. Below 768px hover does not expand it, because the expanded pane covers page content there and content that appears on hover must be dismissible (WCAG 2.2 SC 1.4.13). A hamburger button (`aria-label="Toggle navigation"`, `aria-expanded`) at the top of the pane pins it open at any width until activated again, by mouse or keyboard. Keyboard focus on a destination does not expand the pane. (Amended 2026-11-22; see spec Amendment.)
- There is no Escape dismissal: below 768px only the hamburger opens the pane over the page, and activating it again closes it, so nothing opens on hover or focus that cannot be closed.
- Compact state shows the destination icons but no visible destination text; expanded state shows the same icons with their labels. Buttons retain their accessible names in both states; icons are decorative.
- The pane begins compact, or pinned when the user's saved 018 preference is pinned, and expands while hovered or pinned (amended 2026-11-22). Touch users tap the compact destination icons directly. See [data-model.md](../data-model.md).
- Expanded navigation overlays page content only where they share space, including at a 320 CSS pixel viewport, without resizing or moving it. Do not force overlap by repositioning content or widening the pane. Both destinations and page content remain reachable and usable.
- Keyboard-focused page controls remain visible above the overlay, including when a pointer keeps the pane expanded.

## Interaction and quality

- All pane buttons have a visible focus indicator, work by keyboard, and show a pointer cursor on hover. The pane supports WCAG 2.2 AA.
- Light, Dark, and System modes remain legible; theme defaults, persistence, and OS-following behavior remain unchanged.
- Hover expansion and navigation provide visible feedback within 500 ms; slower actions show a busy state and measurable progress when available.
- Existing error and loading feedback, including session refresh and sign-out errors, is preserved.
