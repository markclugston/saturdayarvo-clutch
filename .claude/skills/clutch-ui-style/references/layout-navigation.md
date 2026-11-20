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
├── SideNav            (bg-canvas, no border)
└── ContentPanel       (bg-content rounded-panel, inset with gutter)
    └── Card           (bg-card rounded-card)
        └── controls   (bg-raised rounded-control)
```

## 3. Navigation

**Existing expand/collapse behaviour MUST be preserved** (triggers, persisted state, breakpoints). Only styling changes.

- Surface is `canvas`. No border or divider against the content panel; the transition is the tone change alone.
- Collapsed: icon-only rail, about 64-72px. Expanded: about 240-260px.
- Width animates 200ms ease-in-out (`transition-[width] duration-200 ease-in-out`). Labels fade with `transition-opacity` rather than popping.
- Active item: `rounded-control` fill using `selected` tone, slightly heavier text. Hover: a subtler fill (`hover`).
- Icons 18-20px, consistent outline style, stroke about 1.5px.
- Collapsed items show tooltips.
- Group headings (e.g. "Division") are small, muted, uppercase labels. No divider lines.
