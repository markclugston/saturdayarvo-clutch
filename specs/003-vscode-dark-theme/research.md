# Research: VS Code-Inspired Dark Theme

## Repository Findings

- `src/clutch-web/src/index.css` defines light tokens under `:root`, dark tokens under `.dark`, and maps semantic variables through Tailwind CSS 4 `@theme inline`. Existing values use OKLCH.
- The global base layer uses semantic background, foreground, border, and ring utilities. The feature can preserve component behavior by updating dark token values first and adjusting only confirmed token bypasses.
- `src/clutch-web/src/components/theme/ThemeProvider.tsx` follows the operating-system `prefers-color-scheme` media query and toggles the root `.dark` class when the setting changes. No explicit theme selector or browser-storage persistence was found; do not add one.
- Playwright and `@axe-core/playwright` are already used by the frontend e2e suite. Vitest and Testing Library are also configured. No new test dependency is needed.
- The screenshot itself is not present in the repository. Palette targets are taken from the spec's approximations.

## Decisions

### Keep the existing semantic token layer

**Decision**: Update the existing dark-mode semantic token values in OKLCH and retain the current `:root` light-theme values. Use existing token roles for backgrounds, text, cards/popovers, navigation/sidebar, borders, inputs, focus rings, and accents. Do not introduce a parallel `vscode-*` token namespace or a new theme selector.

**Rationale**: The app's components already use semantic Tailwind utilities backed by these variables, so reusing them applies a coherent palette without changing component APIs or theme selection behavior. Tailwind's theme variables are designed to connect semantic design tokens to utility classes.

**Alternatives considered**:
- Add a separate VS Code palette and selector: rejected because the spec requests adapting the existing dark theme, not a third theme.
- Put raw color values in individual components: rejected because it duplicates palette logic and risks inconsistent surfaces and light-mode regressions.

### Treat reference colors as targets, not contrast guarantees

**Decision**: Use the specified charcoal, gray, and blue colors as visual references, map them to semantic roles, and adjust as necessary to meet contrast requirements. Preserve OKLCH as the token representation. Check each rendered foreground/background pair, including muted text and accent treatments, and check meaningful non-text boundaries against their adjacent surfaces.

**Rationale**: WCAG 2.2 SC 1.4.3 requires 4.5:1 for normal text and 3:1 for large text. SC 1.4.11 requires 3:1 for visual information that identifies relevant controls, states, or graphics. Semi-transparent border or ring colors must be evaluated after compositing over their actual surface. Accessibility takes precedence over exact screenshot matching, as the spec states.

**Alternatives considered**:
- Copy all reference hex values verbatim: rejected as the only criterion because some pairings may not pass contrast requirements.
- Use APCA/WCAG 3 as the compliance measure: rejected because the spec requires WCAG 2.2 AA.

### Verify visual separation, contrast, and states with complementary checks

**Decision**: Use axe-core's WCAG color-contrast checks on representative dark-mode screens, supplement them with token-pair calculations and a review checklist for meaningful boundaries, and verify focus, hover, selected, disabled, and status/error treatments in the browser. Confirm the same representative screens in light mode.

**Rationale**: Automated browser checks provide repeatable coverage for rendered text; token calculations make alpha-blended/non-text pairings explicit; and a focused visual checklist verifies hierarchy and spacing that an automated contrast rule cannot establish. Existing Playwright/axe-core tooling supports this without adding dependencies.

**Alternatives considered**:
- Rely only on screenshot review: rejected because it is not repeatable or sufficient to establish contrast ratios.
- Rely only on axe-core: rejected because automated checks do not replace review of section hierarchy and every meaningful non-text boundary.

## References

- W3C, WCAG 2.2 Understanding Success Criterion 1.4.3 Contrast (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- W3C, WCAG 2.2 Understanding Success Criterion 1.4.11 Non-text Contrast: https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- Tailwind CSS, Theme variables: https://tailwindcss.com/docs/theme
- Existing implementation: `src/clutch-web/src/index.css`, `src/clutch-web/src/components/theme/ThemeProvider.tsx`, `src/clutch-web/e2e/`
