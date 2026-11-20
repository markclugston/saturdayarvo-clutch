# Feature Specification: Style Guide Compliance

**Feature Branch**: `014-style-guide-compliance`

**Created**: 2026-11-20

**Status**: Draft

**Input**: User description: "update all screens so that they comply with the style guide"

## Clarifications

### Session 2026-11-20

- Q: How should we check automatically that each screen looks right in both themes? → A: Automated browser screenshot baselines for every screen and dialog in Light and Soft Dark, plus automated accessibility checks; existing baselines are regenerated once in this feature and reviewed.
- Q: Should the side navigation change to the style guide's widths, or keep the widths it has today? → A: Adopt the guide's widths: 64px collapsed, 240px expanded; the expanded panel still overlays content as today.
- Q: Should the automated style check cover every frontend file, including the shared UI building blocks, or exempt the building blocks folder? → A: Check every file with no folder exemption; the allowed patterns (focus ring, in-card hairline, float shadow) exist only as named tokens or utilities, which the check permits.
- Q: Which screen states should the automated accessibility and screenshot checks cover, beyond each screen's default view? → A: Default view of each screen, plus each dialog open, each form with validation errors shown, a focused/filled floating field, and the navigation expanded, in both themes.
- Q: How long should animations be, and what should happen when the user has asked their device to reduce motion? → A: 150–250ms, ease-out or ease-in-out, animating only colour, opacity, transform and width; with reduced motion, disabled or under 50ms. The application is desktop only.
- Q: What is the narrowest desktop window the screens must support, and which window sizes should the screenshot checks use? → A: Minimum 1024px wide; screenshots at 1024×768 and 1440×900.
- Q: How is the current navigation item shown, given the guide's selected fill is under 3:1 against the navigation surface? → A: With the primary fill and contrasting text, as today, so the current state keeps at least 3:1 contrast; hover keeps the subtler hover fill.
- Q: The existing browser test asserts that the expanded navigation never covers the page heading at 1280px wide, which the new content panel no longer allows. What gives? → A: The navigation overlays content (FR-011), so that one assertion is updated to check that content geometry does not change when the navigation expands.
- Q: No form has field-level validation today. What do the "form with validation errors" states show? → A: A failed submission that shows the form's existing error message, restyled as danger text with an icon. Validation behaviour and messages do not change; no field-level errors are added.
- Q: The delete category confirmation is an inline panel in the category tree, not a floating dialog. How is it styled? → A: As an inline raised panel with no shadow and no border, with a warning status and an explicit danger action. Its behaviour does not change.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consistent, calm look across every screen (Priority: P1)

A signed-in user moving between Accounts, Account details, Import, Categories and Import limits sees one visual language: a canvas shell with the navigation on it, an inset rounded content panel, cards one tone step above it, and controls one step above the cards, separated by tone and radius rather than lines.

**Why this priority**: This is the feature's purpose; every other story depends on the shared surfaces and tokens it introduces.

**Independent Test**: Open each signed-in screen in the Light theme and confirm the layered surfaces, token-only colours and radii, and no borders or dividers on layout containers.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** any signed-in screen is shown, **Then** the shell and navigation share the canvas tone with no border between navigation and content, and content sits in an inset rounded panel with a visible canvas gutter.
2. **Given** a screen with sections, lists or tables, **When** it is shown, **Then** each section is a rounded card with no border, and any separator inside a card is the documented faint hairline only.
3. **Given** any screen, **When** it is inspected, **Then** every colour, radius and shadow comes from the style guide's named tokens.

---

### User Story 2 - Forms use floating labels (Priority: P1)

A user filling in sign-in, sign-up, account, import mapping, category and import-limit forms sees fields on a raised tone with labels that sit inside the field and float up on focus or when filled, with errors stated in text.

**Why this priority**: Forms are on every core journey and are the area with the most current deviations.

**Independent Test**: Complete and fail each form; confirm floating labels, visible focus rings and text error messages.

**Acceptance Scenarios**:

1. **Given** an empty field, **When** it receives focus or a value, **Then** its label moves to the floated position and stays readable.
2. **Given** a form, **When** its submission fails, **Then** the form's existing error message is shown as text with an icon, announced to assistive technology and not conveyed by colour alone.

---

### User Story 3 - Soft Dark theme is comfortable and complete (Priority: P2)

A user who chooses Soft Dark sees every screen and dialog in charcoal layered surfaces, never pure black backgrounds or pure white text, with the same structure as Light.

