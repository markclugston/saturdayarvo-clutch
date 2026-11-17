# Feature Specification: Validate Active Transaction Imports

**Feature Branch**: `validate-active-import-on-transactions`

**Created**: 2026-11-17

**Status**: Draft

**Input**: User description: "On the transactions import screen, validate that no import is already active for the account using the existing server validation. Block new imports when one exists. Allow ending the other import only before it is actually importing data, such as during preview. Notify the ended import's session with a blocking modal identifying who ended it; after acknowledgement, return to that account's transactions screen."

## Clarifications

### Session 2026-11-17

- Q: When should an import become protected from being ended by another session? → A: Once confirmation is accepted, the import cannot be ended, including while preparing to write transactions.
- Q: If the competing import finishes or expires while the blocked screen stays open, should that screen become available automatically? → A: Automatically refresh the conflict and enable starting within five seconds when no active import remains, without submitting an import automatically.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Detect a Competing Import Before Starting (Priority: P1)

As an account owner opening the transaction import screen, I want to know whether another session already has an active import, so that I do not prepare a new import that cannot start.

**Why this priority**: Early validation prevents wasted effort while preserving the existing one-active-import-per-account protection.

**Independent Test**: Through automated checks, open the import screen with and without another active import and verify that starting a new import is allowed only when the account is available.

**Acceptance Scenarios**:

1. **Given** no active import for the account, **When** the owner opens its import screen, **Then** validation completes and the normal import workflow becomes available.
2. **Given** another active import for the account, **When** the owner opens its import screen, **Then** the screen explains that an import is already active and prevents starting a new one before a file must be submitted.
3. **Given** validation is pending or unavailable, **When** the owner attempts to start an import, **Then** starting remains blocked, with a visible checking state or an actionable error and retry option.
4. **Given** validation found the account available but another session starts first, **When** this session attempts to start, **Then** the existing conflict protection rejects the attempt and the screen shows the current blocked state.
5. **Given** another account has an active import, **When** the owner opens this account's import screen, **Then** that unrelated import does not block this account.
6. **Given** a connected, foreground screen blocked by a competing import, **When** that import completes, expires, or is cancelled and no active import remains, **Then** the screen automatically enables starting within five seconds without requiring a retry or automatically submitting an import.

---

### User Story 2 - End an Eligible Competing Import (Priority: P2)

As an account owner blocked by an import in another session, I want to end it when it is still awaiting confirmation, so that I can start a replacement without interrupting transaction processing.

**Why this priority**: Safe recovery removes an unnecessary blocker without risking partially imported financial data.

**Independent Test**: Through automated checks, end a competing preview and verify the account becomes available; repeat while the competing import is processing and verify it cannot be ended.

**Acceptance Scenarios**:

1. **Given** the active import is in preview and not importing data, **When** the blocked owner views the conflict, **Then** an explicit action to end that import is offered.
2. **Given** an eligible preview, **When** the owner chooses to end it and the operation succeeds, **Then** that preview can no longer be confirmed and this session can start a new import without leaving the screen.
3. **Given** the other import is actually importing data, **When** the conflict is displayed, **Then** no end-import action is offered and starting another import remains blocked.
4. **Given** an end action was offered but the other import's confirmation is accepted before the request takes effect, **When** ending is attempted, **Then** ending is refused, preparation or processing continues unchanged, and the screen explains the updated conflict.
5. **Given** an end attempt fails, **When** the failure is displayed, **Then** the screen does not claim success or enable starting without successful revalidation.
6. **Given** the targeted preview has ended and a newer import has become active, **When** a stale end action is submitted, **Then** the newer import is not ended and the screen refreshes the conflict.
7. **Given** the other import completes, expires, or is cancelled before an end attempt takes effect, **When** the account is revalidated, **Then** this session can start if no newer active import exists.

---

### User Story 3 - Acknowledge an Import Ended Elsewhere (Priority: P2)

As an account owner reviewing an import that another session ends, I want a blocking explanation identifying the user who ended it, so that I understand why I cannot continue and can return safely to my transactions.

**Why this priority**: The affected session must not misleadingly present an ended preview as usable.

**Independent Test**: With two automated browser sessions for the owner, end one session's preview from the other and verify notification, actor identity, blocked interaction, acknowledgement, and destination.

**Acceptance Scenarios**:

