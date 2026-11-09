# Research: Button-Based Navigation and Actions

## Context

- `src/clutch-web/src/App.tsx` controls the Family, Accounts, Account Details, Import, and administrator views with React state and callback props.
- `src/clutch-web/package.json` has no router dependency. A source scan found no anchor or `href` controls, though some navigation buttons use underlined styling.
- `src/clutch-web/src/components/ui/button.tsx` wraps Base UI's native button primitive. Existing feature components also use native `<button>` elements directly.
- Theme preferences are loaded and saved through the existing preferences API; `ThemeProvider` applies Light/Dark/System behavior.

## Decisions

### Keep the current in-memory navigation model

**Decision:** Preserve local React view state and existing callbacks. Do not add a router, URL paths, browser-history integration, or route persistence.

**Rationale:** The current user journeys are conditional views within one SPA, not URL routes. The feature asks to preserve those journeys while standardizing navigation/action controls, not to change address-bar or browser Back/Forward behavior. A router or History API would add behavior and hosting requirements beyond the request.

**Alternatives considered:** React Router or TanStack Router; native History API with `pushState`/`popstate`; hash-based navigation. Each introduces route/history behavior that is not present today and is unnecessary for the current small state-driven view set.

### Use native buttons for navigation and actions, and preserve native form controls

**Decision:** Use actual `<button>` elements for navigation/action controls; do not use anchors with button roles or custom `div` controls. Preserve controls such as text inputs and the theme `<select>` as form controls. A view-changing button should leave keyboard users at a clear destination, with focus moved to the destination's primary heading; non-navigation actions retain normal button focus behavior.

**Rationale:** Native buttons provide keyboard activation (Enter and Space), focusability, and disabled semantics without recreating them. The destination-heading focus handles the context change when the initiating button is removed from the rendered view. The theme selector is a selection control, not a hyperlink or navigation control, and preserving it maintains the existing theme UX.

**Alternatives considered:** Styling an anchor as a button (prohibited); using `role="button"` on a generic element (unnecessary and requires custom keyboard behavior); converting all form controls to buttons (would change existing input behavior).

### Apply consistent button appearance and hover cursor

**Decision:** Keep the existing Base UI button primitive and Tailwind patterns, but ensure all relevant buttons—including directly declared buttons—have button presentation, visible focus, and the required hand pointer cursor on hover. Remove hyperlink-like underline presentation from navigation controls.

**Rationale:** The UI contract requires a button both semantically and visually. Central styling alone is insufficient if raw buttons bypass the shared primitive, so the inventory must include both shared and directly declared controls.

**Alternatives considered:** Add a competing component library or custom global CSS. Both are unnecessary; existing Base UI and Tailwind are the repository conventions.

### Verify user-observable behavior with automated checks

**Decision:** Use Testing Library role/name assertions and Playwright journeys, keyboard interaction, viewport/theme checks, and axe-core. Cover the 500 ms feedback threshold with elapsed-time assertions for immediate transitions and observable busy states for longer actions.

**Rationale:** This matches the established test stack and constitution requirement that completion be based on executable checks rather than manual review. Keep API behavior, authorization, error handling, pending states, and persisted theme behavior under regression coverage.

**Alternatives considered:** Manual inspection or keyboard walkthrough as a release gate. Rejected because the constitution requires agent-executable quality gates.

## Source References

- Repository navigation state and callbacks: `src/clutch-web/src/App.tsx`
- Existing shared button primitive: `src/clutch-web/src/components/ui/button.tsx`
- Underlined navigation controls: `src/clutch-web/src/features/accounts/AccountDetails.tsx`, `src/clutch-web/src/features/admin/ImportLimitsPage.tsx`
- Existing theme persistence and application: `src/clutch-web/src/features/preferences/api.ts`, `src/clutch-web/src/components/theme/ThemeSelector.tsx`, `src/clutch-web/src/components/theme/ThemeProvider.tsx`
- Existing browser/accessibility test patterns: `src/clutch-web/e2e/startup.spec.ts`, `src/clutch-web/e2e/theme-selector.spec.ts`

## External References

- WAI-ARIA Authoring Practices, Button Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/button/
- WAI-ARIA Authoring Practices, Link Pattern (documents native link behavior; this feature intentionally keeps the repository's no-hyperlink rule): https://www.w3.org/WAI/ARIA/apg/patterns/link/
- React `useSyncExternalStore` reference (reviewed for the History API alternative; not needed without external route state): https://react.dev/reference/react/useSyncExternalStore
- MDN History API guide (reviewed as an alternative; not adopted): https://developer.mozilla.org/en-US/docs/Web/API/History_API/Working_with_the_History_API
- WCAG 2.2: https://www.w3.org/TR/WCAG22/

## Resolved Clarifications

No unresolved implementation choices remain for planning. Navigation remains state-based, and native form controls are not converted to buttons.
