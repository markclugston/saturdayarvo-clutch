# UI Style Guide

Binding design system for all UI work. Referenced from the project constitution.
Stack: React + Tailwind. Two themes: **Light** and **Soft Dark**.

> **Source of truth for values:** `src/clutch-web/src/index.css`.
> This file defines the CSS custom properties and Tailwind v4 `@theme` mappings; there is no
> separate Tailwind configuration file. Hex values in this document are a snapshot for readability.
> If they disagree with `src/clutch-web/src/index.css`, that file wins and this document must be
> updated.

Keywords MUST / MUST NOT / SHOULD are used in the RFC 2119 sense.

---

## 1. Principles

1. **Tone and radius, not lines.** Structure comes from background changes and rounded corners.
2. **Layered surfaces.** Canvas, then content panel, then cards, then raised controls. Each step is a slightly different tone.
3. **Tokens only.** Components reference semantic tokens. Never raw hex, never the default Tailwind palette.
4. **Calm.** Low contrast between surfaces, minimal shadow, short animations.
5. **Accessible without borders.** Because there are no borders, focus rings and contrast carry the load.

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

## 6. Colour tokens

Define as CSS custom properties holding **space-separated RGB channels** so Tailwind opacity modifiers work (e.g. `--surface-card: 255 255 255;`). Hex below is for reference.

### 6.1 Light theme

| Token | Hex | Use |
|---|---|---|
| `canvas` | `#FFFFFF` | Shell and navigation |
| `content` | `#F5F5F7` | Inset content panel |
| `card` | `#FFFFFF` | Cards and sections |
| `raised` | `#F0F1F3` | Inputs, chips, icon buttons, hatch |
| `hover` | `#EBECEF` | Hover fill |
| `selected` | `#E8EEFC` | Selected item tint |
| `fg` | `#111318` | Primary text |
| `fg-secondary` | `#6B7280` | Secondary text |
| `fg-muted` | `#9CA3AF` | Muted text, resting labels |
| `primary` | `#1F6BFF` | Brand and primary actions |
| `primary-contrast` | `#FFFFFF` | Text on primary |
| `primary-tint` | `#E8EEFC` | Light primary background |
| `neutral-strong` | `#14161B` | Secondary buttons, dark chart series |
| `accent-navy` | `#1B2433` | Chart contrast series |

Status chips (background / text):

| Status | Background | Text |
|---|---|---|
| Danger / Urgent | `#FDECEC` | `#D93025` |
| Warning / Medium / On Review | `#FFF1E0` | `#D97706` |
| Success / Complete | `#E6F6EC` | `#1E9E5A` |
| Info / Low | `#E6F0FF` | `#2563EB` |
| Neutral / Tag | `#EDEEF1` | `#4B5563` |

### 6.2 Soft Dark theme

Dark but not black. Aim for VS Code Dark / Claude Desktop: charcoal, low glare, layering by lightening.

- MUST NOT use `#000` for any surface or `#FFF` for text.
- The darkest surface is `#1E1E1E` or lighter. Maximum text brightness is `#ECECEC`.
- Elevation is expressed by a lighter surface, not by shadow.

| Token | Hex | Use |
|---|---|---|
| `canvas` | `#1E1E1E` | Shell and navigation |
| `content` | `#252526` | Content panel |
| `card` | `#2D2D30` | Cards |
| `raised` | `#36363A` | Inputs, chips |
| `hover` | `#3C3C41` | Hover fill |
| `selected` | `#26354D` | Selected tint (primary-tinted) |
| `fg` | `#D4D4D4` | Primary text |
| `fg-secondary` | `#A0A0A6` | Secondary text |
| `fg-muted` | `#75757B` | Muted text |
| `primary` | `#4C8DFF` | Lifted for contrast |
| `primary-contrast` | `#0B1220` or `#FFFFFF` | Whichever passes AA |

Status chips: translucent background (12-16% alpha of the status colour) with a lightened text variant of the same hue.

A slight warm tint (Claude Desktop style) is an acceptable variation only if applied consistently to every neutral token.

## 7. Typography

- Inter, with a `system-ui` fallback. One family for the whole product.
- Page title 24-28px/600. Section or card title 16-18px/600. Body 14px/400. Meta 12-13px/400-500. Micro labels 11px/500.
- Sentence case for labels and buttons. All-caps only for small nav section headings.

## 8. Motion

- 150-250ms, ease-out or ease-in-out. Animate colour, opacity, transform and width only.
- Respect `prefers-reduced-motion`: disable, or shorten to under 50ms (`motion-reduce:transition-none` or a global media query).

## 9. Accessibility

- All text/background pairs meet WCAG 2.2 AA in **both** themes: 4.5:1 for body text, 3:1 for large text and UI components.
- Every interactive element has a visible focus ring: 2px `primary`, 2px offset, via a shared `focus-ring` utility (`outline-none ring-2 ring-primary ring-offset-2 ring-offset-canvas`, applied with `focus-visible:`).
- Status is never conveyed by colour alone.

## 10. Implementation (React + Tailwind)

### 10.1 Tokens and Tailwind v4 configuration

Define CSS custom properties and their Tailwind mappings in `src/clutch-web/src/index.css`. The
project uses Tailwind v4 through `@tailwindcss/vite`; it does not use a `tailwind.config` file.
The theme's design tokens are defined alongside the existing shadcn/ui variables.

