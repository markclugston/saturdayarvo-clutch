# Layout and navigation (style guide §2–3)

## 2. Layout model

Three nested layers:

| Layer | Token | Treatment |
|---|---|---|
| Shell / canvas | `canvas` | App background. The side navigation sits directly on it, so it reads as part of the background. |
| Content panel | `content` | Inset rounded panel (`rounded-panel`, 22px) with a visible gutter of canvas around it and 16-24px padding. |
| Cards / sections | `card` | Rounded (`rounded-card`, 16px), one tone step from the content panel, 12-20px padding, 12-16px gaps. |

- Nested controls (inputs, buttons, chips) use `rounded-control` (10px). Small tags and status chips use `rounded-chip` (6px). Avatars are circular.
- Layout containers (nav, panels, cards, table regions) MUST NOT have borders or divider lines.
- **Permitted exceptions:** (a) a 1px hairline at 6-8% text-colour opacity inside a card to separate a footer or metadata row; (b) focus rings.
- Shadows are for floating elements only (popovers, dragged items, modals): `shadow-float`. Static panels MUST NOT have shadows.
- Non-working or disabled regions (e.g. weekends in a timeline or calendar) use a subtle diagonal hatch in `raised`.

```
AppShell (bg-canvas)
├── header             (bg-canvas, full width, sticky, no border; first in the DOM)
├── SideNav            (bg-canvas, no border)
└── ContentPanel       (bg-content rounded-panel, inset with gutter)
    └── Card           (bg-card rounded-card)
        └── controls   (bg-raised rounded-control)
```

## 3. Navigation

**Existing expand/collapse behaviour MUST be preserved** (triggers, persisted state, breakpoints) unless an approved spec amends it (015: the content resizes at 768px and above). Otherwise only styling changes.

- Surface is `canvas`. No border or divider against the content panel; the transition is the tone change alone.
- Collapsed: icon-only rail, 64px (`w-16`). Expanded: 160px (`w-40`). The wider 240px of the original guide is not used: the navigation overlays the content below 768px and shrinks the content at 768px and above (015), and the width must be the same at every viewport.
- Width animates 200ms ease-in-out (`transition-[width] duration-200 ease-in-out`); at 768px and above the shell's grid columns animate in step (`transition-[grid-template-columns]`). Labels fade with `transition-opacity` rather than popping.
- Active item: `rounded-control` fill using `primary` with `primary-contrast` text and heavier text (the `selected` tint is under 3:1 against `canvas`, so it cannot be the only indicator). Hover: a subtler fill (`hover`).
- Icons 18-20px, consistent outline style, stroke about 1.5px.
- Collapsed items show tooltips on hover or keyboard focus, including after Escape dismisses the expanded rail while an item is still focused or hovered.
- Group headings (e.g. "Division") are small, muted, uppercase labels. No divider lines.