1. **Given** a session displaying a preview, **When** another session ends that import, **Then** the affected session automatically displays a blocking modal stating that its import was ended and identifying the authenticated user who ended it.
2. **Given** that modal is visible, **When** the user attempts to interact with the underlying page or dismiss it without acknowledgement, **Then** the import remains unusable and the modal remains blocking.
3. **Given** the modal is visible, **When** the user acknowledges it, **Then** the modal closes and the user is taken to that account's transactions screen, not the accounts list or another account.
4. **Given** the affected session was disconnected or in the background when its import was ended, **When** it reconnects or becomes active again, **Then** the ended state is checked before import actions become usable and the same notification and acknowledgement flow applies.
5. **Given** an import expires naturally or is cancelled within its own session, **When** that result is handled, **Then** it is not misrepresented as having been ended by another session.
6. **Given** a watched preview has expired or is no longer available without a known external ending, **When** its current state is displayed, **Then** the screen explains that it expired or is unavailable without naming an ending user, disables preview mutations, and offers Return to transactions for that account without trying to cancel the missing preview.

### Edge Cases

- Two sessions simultaneously try to start imports: at most one obtains an active import for the account.
- Confirmation and ending race: exactly one may succeed; an ended preview never imports transactions and an import whose confirmation has been accepted cannot be ended by this feature, even before transaction writing begins.
- Two sessions try to end the same preview: neither may end a replacement import or report an unverified available state.
- An expired or completed import is not treated as an active blocker under the existing validity rules.
- The affected preview is no longer available when its screen checks status: the reason and ending actor must remain available for the ended-session notification.
- Multiple tabs or devices use the same signed-in identity: the notification still identifies that user and makes clear that the import was ended from another session.
- Connection loss during validation or ending leaves a visible failure state; retry must establish the actual current state.
- A different account owner attempts to inspect or end the import: access is denied without exposing import contents or actor details.
- Keyboard, narrow-screen, Light, Dark, and System-theme use must preserve a readable, operable blocking notification.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: On entry to an account's transaction import screen, the system MUST check for an active import before allowing a new import to start, without requiring file submission to discover an existing conflict.
- **FR-002**: The early check MUST use the same authoritative active-import and expiry rules as the existing start-import validation. Existing enforcement MUST remain effective for concurrent or stale sessions.
- **FR-003**: While another import is active, the screen MUST explain the conflict and prevent a new import from starting. Pending or failed validation MUST NOT be interpreted as account availability.
- **FR-004**: The system MUST offer an end-import action only for a competing import that is confirmed eligible to end before confirmation is accepted, including an unconfirmed preview. Once confirmation is accepted, the import MUST be protected from ending throughout preparation and transaction processing. Unknown or protected states MUST NOT offer this action.
- **FR-005**: An end request MUST apply only to the specific import presented to the user and MUST recheck eligibility when taking effect. It MUST NOT end an import whose confirmation has been accepted or a newer replacement import.
- **FR-006**: Successfully ending a preview MUST invalidate further confirmation of that preview, import zero transactions from it, and release its block on new imports. The waiting session MUST revalidate availability before enabling a new start.
- **FR-007**: Ending and confirmation MUST be mutually exclusive outcomes for the same preview. At most one active import per account MUST be permitted across concurrent sessions.
- **FR-008**: A connected, foreground session whose preview was ended elsewhere MUST automatically display a blocking notification within five seconds of successful ending, without requiring a user action.
- **FR-009**: The notification MUST state that the import was ended by another session and show a recognizable user-facing identity for the authenticated user who ended it, including when both sessions belong to the same user.
- **FR-010**: The notification MUST prevent interaction with the import, MUST NOT close through outside click or Escape, and MUST provide an explicit acknowledgement action. Acknowledgement MUST return the user to the ended import's account transactions screen.
- **FR-011**: On reconnection, return from the background, or restoration of an ended preview screen, the system MUST check its current state before enabling import actions and MUST show the same ended-session notification when applicable.
- **FR-012**: The system MUST retain enough information about the externally ended import and its ending actor to support FR-008 through FR-011 even after preview data is removed. Expiry, completion, and same-session cancellation MUST remain distinguishable from ending by another session. A watched preview known to have expired or otherwise become unavailable without a known external ending MUST show a non-attributed explanation, disable preview mutations and offer Return to transactions for that account without requiring cancellation. An unknown terminal reason MUST NOT be invented; a failed status request remains an error with Retry, not an unavailable-preview result.
- **FR-013**: Checks, ending, and notifications MUST preserve existing account-owner authorization. An unrelated user MUST NOT inspect or end another owner's import or receive its notification details. This feature MUST NOT introduce shared account access.
- **FR-014**: Validation and end-operation failures MUST be shown explicitly with a retry path; ambiguous outcomes MUST be revalidated rather than presented as success. User actions MUST receive visible feedback within 500 milliseconds, using a busy state when completion takes longer.
- **FR-015**: Conflict messaging, recovery actions, and notifications MUST support keyboard-only use, responsive layouts, and WCAG 2.2 Level AA. The modal MUST have an accessible name and description, move focus into itself, and contain focus until acknowledgement.
- **FR-016**: The import screen and modal MUST preserve the existing Light, Dark, and System choices, saved per-user selection, and persistence between visits. Light remains the default before a saved preference is available; System follows operating-system appearance changes.
- **FR-017**: Verification MUST include agent-executable automated checks for the three user stories, account isolation, stale end requests, the confirmation/end race, reconnection, actor identity, and modal accessibility. Human testing or participant usability studies MUST NOT be completion gates.
- **FR-018**: While a connected, foreground import screen is blocked by a competing import, the system MUST automatically refresh the conflict and enable starting within five seconds after the account becomes available through completion, expiry, or cancellation. A newer active import MUST keep the screen blocked with its current eligibility shown. Automatic refresh MUST NOT submit a new import; failed refreshes MUST retain the blocked state and expose the retry path required by FR-014.

