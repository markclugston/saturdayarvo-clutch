# Feature Specification: Navigation Expansion Resizes Content

**Feature Branch**: `015-nav-shrinks-content`

**Created**: 2026-11-20

**Status**: Draft

**Input**: User description: "i like how the left navigation bar expands.  I want to change a requirement that it overlays the content.  now i want it to expand but shrink the main page section."

<!--
  Amends 011-expand-navigation. Where this spec conflicts with 011 (FR-010, the "overlay" clarifications,
  User Story 3 scenario 3, the narrow-screen edge case), this spec wins; 011's hover/focus expansion,
  destinations and accessibility behaviour are unchanged.
  Amended 2026-11-22: 011 triggers are now hover (768px and wider only) and the hamburger pin;
  keyboard focus no longer expands the navigation (see 011 Amendment 2026-11-22).
-->

## Clarifications

### Session 2026-11-20

- Q: On very narrow screens (such as 320 CSS pixels), should the expanded navigation still shrink the main section? → A: No. Shrink above a narrow-screen breakpoint; below it the navigation overlays content as in 011.
- Q: At what viewport width should the navigation stop shrinking the main section and overlay it instead? → A: 768 CSS pixels (shrink at 768 and above; overlay below 768).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Expanding navigation makes room instead of covering content (Priority: P1)

As a signed-in user, when the left navigation expands I want the main page section to narrow to make room, so that nothing on the page is hidden behind the navigation.

**Why this priority**: This is the whole change; it replaces the overlay behaviour.

**Independent Test**: Hover over the compact navigation on any signed-in screen and compare the main section's left edge and width before, during and after expansion.

**Acceptance Scenarios**:

1. **Given** the compact navigation, **When** the user hovers over it, **Then** the navigation widens and the main page section's left edge moves right and its width shrinks by the same amount, with no content covered by the navigation.
2. **Given** the hover-expanded navigation that is not pinned, **When** the pointer leaves it, **Then** it collapses and the main section returns to its original position and width (amended 2026-11-22).
3. **Given** the compact navigation, **When** a keyboard user activates the hamburger, **Then** the navigation expands and the main section shrinks exactly as with hover (amended 2026-11-22).
4. **Given** the main section contains page content (forms, tables, account lists), **When** the section shrinks or grows, **Then** the content reflows to the available width with nothing clipped or unreachable.

---

### User Story 2 - Resizing stays stable and comfortable (Priority: P2)

As a signed-in user, I want the expand/collapse resize to feel smooth and not interfere with what I'm doing.

**Why this priority**: Content that jumps on every hover would make the feature worse than the overlay.

**Independent Test**: Move the pointer across and away from the navigation repeatedly and while interacting with page controls; confirm no flicker, lost focus or lost input.

**Acceptance Scenarios**:

1. **Given** the user is typing in a page field, **When** the navigation expands or collapses, **Then** the field keeps focus and its entered value.
2. **Given** the pointer rests on the border between navigation and content, **When** the layout resizes, **Then** the navigation does not repeatedly expand and collapse.
3. **Given** a user who prefers reduced motion, **When** the navigation expands or collapses, **Then** the resize happens without animation.

---

### User Story 3 - Works on narrow screens (Priority: P2)

As a signed-in user on a narrow screen, I can still reach all page content when the navigation is expanded.

**Why this priority**: Shrinking would leave almost no room at narrow widths, so below the narrow-screen breakpoint the navigation overlays content as in 011 to preserve access.

**Independent Test**: At a 320 CSS pixel viewport, expand the navigation and verify page content remains reachable and the page itself does not scroll horizontally.

**Acceptance Scenarios**:

1. **Given** a viewport narrower than the narrow-screen breakpoint (including 320 CSS pixels), **When** the user pins the navigation with the hamburger (hover does not expand it there, per 011 FR-014, amended 2026-11-22), **Then** it overlays the main section as defined in 011, the main section keeps its full width and position, and the page as a whole has no horizontal scroll.
2. **Given** a viewport narrower than the breakpoint, **When** the navigation collapses, **Then** the overlay is removed and page content is fully visible.
3. **Given** a viewport at or above the breakpoint, **When** the navigation expands, **Then** the main section shrinks as in User Story 1.

### Edge Cases

- Light, Dark and System themes: the resized layout remains legible with no uncovered gap or seam between navigation and content.
- Keyboard focus on a page control while the pointer holds the navigation expanded: the focused control stays visible within the shrunken main section.
- Navigating to another screen while the navigation is expanded keeps it expanded and the main section shrunk, with no layout jump.
- Sign-in and session-loading screens (no navigation) are unaffected.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: At viewport widths at or above the narrow-screen breakpoint, when the navigation expands, the main page section MUST shrink in width and shift right by the amount the navigation grows; the navigation MUST NOT overlay or cover any page content.
- **FR-002**: When the navigation collapses, the main section MUST return to its compact-state position and width.
- **FR-003**: The main section's content MUST reflow to its available width in both states, with no clipped or unreachable content and no horizontal scroll of the whole page, including at a 320 CSS pixel viewport (where the overlay behaviour of FR-009 applies).
- **FR-004**: Expansion and collapse triggers (hover and the hamburger pin, amended 2026-11-22), destinations, labels, current-destination indication and accessibility behaviour MUST remain as defined in 011.
- **FR-005**: The resize MUST NOT remove focus from, or clear values entered in, any page control.
- **FR-006**: The navigation MUST NOT flicker between states when the pointer rests on its edge during a resize.
- **FR-007**: The resize MUST be visible within 500 milliseconds and MUST be applied without animation when the user prefers reduced motion.
- **FR-008**: Requirements in 011 (including 011 FR-010) that call for overlaying content or for not resizing or moving content are superseded by this feature at viewport widths at or above the narrow-screen breakpoint; below it, 011's overlay behaviour continues to apply (FR-009).
- **FR-009**: Below the narrow-screen breakpoint, the expanded navigation MUST overlay the main section as defined in 011, without resizing or moving it.
- **FR-010**: The narrow-screen breakpoint is 768 CSS pixels: viewports 768 and wider shrink the main section; viewports narrower than 768 overlay it. (This is 015 FR-010, unrelated to 011 FR-010.)

### Constitution Scope

- [ ] Stores, changes or deletes data (DOT-002, OPS-001 migrations)
- [ ] Creates or reads audit records (AUD-001)
- [ ] Adds or changes endpoints, auth or input handling (SEC-001)
- [ ] Handles personal, payment or financial data (SEC-003)
- [x] Changes UI in clutch-web (WEB-001, style guide)

## Success Criteria *(mandatory)*

- **SC-001**: In 100% of expand checks on signed-in screens, the main section's width decreases by the navigation's growth and no page content is covered by the navigation.
- **SC-002**: In 100% of collapse checks, the main section returns to its original width and position.
- **SC-003**: At 320 CSS pixels (overlay) and at wide viewports (shrink), in both states and all three themes, all page content is reachable and the page has no horizontal scroll.
- **SC-004**: Entered form values and focus survive 100% of expand/collapse cycles.
- **SC-005**: Repeated hover over the navigation edge produces no oscillating state changes.

## Assumptions

- The pane's width, hover and hamburger-pin triggers (amended 2026-11-22), no persisted state (later superseded by 018), destinations and accessibility behaviour already implemented stay as they are; only the relationship to the main section changes.
- The shrink applies at viewport widths at or above the narrow-screen breakpoint; below it the navigation overlays content as in 011. Content within the main section adapts by wrapping or scrolling inside the section.
- Resize timing and easing follow existing UI motion conventions.
