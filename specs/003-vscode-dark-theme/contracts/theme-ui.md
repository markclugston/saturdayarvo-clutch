# UI Contract: Dark Theme

## Scope

This is a user-visible browser UI contract for the existing `clutch-web` application. It introduces no API, route, theme selector, or persistence mechanism.

## Theme Selection

- The existing system `prefers-color-scheme` preference determines whether the root element has the `.dark` class.
- A system preference change updates the active theme without changing the current application flow.
- No in-app theme selector or stored preference is added.

## Appearance

When `.dark` is active:

- Main backgrounds, supporting panels, navigation, text, and accents use the coordinated VS Code-inspired semantic palette described in `spec.md`.
- Adjacent sections remain distinguishable through coordinated surface contrast, meaningful separators, and spacing.
- Text, controls, meaningful boundaries, and focus indicators meet applicable WCAG 2.2 AA contrast requirements.
- Hover, focus, selected, disabled, status, and error states remain perceivable; status and error meaning is not conveyed by color alone.
- Layout remains usable at narrow viewports and by keyboard.

When `.dark` is inactive:

- Existing light-theme rendering and behavior remain unchanged.

## Observable Validation

1. With the browser/system dark preference enabled, representative existing screens render in the dark palette and show discernible sections and control states.
2. With the browser/system light preference enabled, the application retains its existing light appearance.
3. Changing the system preference updates the root theme class without a new setting or persisted value.
4. Keyboard focus remains visible and the layout remains navigable at narrow viewport widths.
