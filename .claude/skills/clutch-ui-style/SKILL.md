---
name: "clutch-ui-style"
description: "Clutch UI style guide and compliance checklist (WEB-001): layout, forms, tokens, themes, accessibility. Use for any UI planning, implementation or review."
metadata:
  author: "saturdayarvo-clutch"
  governs: "WEB-001"
---

# Clutch UI Style

Binding design system for all UI work (React + Tailwind, themes **Light** and **Soft Dark**).
MUST / MUST NOT / SHOULD are used in the RFC 2119 sense.

> **Source of truth for values:** `src/clutch-web/src/index.css` (CSS custom properties and
> Tailwind v4 `@theme` mappings; there is no Tailwind config file). Hex values in the references are a
> snapshot. If they disagree with `index.css`, that file wins and the reference must be updated.

## Principles

1. **Tone and radius, not lines.** Structure comes from background changes and rounded corners.
2. **Layered surfaces.** Canvas, then content panel, then cards, then raised controls. Each step is a slightly different tone.
3. **Tokens only.** Components reference semantic tokens. Never raw hex, never the default Tailwind palette.
4. **Calm.** Low contrast between surfaces, minimal shadow, short animations.
5. **Accessible without borders.** Because there are no borders, focus rings and contrast carry the load.

## Load only the sections you need

| Reference | Style guide § | Load when |
|---|---|---|
| [references/layout-navigation.md](references/layout-navigation.md) | 2, 3 | Page shells, panels, cards, side navigation |
| [references/forms-components.md](references/forms-components.md) | 4, 5 | Inputs, selects, buttons, chips, stat cards, charts |
| [references/tokens.md](references/tokens.md) | 6 | Choosing colours, status chips, dark theme surfaces |
| [references/typography-motion-a11y.md](references/typography-motion-a11y.md) | 7, 8, 9 | Text styles, transitions, contrast, focus rings |
| [references/implementation.md](references/implementation.md) | 10 | Editing `index.css`, primitives, theme runtime, lint rules |
| [references/compliance-checklist.md](references/compliance-checklist.md) | 11 | Every plan and completion review for UI work |

## Use by phase

- **Plan:** list the applicable sections (by §) in the plan and copy the compliance checklist into the Constitution Check.
- **Implement:** load the references for the parts being built. Build from the shared UI primitives (location in `docs/code-map.md`).
- **Review / completion:** validate every compliance checklist item. A deviation without explicit justification in the plan is rejected.

## Review failures (reject on sight)

- Raw colours: hex, arbitrary values like `bg-[#fff]`, default palette classes like `bg-white` or `text-gray-500`.
- Non-token radii, such as `rounded-lg` or `rounded-xl`.
- Pure black (`#000`) dark surfaces, or pure white (`#FFF`) dark-theme text.
- Borders or dividers on layout containers (`border*`, `divide-*`), except the documented hairline.
- `ring-*` other than the focus ring, and `shadow-*` other than `shadow-float`.
- `dark:` variants used for colour.
- External field labels without documented justification.
- Labels, headings or button text not in Title Case (for example "Add category" instead of "Add Category").

## Changing the style guide

Style-guide rule changes require synchronized updates: `src/clutch-web/src/index.css`, the affected
reference file here, the compliance checklist if a rule is added or removed, and the section
table above.
