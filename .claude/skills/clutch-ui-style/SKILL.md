---
name: "clutch-ui-style"
description: "Clutch UI style guide and compliance checklist (WEB-001): layout, forms, lists and tables, tokens, themes, accessibility. Use for any UI planning, implementation or review."
metadata:
  author: "saturdayarvo-clutch"
  governs: "WEB-001"
---

# Clutch UI Style

The design system is implemented in code (themes **Light** and **Soft Dark**). This skill holds
the principles, the review process and the rules no tool enforces. It never restates values:
read them from the code. MUST / MUST NOT / SHOULD are used in the RFC 2119 sense.

## Source of truth

| Concern | Authoritative implementation | Enforced by |
|---|---|---|
| Colour, radius and shadow tokens, both themes; focus ring, hairlines, reduced motion | `src/clutch-web/src/index.css` | `clutch/style-tokens` lint rule; style-guide browser tests |
| Forbidden classes (raw colours, palette classes, non-token radii, borders, rings, shadows, `dark:` colour, transitions, durations, easing) and allowed exceptions | `src/clutch-web/eslint-rules/clutch-style.js` | `npm run lint` (`clutch-style.test.js` tests the rule) |
| Primitives and their variants (shell, navigation, panels, cards, fields, buttons, chips, dialog, toast, tooltip) | `src/clutch-web/src/components/ui/` (`class-variance-authority`, `cn` in `src/lib/utils.ts`); tooltip in `components/ui/tooltip.tsx` | Component tests beside each primitive (`tooltip.test.tsx`); tooltip hover, Escape and reduced motion in `e2e/style-guide.spec.ts` |
| Theme runtime | `src/clutch-web/src/components/theme/` | Theme component and browser tests |
| Contrast, focus outline, surface lightness, no pure-white text, transition timing, toast and tab-strip layout | — | `src/clutch-web/e2e/style-guide.spec.ts` (axe WCAG 2.2 AA tags, both themes) |
| Right alignment of numbers and currency (cells, headers, numeric inputs, displayed amounts) | `src/clutch-web/eslint-rules/clutch-numeric-align.js`; numeric inputs in `components/ui/floating-field.tsx` | `npm run lint` (`clutch-numeric-align.test.js`); `floating-field.test.tsx` |
| % and $ entry fields | `src/clutch-web/src/features/mortgages/FormattedNumberField.tsx` | Its component tests |
| Lists: header, row lines, scrolling, row actions, states (§12) | `src/clutch-web/src/components/ui/list.tsx`, `delete-dialog.tsx`; `src/lib/usePinnedList.ts`; reference list `features/assets/AssetsPage.tsx` | `list.test.tsx`, `delete-dialog.test.tsx`, `usePinnedList.test.ts`; pinned-list tests in `e2e/style-guide.spec.ts`; review |

If guidance here disagrees with the code, raise the conflict (constitution Governance). Do not
pick a side.

## Principles

1. **Tone and radius, not lines.** Structure comes from background changes and rounded corners.
2. **Layered surfaces.** Canvas, then content panel, then cards, then raised controls.
3. **Tokens only.** Components reference semantic tokens, never raw colours or the default palette.
4. **Calm.** Low contrast between surfaces, minimal shadow, short animations.
5. **Accessible without borders.** Focus rings and contrast carry the load.

## Load only the sections you need

| Style guide § | Read | Load when |
|---|---|---|
| 2, 3 | [references/layout-navigation.md](references/layout-navigation.md) | Page shells, panels, cards, side navigation |
| 4, 5 | [references/forms-components.md](references/forms-components.md) | Fields, buttons, chips, stat cards, charts |
| 6 | `index.css` (tokens) and the token-use rules in `forms-components.md` | Choosing colours or status styles |
| 7, 8, 9 | [references/typography-motion-a11y.md](references/typography-motion-a11y.md) | Text, casing, motion, contrast, focus |
| 10 | The Source of truth table above | Editing tokens, primitives, theme runtime or the lint rule |
| 11 | [references/compliance-checklist.md](references/compliance-checklist.md) | Every completion review for UI work |
| 12 | [references/lists.md](references/lists.md) | Any list or table: new or changed, including its actions and states |

## Use by phase

- **Plan:** list the applicable sections (by §) and name the compliance checklist as a Constitution Check gate; do not copy it.
- **Implement:** build from the primitives (`docs/code-map.md`); open the nearest sibling and follow its pattern (for a list, the reference in §12). Do not restyle primitives with ad-hoc classes.
- **Review / completion:** run lint and the style-guide browser tests, then review the checklist items marked *Review*. A deviation without explicit justification in the plan is rejected; a list deviation also needs the user's explicit approval (§12).

## Review failures (reject on sight)

- Any `clutch/style-tokens` lint error.
- A primitive re-implemented or restyled instead of reused or given a new variant.
- An external field label without documented justification.
- Labels, headings or button text not in Title Case.
- A % or $ field not built on the shared formatted field.
- A number, rate or currency amount that is not right aligned, including its column header. The lint rule catches formatter calls in `td`/`th` and raw numeric inputs; review the rest (div-based grids, standalone values, headers).
- A list that differs from §12 without the user's explicit approval recorded in the plan.

## Changing the style guide

Change the code first: tokens in `index.css`, the primitive, the lint rule and its tests, and the
browser tests. Update a reference here only when a rule that no tool enforces changes, and update
the compliance checklist when a rule is added or removed.
