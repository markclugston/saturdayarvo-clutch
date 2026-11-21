# Feature Specification: Expandable Left Navigation

**Feature Branch**: `agents/hamburger-navigation-expansion`

**Created**: 2026-11-17

**Status**: Draft

**Input**: User description: "create a hamburger style expanding navigation paign on the left that goes from small where you only see small icons to large where you see the same small icons but with the words for the link. move the accounts and categories button that current exist on the top to that navigation paign. this navigation paign is to be visible on all screens once logged in."

## Clarifications

### Session 2026-11-17

- Q: How should the pane expand and share space with page content? → A: Expand on mouse hover without a hamburger button and overlay page content; keyboard focus also expands it, while touch users tap destination icons directly.
- Q: Must the pane always overlap page content on wide screens? → A: No. It overlays content only where they naturally share space; expansion must not resize or move the main content.

### Amendment 2026-11-22

- Q: Does keyboard focus still expand the pane, and is there a hamburger? → A: No to focus expansion; yes to a hamburger. Since the navigation refactor (`cbc27b3`), mouse hover expands the pane and a hamburger button at the top of the pane pins it open until activated again. Keyboard focus moving onto a destination no longer expands the pane; keyboard users expand it by activating the hamburger. Compact destinations keep their accessible names. This replaces the 2026-11-17 answer's "without a hamburger button" and "keyboard focus also expands it". The pinned state is persisted per user by 018.
- Q: Is Escape dismissal still required, and does hover still expand the pane on narrow screens? → A: No to Escape; hover expands the pane only at 768 CSS pixels and wider. Below 768px the expanded pane covers page content, and WCAG 2.2 SC 1.4.13 requires hover-triggered content that covers other content to be dismissible, so hover no longer opens it there. Only the hamburger does, which is a deliberate action that activating it again reverses, so no separate dismissal is needed. This removes the Escape requirement and the narrow-width hover overlay.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Navigate from any signed-in screen (Priority: P1)

As a signed-in user, I can use a left-hand navigation pane to reach Accounts and Categories from anywhere in the application, so that those destinations are always readily available.

**Why this priority**: Relocating the existing destinations and making them consistently available is the feature's core value.

**Independent Test**: Sign in, visit each signed-in screen, and use each navigation destination; verify the pane is present and the existing destination behavior is preserved.

**Acceptance Scenarios**:

1. **Given** a signed-in user on any application screen, **When** the screen is displayed, **Then** the left-hand pane is visible and contains controls for Accounts and Categories rather than those controls appearing in the top header.
2. **Given** a signed-in user on any application screen, **When** they select Accounts in the pane, **Then** the Accounts overview appears as it did when using the former header control.
3. **Given** a signed-in user on any application screen, **When** they select Categories in the pane, **Then** the Categories screen appears as it did when using the former header control.
4. **Given** a user who is not signed in, **When** the sign-in or session-loading screen is displayed, **Then** the signed-in navigation pane is not shown.
5. **Given** a signed-in user on an Accounts or Categories screen, **When** they inspect the pane, **Then** the current destination is identified, including for screens within the Accounts flow.

---

### User Story 2 - Expand and collapse navigation (Priority: P1)

As a signed-in user, I can reveal destination labels by hovering over the compact icon-only pane or by pinning it open with the hamburger button (amended 2026-11-22).

**Why this priority**: The two pane sizes and automatic expansion are essential to the requested navigation experience.

**Independent Test**: Hover over and leave the pane, then navigate using its controls; verify keyboard focus and touch navigation.

**Acceptance Scenarios**:

1. **Given** the compact pane at 768 CSS pixels or wider, **When** the user moves the mouse over it, **Then** it expands, overlays any content in its path or (per 015) makes room for it, and shows a text label next to the same icon for each destination. Below 768px hover does not expand it (amended 2026-11-22).
2. **Given** the hover-expanded pane that is not pinned, **When** the mouse leaves, **Then** it collapses to show destination icons without visible text labels (amended 2026-11-22).
3. **Given** either pane state, **When** the user selects a destination, **Then** the same destination opens; touch users can tap an icon directly.
4. **Given** either pane state, **When** the user activates the hamburger button by mouse or keyboard, **Then** the pane is pinned open, or unpinned if it was pinned, and the button's expanded state reports this (added 2026-11-22).

---

### User Story 3 - Use navigation across devices and input methods (Priority: P2)

As a signed-in user on a narrow screen or using a keyboard or assistive technology, I can identify and operate the pane and its destinations without losing access to page content.

**Why this priority**: Persistent navigation must not exclude users or obstruct their existing tasks.

**Independent Test**: At supported wide and narrow screen sizes, operate both destinations with keyboard, touch and assistive-technology names, and verify that page content remains usable when the pane is not expanded.

**Acceptance Scenarios**:

