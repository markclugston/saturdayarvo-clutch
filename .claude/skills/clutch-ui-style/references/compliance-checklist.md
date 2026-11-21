# UI compliance checklist (style guide §11)

Copy into the plan's Constitution Check and the task-completion gate for any UI work.

- [ ] No borders or divider lines on layout containers (documented hairline exception only)
- [ ] Surface hierarchy follows canvas, content, card, raised
- [ ] Only tokens used: no raw hex, no default palette, no non-token radius
- [ ] Form fields use floating labels
- [ ] Labels, headings and button text use Title Case; helper, error and body text use sentence case
- [ ] Percentage and currency fields reject invalid characters at entry (never displayed) and reformat on blur
- [ ] Navigation expand/collapse behaviour unchanged; only restyled, unless an approved spec amends it (015: content resizes at 768px and above)
- [ ] Dark theme has no pure black surface or pure white text
- [ ] Both themes visually verified
- [ ] WCAG 2.2 AA contrast checked in both themes
- [ ] Visible focus ring on every interactive element
- [ ] Status not conveyed by colour alone
- [ ] `prefers-reduced-motion` respected

Any deviation requires an explicit justification in the plan and is rejected at review otherwise.
