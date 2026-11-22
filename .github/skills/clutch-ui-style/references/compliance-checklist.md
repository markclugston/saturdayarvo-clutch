# UI compliance checklist (style guide §11)

Copy into the plan's Constitution Check and the task-completion gate for any UI work. The
*Check* column says what validates each item: **Lint** (`npm run lint`), **Browser**
(`e2e/style-guide.spec.ts` and affected journey specs), **Component** (component tests) or
**Review** (no tool enforces it; record the evidence).

| Item | Check |
|---|---|
| [ ] Only tokens used: no raw colours, default palette, non-token radius, extra ring or shadow, or `dark:` colour | Lint |
| [ ] No borders or divider lines on layout containers (hairline utilities only) | Lint, Review |
| [ ] Transitions, durations and easing within the allowed set; `prefers-reduced-motion` respected | Lint, Browser |
| [ ] Surface hierarchy follows canvas, content, card, raised | Browser, Review |
| [ ] Built from existing primitives and variants; none restyled ad hoc | Review |
| [ ] Form fields use floating labels | Review |
| [ ] Labels, headings and button text use Title Case; helper, error and body text use sentence case | Review |
| [ ] % and $ fields use the shared formatted field (invalid characters never displayed, formatted on blur) | Component |
| [ ] Numbers and currency amounts, and their column headers, are right aligned (`text-right`, `tabular-nums`) | Lint, Component, Review |
| [ ] Navigation expand/collapse behaviour unchanged unless an approved spec amends it | Browser |
| [ ] Dark theme has no pure black surface or pure white text | Browser |
| [ ] Both themes verified (screenshots) | Browser |
| [ ] WCAG 2.2 AA (axe) and contrast pass in both themes | Browser |
| [ ] Visible focus ring on every interactive element | Browser |
| [ ] Status not conveyed by colour alone | Review |

Any deviation requires an explicit justification in the plan and is rejected at review otherwise.
