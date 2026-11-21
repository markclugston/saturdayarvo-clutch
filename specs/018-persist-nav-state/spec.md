# Feature Specification: Remember Navigation Expanded State

**Feature Branch**: `018-persist-nav-state`

**Created**: 2026-11-21

**Status**: Draft

**Input**: User description: "the nav bar has an expand and collapse capability.  save the state against the logged in user. this will allow them to come back to the way they like it next time."

<!--
  Builds on 011-expand-navigation and 015-nav-shrinks-content. The hamburger already pins the
  navigation open or unpins it; this feature only makes that pinned/unpinned choice persist per user.
  Hover/focus expansion, layout and accessibility behaviour are unchanged.
-->

## Clarifications

### Session 2026-11-21

- Q: After sign-in, what should the screen show while the saved navigation state is still loading? → A: Keep the existing session-loading screen until the saved state is loaded, for at most 2 seconds; on timeout or failure, start compact.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Return to my preferred navigation state (Priority: P1)

As a signed-in user, when I pin the navigation open (or unpin it) with the hamburger, that choice is remembered, so the navigation is in the same state the next time I sign in or reload.

**Why this priority**: This is the whole feature.

**Independent Test**: Pin the navigation, reload the application, and confirm it opens pinned; unpin, reload, and confirm it opens compact.

**Acceptance Scenarios**:

1. **Given** a signed-in user pins the navigation open, **When** they reload, sign out and back in, or return later, **Then** the navigation starts pinned open with the main section laid out as for an expanded navigation.
2. **Given** a signed-in user unpins the navigation, **When** they return, **Then** the navigation starts compact and still expands on hover and keyboard focus.
3. **Given** a user who has never changed the navigation state, **When** they sign in, **Then** the navigation starts compact (unpinned).
4. **Given** the saved state is pinned, **When** the application first displays a signed-in screen, **Then** the navigation appears pinned without first showing compact and then jumping open.
5. **Given** a user signs in, **When** sign-in completes, **Then** the session-loading screen stays up until their saved state has loaded (at most 2 seconds), and the first signed-in screen shows the navigation in that saved state.
6. **Given** loading the saved state fails or takes longer than 2 seconds after sign-in, **When** the signed-in screen appears, **Then** the navigation starts compact and stays compact for the rest of that session unless the user pins it.

---

### User Story 2 - Same preference across devices and users (Priority: P2)

As a signed-in user on more than one device, I get my saved navigation state on each device, and another person signing in on the same device gets theirs, not mine.

**Why this priority**: "Saved against the logged-in user" means the preference follows the account, not the browser.

**Independent Test**: Pin on one device, open the application on another device signed in as the same user, then sign in as a different user on the first device.

**Acceptance Scenarios**:

1. **Given** a user pins the navigation on one device, **When** they next open or refresh the application on another device, **Then** it starts pinned there.
2. **Given** two devices save different states, **When** both have saved, **Then** the most recently saved state is the user's state.
3. **Given** user A saved pinned and user B saved compact, **When** each signs in on the same device, **Then** each sees their own saved state.

### Edge Cases