```css
/* src/clutch-web/src/index.css */
@import "tailwindcss";

/* Match the theme selector used by ThemeProvider. */
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));

@theme inline {
  --color-canvas: rgb(var(--surface-canvas) / <alpha-value>);
  --color-content: rgb(var(--surface-content) / <alpha-value>);
  --color-card: rgb(var(--surface-card) / <alpha-value>);
  --color-raised: rgb(var(--surface-raised) / <alpha-value>);
  --color-hover: rgb(var(--surface-hover) / <alpha-value>);
  --color-selected: rgb(var(--surface-selected) / <alpha-value>);
  --color-fg: rgb(var(--fg) / <alpha-value>);
  --color-fg-secondary: rgb(var(--fg-secondary) / <alpha-value>);
  --color-fg-muted: rgb(var(--fg-muted) / <alpha-value>);
  --color-primary: rgb(var(--primary) / <alpha-value>);
  --color-primary-contrast: rgb(var(--primary-contrast) / <alpha-value>);
  --color-primary-tint: rgb(var(--primary-tint) / <alpha-value>);
  /* ...status, neutral-strong, accent-navy */

  --radius-chip: 6px;
  --radius-control: 10px;
  --radius-card: 16px;
  --radius-panel: 22px;

  --shadow-float: 0 8px 30px rgb(0 0 0 / 0.12);
  --font-sans: "Inter", system-ui, sans-serif;
}
```

### 10.2 Theme values

Keep light and dark custom-property values in the same file. Preserve the space-separated RGB
channel format so Tailwind opacity modifiers continue to work.

```css
/* src/clutch-web/src/index.css */
:root {
  --surface-canvas: 255 255 255;
  --surface-content: 245 245 247;
  --surface-card: 255 255 255;
  --surface-raised: 240 241 243;
  --surface-hover: 235 236 239;
  --surface-selected: 232 238 252;
  --fg: 17 19 24;
  --fg-secondary: 107 114 128;
  --fg-muted: 156 163 175;
  --primary: 31 107 255;
  --primary-contrast: 255 255 255;
  --primary-tint: 232 238 252;
  /* ...status, neutral-strong, accent-navy */
}
:root[data-theme="dark"] {
  --surface-canvas: 30 30 30;
  --surface-content: 37 37 38;
  --surface-card: 45 45 48;
  --surface-raised: 54 54 58;
  --surface-hover: 60 60 65;
  --surface-selected: 38 53 77;
  --fg: 212 212 212;
  --fg-secondary: 160 160 166;
  --fg-muted: 117 117 123;
  --primary: 76 141 255;
  --primary-contrast: 255 255 255;
  --primary-tint: 38 53 77;
}
```

Add these values to `src/clutch-web/src/index.css` rather than creating a separate tokens file or
Tailwind configuration file. The CSS custom properties hold runtime theme values; the `@theme
inline` block exposes them as Tailwind utilities without copying their values.

### 10.3 Rules for components

- Use `rounded-panel`, `rounded-card`, `rounded-control`, `rounded-chip`. Do not use `rounded-lg`, `rounded-xl` and similar.
- Components MUST NOT use `dark:` variants for colour; tokens swap the values. `dark:` is allowed only for non-colour needs, with justification.
- Forbidden in components: raw hex or arbitrary colour values (`bg-[#fff]`), default palette classes (`bg-white`, `bg-black`, `text-gray-500`), `border`/`border-*`/`divide-*` on layout containers, `ring-*` other than the focus ring, and `shadow-*` other than `shadow-float`. Enforce with lint (eslint-plugin-tailwindcss or a custom rule) in CI.
- Build features from primitives in `src/components/ui/`: `AppShell`, `SideNav`, `ContentPanel`, `Card`, `FloatingField`, `Chip`, `StatusChip`, `Button`, `Tooltip`, `HatchedRegion`. Do not restyle primitives with ad-hoc colour or border classes. Use `class-variance-authority` for variants and `tailwind-merge` for class merging.
- If using shadcn/ui or Headless UI, remap their theme tokens to those above and remove default borders.

### 10.4 Theme runtime

- A `ThemeProvider` sets `data-theme` on `<html>`. Resolution order: stored user choice, then `prefers-color-scheme`, then light. Persist the choice.
- Inline a small script in `index.html` that sets the attribute before first paint to avoid a theme flash.

## 11. Compliance checklist

Copy into the plan and the task-completion gate for any UI work.

- [ ] No borders or divider lines on layout containers (documented hairline exception only)
- [ ] Surface hierarchy follows canvas, content, card, raised
- [ ] Only tokens used: no raw hex, no default palette, no non-token radius
- [ ] Form fields use floating labels
- [ ] Navigation expand/collapse behaviour unchanged; only restyled
- [ ] Dark theme has no pure black surface or pure white text
- [ ] Both themes visually verified
- [ ] WCAG 2.2 AA contrast checked in both themes
- [ ] Visible focus ring on every interactive element
- [ ] Status not conveyed by colour alone
- [ ] `prefers-reduced-motion` respected

Any deviation requires an explicit justification in the plan and is rejected at review otherwise.
