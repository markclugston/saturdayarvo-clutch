# Feature Specification: Reliable Startup Loading

**Feature Branch**: `main` (existing branch; no branch created)

**Created**: 2026-11-09

**Status**: Draft

**Input**: User description: "currently when the application first loads there is a blank screen with the loading... text. this often fails and i need to press retry. make this wait longer or just work. also dont show a blank screen. show the login screen and have a modal dialog greying out the full site showing loading."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See a clear startup state (Priority: P1)

As a person opening the application, I want to see the sign-in screen behind a full-screen dimmed loading overlay, so I know the application is starting rather than seeing a blank page.

**Why this priority**: The startup screen is the first experience for every visitor and should clearly communicate that work is in progress.

**Independent Test**: Delay the startup session check, open the application, and verify that the sign-in screen remains visible behind a full-viewport dimmed loading overlay that prevents interaction with the page.

**Acceptance Scenarios**:

1. **Given** startup session checking is in progress, **When** the application is displayed, **Then** the sign-in screen is visible behind an overlay announcing that loading is in progress, and the entire viewport is dimmed.
2. **Given** the loading overlay is open, **When** a person tries to use the underlying sign-in controls with a pointer or keyboard, **Then** those controls cannot be operated until the overlay closes.
3. **Given** the loading overlay is open, **When** a person uses assistive technology or a keyboard, **Then** its loading status is announced, focus does not move to the underlying page, and the non-interactive message does not receive focus.
4. **Given** startup finishes with no active session, **When** the result is available, **Then** the loading overlay closes and the sign-in screen becomes usable.

---

### User Story 2 - Recover from slow startup automatically (Priority: P1)

As a person opening the application while its service is starting slowly, I want the application to keep trying automatically for longer, so I do not have to press retry for a temporary startup delay.

**Why this priority**: Avoiding unnecessary manual retries directly addresses the reported startup failures.

**Independent Test**: Simulate a temporary startup failure lasting 20 seconds followed by a successful session check, and verify that the application reaches the correct destination without user interaction.

**Acceptance Scenarios**:

1. **Given** the session check encounters a temporary connection or service-unavailable failure, **When** the service becomes available within 30 seconds of startup, **Then** the application continues automatically without requiring a manual retry.
2. **Given** startup is still retrying a temporary failure within the recovery window, **When** the person views the application, **Then** the sign-in screen and blocking loading overlay remain visible without an error requiring action.
3. **Given** the session check confirms an existing signed-in session, **When** startup completes, **Then** the loading overlay closes and the person reaches the same signed-in destination they would normally see.
4. **Given** the session check confirms there is no active session, **When** startup completes, **Then** the loading overlay closes and the person can sign in or create an account normally.

---

### User Story 3 - Recover from a persistent startup failure (Priority: P2)

As a person whose application cannot complete startup, I want a clear error and a way to try again, so I am not left waiting indefinitely.

**Why this priority**: Automatic recovery cannot resolve every outage, and users need a clear next action.

**Independent Test**: Keep the service unavailable beyond the recovery window, verify a visible error and retry action, restore service, and verify a single retry completes startup.

**Acceptance Scenarios**:

1. **Given** temporary failures persist beyond the recovery window, **When** automatic recovery ends, **Then** the loading overlay stops blocking the page and a clear startup error with a retry action is shown.
2. **Given** a startup error is shown, **When** the person selects retry, **Then** a blocking loading overlay reappears within 500 milliseconds while a fresh startup check is attempted.
3. **Given** the service is available when retry is selected, **When** the check finishes, **Then** the person reaches the appropriate signed-in or signed-out destination without reloading the page.
4. **Given** the session check encounters a non-temporary failure, **When** it cannot proceed, **Then** the application shows a clear error and retry action rather than treating the person as signed out.

### Edge Cases

- An unauthenticated result is a normal signed-out state, not a startup error or a reason to keep retrying.
- A request that never completes must not leave the loading overlay open indefinitely; the automatic recovery period remains bounded.
- A connection lost during startup is treated as temporary; if it does not recover within the recovery period, the person receives an error and retry action.
- If service recovery occurs after the recovery window has ended, the person can initiate a fresh check with retry.
- The loading overlay remains usable at narrow viewport sizes and does not allow background interaction or dismissal while a check is active.
- No signed-in or private content is displayed before the session has been confirmed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: During the initial session check and any automatic recovery attempts, the application MUST display the existing sign-in screen beneath a loading overlay and a dimming layer covering the entire viewport.
- **FR-002**: The loading overlay MUST clearly identify that the application is loading and MUST prevent pointer and keyboard interaction with the underlying page until the active check ends.
- **FR-003**: The loading status MUST be announced to assistive technology, background controls MUST be inert, and the loading overlay MUST not be dismissible while startup is active. Non-interactive loading content MUST not receive focus.
- **FR-004**: The application MUST automatically recover from temporary connection and service-unavailable failures for at least 30 seconds from the start of a check, without requiring the person to select retry. It MUST stop automatic recovery and show a failure within 45 seconds if no conclusive result is obtained.
- **FR-005**: When a temporary failure resolves within the first 30 seconds, the application MUST complete startup automatically and show the appropriate destination without a manual retry.
- **FR-006**: A confirmed active session MUST lead to the existing signed-in experience; a confirmed absence of a session MUST make the existing sign-in and account creation experience usable.
- **FR-007**: A persistent or non-temporary startup failure MUST be communicated with a visible, accessible error and a retry action; the application MUST NOT silently treat an unresolved session as signed out.
- **FR-008**: Selecting retry MUST start a fresh bounded startup check, show the blocking loading state within 500 milliseconds, and transition to the appropriate destination or a clear error when the check ends.
- **FR-009**: The sign-in screen, loading overlay, dimming layer, and error state MUST support responsive layouts, keyboard operation, and WCAG 2.2 Level AA.
- **FR-010**: The startup experience MUST support the existing Light, Dark, and System appearance modes without changing their selection or persistence behavior. Before a saved signed-in preference is available, the existing Light default MUST apply.
- **FR-011**: The application MUST NOT display private signed-in content or enable underlying sign-in actions until the session check has resolved.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of tested delayed startup checks, the sign-in screen is visible behind a full-viewport dimmed loading overlay, and background controls cannot be operated until loading ends.
- **SC-002**: In 100% of controlled trials where a temporary startup failure resolves within 30 seconds, the person reaches the correct signed-in or signed-out destination without selecting retry.
- **SC-003**: In 100% of controlled trials with a persistent startup failure or a never-completing check, a visible error and retry action appear within 45 seconds.
- **SC-004**: In 100% of tested retries, loading feedback appears within 500 milliseconds and a restored service leads to the correct destination without a page reload.
- **SC-005**: The loading and error experiences pass automated accessibility checks at 320x812 and 1280x720 in Light, Dark, and System modes, and keyboard and assistive-technology semantics can be verified without operating the background page.

## Assumptions

- Startup means determining the current session when the application is first opened or explicitly retried after a startup error; redesigning other loading states is out of scope.
- Temporary failures include connection failures and temporary service-unavailable responses. Authentication-required responses represent the normal signed-out state; other failures may be reported without automatic recovery.
- The 30-second recovery window and 45-second maximum error presentation are initial acceptance targets for a slow-starting service, not a guarantee against longer outages.
- The existing authentication, sign-in, account creation, signed-in navigation, and account-level theme preference behavior remain unchanged.
- The startup check depends on the existing session service becoming available; an outage beyond the recovery window requires user-initiated retry.