**Why this priority**: Both themes are supported; dark is currently a generic palette rather than the style guide's.

**Independent Test**: Switch to Soft Dark and open every screen and dialog; check surface and text values and contrast.

**Acceptance Scenarios**:

1. **Given** Soft Dark is selected, **When** any screen or dialog is shown, **Then** no surface is pure black, no text is pure white, and elevation is shown by lighter surfaces.
2. **Given** either theme, **When** text, controls and status chips are measured, **Then** they meet WCAG 2.2 AA contrast.

---

### User Story 4 - Dialogs, buttons, status and navigation follow the guide (Priority: P2)

A user sees dialogs (startup loading, delete transaction, import ended) as floating rounded surfaces with the float shadow, the inline delete category confirmation as a raised panel without a shadow, buttons and chips with control and chip radii, status shown with labelled status chips, and navigation items with a current fill and a hover fill, while the navigation expands and collapses exactly as before.

**Why this priority**: Completes coverage of shared components without changing behaviour.

**Independent Test**: Open each dialog and use the navigation with mouse and keyboard; compare expand/collapse behaviour with the current release.

**Acceptance Scenarios**:

1. **Given** the navigation, **When** it is hovered, focused by keyboard or dismissed with Escape, **Then** it expands and collapses on the same triggers as today, with the active item shown by a fill with at least 3:1 contrast against the navigation surface and heavier text. When the navigation has been dismissed with Escape and an item is still focused or hovered, that item shows its label in a tooltip.
2. **Given** a status or validation state (e.g. import ended, delete warning), **When** shown, **Then** it uses a status chip or message with text or an icon, not colour alone.

---

### User Story 5 - Deviations are caught automatically (Priority: P3)

A developer who adds a raw colour, default palette class, non-token radius, layout border, non-focus ring, non-float shadow or colour `dark:` variant gets a lint failure in the frontend quality gate.

**Why this priority**: Keeps the screens compliant after this feature ships.

**Independent Test**: Add a forbidden class to a component and confirm the lint gate fails; remove it and confirm it passes.

**Acceptance Scenarios**:

1. **Given** a component using a forbidden style pattern, **When** the frontend lint gate runs, **Then** it fails and names the file and pattern.

---

### Edge Cases

- Long account or category names and wide transaction or import review tables → content scrolls inside its card; no horizontal page scroll and no border added to separate rows.
- Desktop windows down to the 1024px minimum width → the content panel gutter and card padding shrink but surfaces stay distinct, and there is no horizontal page scroll. Windows narrower than 1024px, and phone and tablet layouts, are not a design target, but the existing browser tests that run at 320–390px wide (no horizontal page scroll, controls reachable, navigation overlay) MUST still pass.
- Reduced motion preference → navigation width and label transitions and dialog animations are disabled or under 50ms.
- Theme switched while a dialog is open → dialog surfaces update with the rest of the page.
- Sign-in and startup screens shown before a theme preference is known → follow the existing theme resolution and still meet the guide. The automated checks render these screens in Soft Dark by applying the `.dark` class directly, because the app only shows Dark after the preference loads.
- Destructive actions (delete transaction, delete category) → danger styling is paired with explicit text.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The style guide's colour, surface, status, radius and shadow tokens MUST be defined for both Light and Soft Dark and be the only values screens use.
- **FR-002**: Shared UI primitives MUST provide the style guide's building blocks (app shell, side navigation, content panel, card, floating field, button, chip, status chip, tooltip, dialog) and every screen MUST be built from them.
- **FR-003**: Every screen MUST follow the canvas → content → card → raised surface hierarchy: sign-in and sign-up, startup loading, the session load error screen, the signed-in header (theme selector, Import limits, Sign out) and its session and sign-out error messages, Accounts, Account details and transactions, Import (file selection, mapping, review, ended), Categories (including the inline delete confirmation), Import limits, and all dialogs.
- **FR-004**: Layout containers MUST NOT have borders or divider lines; the only exceptions are the documented in-card hairline and focus rings.
- **FR-005**: Only floating elements (dialogs, popovers, menus) MAY have a shadow, and only the float shadow.
- **FR-006**: All form fields MUST use floating labels on the raised tone; any external label requires documented justification in the plan. Form error messages keep their existing wording and announcement and are shown as danger text with an icon; validation behaviour does not change and no field-level errors are added.
- **FR-007**: Every interactive element MUST show a visible focus ring in both themes.
- **FR-008**: Status, validation and destructive states MUST be conveyed by text or icon as well as colour, using status chips where a status is displayed.
- **FR-009**: Soft Dark MUST have no pure black surface and no pure white text; elevation MUST be shown by lighter surfaces.
- **FR-010**: Text, controls and status chips MUST meet WCAG 2.2 AA contrast in both themes.
- **FR-011**: Navigation expand/collapse triggers, Escape dismissal, keyboard and pointer behaviour MUST be unchanged, and the expanded navigation MUST continue to overlay content rather than push it; only appearance changes (tones, radius, transitions, tooltips, and widths of 64px collapsed and 240px expanded). The current item MUST keep at least 3:1 contrast against the navigation surface.
- **FR-012**: Transitions MUST last 150–250ms with ease-out or ease-in-out easing and animate only colour, opacity, transform and width; when the reduced-motion preference is set they MUST be disabled or shortened to under 50ms.
- **FR-013**: The frontend quality gate MUST fail on raw colours, default palette classes, non-token radii, layout borders or dividers, non-focus rings, non-float shadows, colour `dark:` variants and non-compliant transitions, wherever they appear in class strings (class attributes, class-merging helper calls and class variables). It MUST check every `.ts`/`.tsx` file under `src/clutch-web/src/`, including the shared UI primitives, with no folder exemption (`index.css` defines the tokens and is not checked); the focus ring, in-card hairline and float shadow MUST be available only as named tokens or utilities, and those are the only forms the check permits.
- **FR-014**: Existing screen behaviour, content, data and accessible names MUST NOT change; no new screens or features are added.