1. **Given** the compact pane, **When** a keyboard user focuses a destination, **Then** the pane stays compact, focus is visible, the destination is announced by name and the expected action occurs on activation; activating the hamburger expands the pane (amended 2026-11-22).
2. **Given** the compact pane, **When** a user relies on assistive technology, **Then** each icon-only destination has its destination name.
3. **Given** a supported narrow screen, **When** the pane expands, **Then** it overlays the page without resizing it; the page becomes unobstructed when the pane collapses.
4. **Given** Light, Dark, or System theme mode, **When** the user operates the pane, **Then** its controls and labels remain legible and the selected theme behavior is unchanged.

### Edge Cases

- Selecting Accounts from an account detail or import screen returns to the Accounts overview, preserving the existing Accounts control behavior.
- Navigating to Categories from an account detail or import screen preserves the existing Categories control behavior.
- The pane remains available on administrator settings screens without changing who can access those settings.
- If signing out succeeds or a session expires, the signed-in pane is no longer displayed; existing session and sign-out error feedback remains intact.
- Below 768 CSS pixels the expanded pane overlays the page and only the hamburger expands it; unpinning restores access to the underlying content (amended 2026-11-22).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST display a left-hand navigation pane on every signed-in screen, including account details, import, Categories, and administrator settings.
- **FR-002**: The pane MUST provide Accounts and Categories navigation controls, and those two controls MUST no longer appear in the top header.
- **FR-003**: The pane MUST expand on mouse hover at 768 CSS pixels and wider, and collapse on mouse exit unless pinned. A hamburger button at the top of the pane MUST pin it open until activated again, and MUST be operable by keyboard. Keyboard focus on a destination MUST NOT by itself expand the pane (amended 2026-11-22).
- **FR-004**: In the compact state, the pane MUST show an icon for each destination without a visible destination label; in the expanded state, it MUST show the same icons alongside their destination labels.
- **FR-005**: Both pane states MUST allow users to reach Accounts and Categories with the same destination, navigation behavior, and access rules as the existing header controls.
- **FR-006**: The pane MUST identify the current Accounts or Categories destination when one is active, including Accounts sub-screens, in both pane states.
- **FR-007**: The pane MUST remain expanded while hovered or pinned, including across signed-in screen changes (amended 2026-11-22).
- **FR-008**: The pane MUST NOT appear on sign-in or initial session-loading screens, or after the user is signed out.
- **FR-009**: Destination controls MUST be buttons with meaningful accessible names, visible keyboard focus, keyboard operability and a hand pointer on hover. Compact destinations MUST expose their names to assistive technology, and keyboard users MUST be able to reveal labels with the hamburger (amended 2026-11-22); touch users MUST be able to navigate directly by tapping an icon.
- **FR-010**: At supported responsive viewport sizes, the expanded pane MUST overlay any page content occupying the same space without resizing or moving that content. Content MUST NOT be repositioned or the pane widened merely to force an overlap. Pane controls and page content MUST remain reachable and usable, and the pane MUST meet WCAG 2.2 Level AA.
- **FR-011**: The pane MUST remain legible and usable in Light, Dark, and System modes without changing the existing theme selection, default, or persisted preference behavior.
- **FR-012**: Existing theme, administrator settings, sign-out, session feedback, and page-specific controls MUST remain available with their existing behavior and access rules.
- **FR-013**: Hover expansion and navigation actions MUST provide a visible response within 500 milliseconds; if an action takes longer, a busy state MUST be shown, with progress when measurable.
- **FR-014**: Below 768 CSS pixels, where the expanded pane covers page content, mouse hover and keyboard focus MUST NOT expand the pane. Only the hamburger expands it there, and activating it again collapses it, so no content opens on hover or focus without being dismissible (WCAG 2.2 SC 1.4.13). A separate Escape dismissal is not required (amended 2026-11-22).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The navigation pane is present on 100% of signed-in screens and absent on sign-in and initial session-loading screens.
- **SC-002**: Both destinations are reachable from 100% of signed-in screens in both pane states, and neither destination control remains in the header.
- **SC-003**: In 100% of hover and hamburger-pin checks (amended 2026-11-22), compact mode shows both destination icons without visible labels and expanded mode shows those same icons with the correct labels.
- **SC-004**: All destination controls are identifiable and operable by keyboard and assistive technology in both states, and the pane meets WCAG 2.2 Level AA.
- **SC-005**: At supported narrow and wide viewport sizes and in all three theme modes, all pane controls and page content remain reachable and legible.
- **SC-006**: Hover expansion and navigation actions provide a visible response within 500 milliseconds or show a busy state when they take longer, with progress when measurable.

## Assumptions

- The pane is compact when neither hovered nor pinned (amended 2026-11-22). The pinned state is persisted per user by 018, superseding "no expansion state is persisted".
- Accounts and Categories are the only destinations being moved into the pane. Theme selection, administrator settings, and sign-out remain in their current header location.
- Existing navigation behavior, authorization, error feedback, and page content remain unchanged except for the relocation of the two destination controls.
- Theme behavior remains unchanged: Light is the default, the signed-in user's Light, Dark, or System preference remains persisted, and System follows the operating system.
- Acceptance is verified through executable checks rather than requiring participant usability studies or manual confirmation.
