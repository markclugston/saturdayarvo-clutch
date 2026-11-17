# Research: Expandable Left Navigation

## Signed-in shell and state lifetime

- **Decision**: Expand while the mouse hovers over the pane or keyboard focus is inside it; otherwise use the compact state. Touch users select icons directly.
- **Rationale**: This supports the requested hover interaction while keeping keyboard and touch navigation usable without an extra button.
- **Alternatives considered**: Persisted or click-toggled expansion does not match the requested interaction.

## Destination behavior

- **Decision**: Move the existing Accounts and Categories button behavior into the pane without changing the order or effects of their existing state updates. Derive the active destination from the existing categories and administrator flags.
- **Rationale**: Accounts clears the selected account and import state; Categories currently does not. Administrator settings suppress the current marker for both destinations. Preserving these details avoids unrelated changes to navigation and back behavior.
- **Alternatives considered**: Introducing a router or rewriting page state adds complexity and risks changing back-navigation behavior.

## Accessibility and icons

- **Decision**: Use existing Lucide icons as decorative visuals with named destination buttons, a primary navigation landmark and `aria-current="page"` for the active destination. Ensure focus visibility, keyboard activation, and hover pointer behavior.
- **Rationale**: The repository already uses Lucide and button-based navigation. Accessible names must remain available when visible labels are hidden; decorative icons must not duplicate names.
- **Alternatives considered**: Icon-only controls without accessible names are unusable to assistive technology. Links conflict with the constitution; a new icon or component dependency is unnecessary.

## Narrow screens and themes

- **Decision**: Reserve compact pane width and overlay page content only where it shares space with the expanded pane, using semantic theme tokens. Test both pane states at 320, 1280 and 1920 CSS pixels.
- **Rationale**: The user requested that expansion not resize content, not that overlap be forced on wider screens.
- **Alternatives considered**: Resizing page content on expansion contradicts the updated request.

## Validation strategy

- **Decision**: Extend existing component tests and add a focused Playwright journey using the repository's existing browser and axe tooling. A mock-backed browser journey can verify authenticated navigation without depending on external credentials; preserve live integration coverage where applicable.
- **Rationale**: Existing `App.test.tsx` already tests session and navigation behavior, while `e2e/startup.spec.ts` demonstrates browser route interception and `e2e/theme-selector.spec.ts` tests 320/1280 widths. Browser geometry and keyboard checks are needed because a DOM-only environment cannot validate layout.
- **Alternatives considered**: Component-only tests cannot prove overlay geometry. Requiring a human test or unconditionally relying on pre-existing credentials would make the feature gate less reproducible.