- Saving fails (network or server error): the on-screen pin/unpin still takes effect for the current session, no blocking error interrupts the user, and the failure is reported through existing non-blocking feedback; the previously saved state applies next visit.
- Loading the saved state fails or takes longer than 2 seconds: the session-loading screen gives way to the signed-in screen with the navigation compact and fully usable; a saved state that arrives later is not applied in that session.
- Rapid repeated toggling: the last state the user chose is the one saved.
- Hover expansion and keyboard-focus expansion are temporary and MUST NOT change the saved state.
- Narrow viewports (below 768 CSS pixels): a saved pinned state still applies, with the navigation overlaying content as defined in 015.
- Sign-in and session-loading screens show no navigation, so the saved state is not applied there.
- Sign-out followed by a different user signing in: the previous user's state is not shown.
- A save still pending at sign-out may complete or fail; either way it shows no feedback after the sign-in screen appears, and never to the next user.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When a signed-in user pins or unpins the navigation with the hamburger control, the system MUST save that pinned/unpinned state against that user.
- **FR-002**: On sign-in and on every application open or refresh with an active session, the system MUST load the user's saved state and the first signed-in screen MUST show the navigation in that state; with no saved state, it MUST start unpinned (compact).
- **FR-002a**: Until the saved state has loaded, the system MUST keep showing the existing session-loading screen, for at most 2 seconds measured from when the session has loaded; after 2 seconds or on load failure it MUST show the signed-in screen with the navigation compact and MUST NOT apply a late-arriving saved state in that session.
- **FR-003**: Only explicit pin/unpin actions MUST change the saved state; hover and keyboard-focus expansion MUST NOT.
- **FR-004**: The saved state MUST belong to the signed-in user, apply on any device they use the next time the application opens or refreshes there, and MUST NOT be visible to or applied for any other user.
- **FR-005**: When states are saved from more than one device, the most recently saved state MUST win.
- **FR-006**: A failure to save the state MUST NOT block navigation or page use, and the chosen state MUST remain in effect for the current session, and the failure MUST be reported through the existing non-blocking feedback. Load failures are covered by FR-002a.
- **FR-007**: Applying a saved pinned state on load MUST NOT cause a visible compact-to-expanded jump of the navigation or main section.
- **FR-008**: The saved state MUST only accept pinned or unpinned; any other value MUST be rejected.
- **FR-009**: Existing hamburger, hover, keyboard focus, layout (011, 015), destinations and accessibility behaviour MUST remain unchanged apart from the starting state.
- **FR-010**: The hamburger control MUST give visible feedback within 500 milliseconds of activation regardless of how long saving takes.

### Key Entities *(include if feature involves data)*

- **Navigation preference**: A signed-in user's saved navigation state (pinned or unpinned) and when it was last saved; one per user.

**Terminology**: *Pinned* (stored `Pinned`) means the hamburger holds the navigation open; this is the "expanded state" in the title. *Unpinned* or *compact* (stored `Unpinned`) means the navigation is closed. Temporary hover or focus expansion is neither state and is never saved.

### Constitution Scope

Tick each that applies, so plan can pick requirement IDs without rereading the spec:

- [x] Stores, changes or deletes data (DOT-002, OPS-001 migrations)
- [ ] Creates or reads audit records (AUD-001)
- [x] Adds or changes endpoints, auth or input handling (SEC-001)
- [ ] Handles personal, payment or financial data (SEC-003)
- [x] Changes UI in clutch-web (WEB-001, style guide)

## Success Criteria *(mandatory)*

- **SC-001**: In 100% of return visits (reload, sign out/in, new device), the navigation starts in the user's most recently saved state.
- **SC-002**: Users who never toggled the navigation start compact in 100% of sign-ins.
- **SC-003**: In 100% of checks, one user's saved state is never applied to another user.
- **SC-004**: Hover and keyboard-focus expansion change the saved state in 0% of checks.
- **SC-005**: When saving or loading fails, the navigation and page remain usable in 100% of checks, and the hamburger responds visibly within 500 milliseconds.
- **SC-006**: After sign-in, the wait for the saved state never exceeds 2 seconds from when the session has loaded in 100% of checks, including when loading the saved state is slow or fails, so the signed-in screen follows without further waiting; the navigation never visibly jumps from compact to pinned.

## Assumptions

- The "expand and collapse capability" is the existing hamburger pin/unpin; its current "nothing is persisted" behaviour is replaced by this feature. 011's assumption that no expansion state is persisted is superseded.
- The preference is synced per account like the theme preference (003): applied on next open or refresh, last save wins; it is not pushed live to other already-open devices.
- Default for users with no saved state is unpinned (compact), matching current behaviour.
- Preference changes are not audit events, consistent with the theme preference.
- Acceptance is verified through automated checks, not manual testing.
