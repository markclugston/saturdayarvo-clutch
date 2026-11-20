# Implementation: React + Tailwind (style guide §10)

## 10.1 Tokens and Tailwind v4 configuration

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

## 10.3 Rules for components

- Use `rounded-panel`, `rounded-card`, `rounded-control`, `rounded-chip`. Do not use `rounded-lg`, `rounded-xl` and similar.
- Components MUST NOT use `dark:` variants for colour; tokens swap the values. `dark:` is allowed only for non-colour needs, with justification.
- Forbidden in components: raw hex or arbitrary colour values (`bg-[#fff]`), default palette classes (`bg-white`, `bg-black`, `text-gray-500`), `border`/`border-*`/`divide-*` on layout containers, `ring-*` other than the focus ring, and `shadow-*` other than `shadow-float`. Enforce with lint (eslint-plugin-tailwindcss or a custom rule) in CI.
- Build features from primitives in `src/components/ui/`: `AppShell`, `SideNav`, `ContentPanel`, `Card`, `FloatingField`, `Chip`, `StatusChip`, `Button`, `Tooltip`, `HatchedRegion`. Do not restyle primitives with ad-hoc colour or border classes. Use `class-variance-authority` for variants and `tailwind-merge` for class merging.
- If using shadcn/ui or Headless UI, remap their theme tokens to those above and remove default borders.

## 10.4 Theme runtime

- A `ThemeProvider` sets `data-theme` on `<html>`. Resolution order: stored user choice, then `prefers-color-scheme`, then light. Persist the choice.
- Inline a small script in `index.html` that sets the attribute before first paint to avoid a theme flash.