### Constitution Scope

- [ ] Stores, changes or deletes data (DOT-002, OPS-001 migrations)
- [ ] Creates or reads audit records (AUD-001)
- [ ] Adds or changes endpoints, auth or input handling (SEC-001)
- [ ] Handles personal, payment or financial data (SEC-003)
- [x] Changes UI in clutch-web (WEB-001, style guide)

## Success Criteria *(mandatory)*

- **SC-001**: 100% of screens and dialogs listed in FR-003 pass every item of the style guide compliance checklist (§11) in both themes; visual verification is by automated screenshot baselines of every screen and dialog in Light and Soft Dark.
- **SC-001a**: Automated screenshot and accessibility checks cover, in both themes, each screen's default view plus: each dialog and the inline delete confirmation open, each form after a failed submission with its error message shown, the sign-up mode, the session load error screen, a focused and a filled floating field, and the navigation expanded. Screenshots are taken at 1024×768 and 1440×900.
- **SC-002**: The automated style check reports zero violations across the frontend, and fails when a forbidden pattern is introduced.
- **SC-003**: Automated accessibility checks report zero WCAG 2.2 AA contrast or focus-visibility violations on every screen and state listed in SC-001a in both themes.
- **SC-004**: All existing frontend and browser journey tests pass without changes to the behaviour they assert. The only existing test expectations that change are two navigation layout expectations that FR-011 makes obsolete: the collapsed navigation width (56px becomes 64px) and the 1280px check that the expanded navigation does not cover the page heading (replaced by a check that content geometry does not change when the navigation expands). The orphaned import-mapping baseline folder is removed, and the new style-guide baselines are created once in this feature and reviewed.
- **SC-005**: A user can complete sign-in, import, view transactions, manage categories and change import limits with the same number of steps as before.

## Assumptions

- The style guide is the `clutch-ui-style` skill; values in `src/clutch-web/src/index.css` are the source of truth once the guide's tokens are added there (they are not defined yet; the file holds default library values).
- The existing theme runtime and the Light / Soft Dark selection (`src/clutch-web/src/components/theme/`) are settled; only the token values and how screens consume them change.
- Navigation widths change from 56px / 144px to 64px collapsed and 240px expanded (FR-011) as a styling change; its triggers in `src/clutch-web/src/App.tsx` are unchanged.
- No charts or timelines exist yet, so chart series tokens and hatched regions are defined but not applied to any screen.
- The application is desktop only, with a minimum supported window width of 1024px; phone and tablet layouts and touch interaction are out of scope.
- The empty budgets feature folder has no screen and is out of scope.
- No backend, API or data changes are needed.
- Forms keep their existing validation: native required-field checks and one form-level message from the server on a failed submission.
