# Implementation: React + Tailwind (style guide §10)

## 10.1 Tokens and Tailwind v4 configuration

Define CSS custom properties and their Tailwind mappings in `src/clutch-web/src/index.css`. The
project uses Tailwind v4 through `@tailwindcss/vite`; it does not use a `tailwind.config` file.
The theme's design tokens replace the shadcn/ui default variables (they are retired, not kept alongside).

```css
/* src/clutch-web/src/index.css */
@import "tailwindcss";

/* ThemeProvider toggles the `dark` class on <html>. Use `dark:` for non-colour needs only. */
@custom-variant dark (&:is(.dark *));

@theme inline {
  /* Tailwind v4 applies opacity modifiers (bg-primary/10) through color-mix, so no <alpha-value>. */
  --color-canvas: rgb(var(--surface-canvas));
  --color-content: rgb(var(--surface-content));
  --color-card: rgb(var(--surface-card));
  --color-raised: rgb(var(--surface-raised));
  --color-hover: rgb(var(--surface-hover));
  --color-selected: rgb(var(--surface-selected));
  --color-fg: rgb(var(--fg));
  --color-fg-secondary: rgb(var(--fg-secondary));
  --color-fg-muted: rgb(var(--fg-muted));
  --color-primary: rgb(var(--primary));
  --color-primary-contrast: rgb(var(--primary-contrast));
  --color-primary-tint: rgb(var(--primary-tint));
  /* ...status (--color-danger, --color-danger-bg, ...), neutral-strong, accent-navy, scrim, solid pairs */

  --radius-chip: 6px;
  --radius-control: 10px;
  --radius-card: 16px;
  --radius-panel: 22px;

  --shadow-float: var(--float-shadow); /* differs by theme */
  --font-sans: "Inter Variable", sans-serif;
}
```

## 10.2 Theme values

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
  --fg-secondary: 95 102 115;
  --fg-muted: 156 163 175;
  --primary: 26 95 230;
  --primary-contrast: 255 255 255;
  --primary-tint: 232 238 252;
  /* ...status, neutral-strong, accent-navy */
}
.dark {
  --surface-canvas: 30 30 30;
  --surface-content: 37 37 38;
  --surface-card: 45 45 48;
  --surface-raised: 54 54 58;
  --surface-hover: 60 60 65;
  --surface-selected: 38 53 77;
  --fg: 212 212 212;
  --fg-secondary: 171 171 177;
  --fg-muted: 117 117 123;
  --primary: 126 174 255;
  --primary-contrast: 11 18 32;
  --primary-tint: 38 53 77;
}
```

Add these values to `src/clutch-web/src/index.css` rather than creating a separate tokens file or
Tailwind configuration file. The CSS custom properties hold runtime theme values; the `@theme
inline` block exposes them as Tailwind utilities without copying their values.

## 10.3 Rules for components

- Use `rounded-panel`, `rounded-card`, `rounded-control`, `rounded-chip`. Do not use `rounded-lg`, `rounded-xl` and similar.
- Components MUST NOT use `dark:` variants for colour; tokens swap the values. `dark:` is allowed only for non-colour needs, with justification.
- Forbidden in components: raw hex or arbitrary colour values (`bg-[#fff]`), default palette classes (`bg-white`, `bg-black`, `text-gray-500`), `border`/`border-*`/`divide-*` on layout containers, `ring-*` other than the focus ring, and `shadow-*` other than `shadow-float`. Enforced by the local ESLint rule `clutch/style-tokens` (`eslint-rules/clutch-style.js`) in `npm run lint`. Allowed exceptions are named utilities in `index.css`: `focus-ring`, `hairline-t`, `hairline-b` and `shadow-float`. Transitions are limited to colour, opacity, transform and width (plus the app shell grid columns), 150-250ms, ease-out or ease-in-out.
- Build features from primitives in `src/components/ui/`: `AppShell`, `SideNav`, `ContentPanel`, `Card`, `FloatingField`, `CardTitle`, `FloatingField`, `ErrorMessage`, `Chip`, `StatusChip`, `Button`, `Tooltip`. `HatchedRegion` is added with the first timeline or calendar. Do not restyle primitives with ad-hoc colour or border classes. Use `class-variance-authority` for variants and the shared `cn` helper in `src/lib/utils.ts` for class merging (it knows the token radii).
- If using shadcn/ui or Headless UI, remap their theme tokens to those above and remove default borders.

## 10.4 Theme runtime

- `ThemeProvider` toggles the `dark` class on `<html>`. The mode (Light, Dark or System) comes from the server-side theme preference after sign-in; Light is the default before that. There is no pre-paint script and no `data-theme` attribute.
