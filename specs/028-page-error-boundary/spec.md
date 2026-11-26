# Feature Specification: Page Error Boundary

**Feature Branch**: `028-page-error-boundary`

**Created**: 2026-11-26

**Status**: Draft

**Input**: User description: "Add an approved React error boundary around the page content of clutch-web so that a render exception no longer blanks the whole app: navigation stays usable, an accessible error message with a retry action is shown, no error details or sensitive data are disclosed (SEC-003), and nothing sensitive is logged." Amended the same day: also cover render errors outside the page content.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Keep Using the App When a Page Fails (Priority: P1)

A signed-in user opens or uses a page that fails to display. The page content area shows an error message with a retry action, while the header and navigation keep working.

**Why this priority**: Today one failing page blanks the whole app, leaving a browser reload as the only way out.

**Independent Test**: Force one page to fail while displaying, then navigate to another page and retry.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** the page content fails to display, **Then** the content area shows an error message with a "Try Again" button, and the header and navigation remain.
2. **Given** the error message, **When** the user activates "Try Again" and the fault is gone, **Then** the page displays normally, using freshly loaded data.
3. **Given** the error message, **When** the user activates "Try Again" and the fault remains, **Then** the message says the content failed to display again.
4. **Given** the error message, **When** the user chooses a different destination in the navigation, **Then** that page displays normally.
5. **Given** a failing page, **When** the failure is shown or recorded in the browser, **Then** no error text, stack, component names or page data appear on screen or in the console.

---

### User Story 2 - Recover When the App Itself Fails (Priority: P2)

A user meets a display failure outside the page content: in the header, navigation, app frame, startup dialog or sign-in screen. Instead of a blank window, the app shows an error message with a retry action.

**Why this priority**: These failures are rarer than page failures but still blank the whole window.

**Independent Test**: Force the header or the sign-in screen to fail, then retry.

**Acceptance Scenarios**:

1. **Given** any user, **When** something outside the page content fails to display, **Then** the window shows an error message with a "Try Again" button, in the theme already applied.
2. **Given** that message, **When** the user activates "Try Again" and the fault is gone, **Then** the app starts again with freshly loaded data, including the sign-in check.
3. **Given** that message, **When** the user activates "Try Again" and the fault remains, **Then** the message says the app failed to display again.
4. **Given** that failure, **When** it is shown or recorded in the browser, **Then** no error text, stack, component names or data appear on screen or in the console.

### Edge Cases

- The failing page had unsaved edits → those edits are lost, the message says so, and navigating away raises no "discard changes" prompt.
- The Categories add form fails → it shows its own error message; the category list and navigation remain.
- The message appears → keyboard focus moves to "Try Again" and the message is announced to assistive technology.
- The add form fails while its page is first opening → the page's own initial focus takes precedence.
- A momentary fault that the app recovers from by itself → the page displays; nothing about the fault's details is recorded.
- The app fails before the saved theme has been applied → the message shows in the Light theme.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A failure while displaying page content MUST NOT remove the header, navigation or app shell.
- **FR-002**: In place of the failed content the system MUST show a message, announced as an alert, that the content could not be displayed and that unsaved changes in it may be lost.
- **FR-003**: The message MUST offer a "Try Again" button that receives keyboard focus and redisplays the content, discarding cached data that only the failed content was using.
- **FR-004**: A failure after a retry, including one that follows a loading step, MUST show a message saying the content failed to display again and that unsaved changes in it may be lost.
- **FR-005**: Choosing a different destination MUST clear the error and display that destination.
- **FR-006**: The Categories add form MUST be protected separately, so its failure leaves the category list usable.
- **FR-007**: The system MUST NOT display any error detail or page data in a message.
- **FR-008**: The system MUST NOT write error details, component stacks or page data to the browser console for any display failure; a fixed, generic notice is permitted.
- **FR-009**: A display failure outside the page content MUST show a message, announced as an alert, that the app could not be displayed and that unsaved changes may be lost, with a focused "Try Again" button.
- **FR-010**: That retry MUST redisplay the app, discarding all cached data; a failure after it MUST show a message saying the app failed to display again.

### Constitution Scope

- [ ] Stores, changes or deletes data (DOT-002, OPS-001 migrations)
- [ ] Creates or reads audit records (AUD-001)
- [ ] Adds or changes endpoints, auth or input handling (SEC-001, SEC-004)
- [x] Handles personal, payment or financial data (SEC-003)
- [x] Changes UI in clutch-web (WEB-001, style guide)

## Success Criteria *(mandatory)*

- **SC-001**: For every signed-in page, a display failure leaves all navigation destinations reachable without reloading the browser.
- **SC-002**: Each error message and its retry action pass automated WCAG 2.2 AA checks in both themes.
- **SC-003**: Zero characters of the underlying error appear on screen or in the console.
- **SC-004**: No display failure inside the app leaves a blank window.

## Assumptions

- "Page content" is what the signed-in navigation switches between, plus the Categories add form. Everything else the app displays is covered by User Story 2.
- A failure in the theme or data-loading setup that surrounds the whole app is not given a message; FR-008 still applies.
- Preserving edits made inside the failed area is out of scope; edits and state held outside it are unaffected.
- Only display (render and lifecycle) failures are covered; failed requests and event actions keep their existing messages.
- No error reporting service is added; the app has none today (`src/clutch-web/src/main.tsx`).