### Key Entities

- **Financial account**: An account owned by one individual; the boundary for active-import validation.
- **Import attempt**: A particular account import, its current stage, validity, and whether it is eligible to end; an unconfirmed preview is eligible, while an import becomes protected as soon as confirmation is accepted, including preparation before transaction writing.
- **Import-ending outcome**: The specific ended attempt, the fact it was ended from another session, the authenticated ending user, and the time it ended; survives removal of temporary preview data as required for notification.
- **User session**: A tab or device acting as an authenticated owner, either waiting to start or displaying the affected import.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In all automated active-import scenarios, a competing import is identified before file submission is required and zero new imports start while the account is blocked.
- **SC-002**: In all automated eligible-ending scenarios with no newer competing import, the waiting user can start a replacement from the same screen after successful ending and revalidation.
- **SC-003**: In all concurrent start, stale end, and confirmation/end scenarios, there is at most one active import per account, zero imports whose confirmation has been accepted are ended by this feature (including before transaction writing), and zero transactions are imported from an ended preview.
- **SC-004**: In all connected foreground-session checks, the affected user sees a blocking notice naming the ending user within five seconds; one explicit acknowledgement returns them to the correct account's transactions screen.
- **SC-005**: In all reconnection and background-restoration checks, an ended preview cannot be acted on before the notification appears; all checks involving an unrelated account owner deny inspection and ending.
- **SC-006**: All user-initiated validation, retry, and ending actions show a result or busy state within 500 milliseconds. The three journeys pass automated keyboard, focus, accessible-name, narrow-screen, and Light/Dark appearance checks.
- **SC-007**: In all connected foreground waiting-screen checks, completion, expiry, or cancellation of the competing import enables starting within five seconds without user refresh when no active import remains; a replacement active import keeps starting blocked, and automatic refresh submits zero imports.

## Assumptions

- Existing single-person ownership remains unchanged. Competing sessions are tabs or devices belonging to the account owner; naming the ending user does not imply new permission for different people to share financial data.
- Existing authentication supplies a recognizable user-facing identity. The notice identifies the user, not a particular device, and does not require exposing contact information.
- Existing import creation, preview, confirmation, expiry, cancellation, and saved mapping behavior are dependencies and remain unchanged except for the specified conflict and externally ended-session behavior.
- A successful end makes the account available but does not automatically submit a new import or reserve the account for the waiting session; another session may win a subsequent start.
- Automatic notification timing assumes a connected foreground session. A disconnected or background session is checked when connectivity or foreground activity resumes.
- Returning to an ended preview means a screen still identifying that specific attempt; this feature does not introduce import-history browsing or cross-device preview resumption.
- Ending applies only before confirmation is accepted. Stopping or rolling back an import after accepted confirmation, introducing shared access, and redesigning the import workflow are outside scope.
