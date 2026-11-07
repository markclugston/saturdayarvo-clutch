# Feature Specification: Save Account Import Settings

**Feature Branch**: `main` (current branch; no branch created)

**Created**: 2026-11-08

**Status**: Draft

**Input**: User description: Save transaction CSV import settings per account after a successful import, use them by default for subsequent imports, and let users view and change them without showing the settings screen by default.

**Constitution note**: `.specify/memory/constitution.md` is the authoritative source for project
requirements. Plans and task/implementation records MUST identify applicable requirement IDs and
principles from its Requirement Applicability Index, cite the constitution, and state how the work
complies. Flag conflicts rather than silently resolving them.

## Clarifications

### Session 2026-11-08

- Q: If two imports for the same account succeed using different settings, which import should determine the saved defaults? → A: The most recently completed successful import determines the defaults.
- Q: Should an account’s saved import settings be available when that account is used on another device, or only on the device where they were saved? → A: Available across devices for the same account.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reuse settings for an account (Priority: P1)

An account owner imports a bank CSV once using the existing configuration flow. On later imports into the same account, the saved settings are applied automatically so the owner can proceed without re-entering them.

**Why this priority**: Avoiding repeated setup for the same bank export is the central benefit.

**Independent Test**: Successfully import a representative CSV into an account without saved settings, then start a second import for that account and verify the saved configuration is used without displaying the configuration screen.

**Acceptance Scenarios**:

1. **Given** an account has no saved import settings, **When** the user starts a CSV import, **Then** the existing settings entry flow is available and the user supplies the settings needed for that file.
2. **Given** the user successfully completes an import, **When** they later start another import for the same account, including in a new session, **Then** the settings used for the successful import are applied by default.
3. **Given** an account has saved settings, **When** the user starts an import, **Then** the import screen says it is using default settings and offers a button to view and enter new settings, without displaying the settings entry screen by default.
4. **Given** saved settings are applied to a compatible file, **When** the user proceeds, **Then** the existing transaction validation, review, duplicate warnings and confirmation remain in effect before transactions are saved.
5. **Given** accounts A and B have different saved settings, **When** the user starts an import for either account, **Then** only that account's settings are applied.
6. **Given** an account has saved import settings, **When** the user starts an import for that account on another device, **Then** the saved settings are applied by default.

---

### User Story 2 - View and change saved settings (Priority: P1)

When a bank changes its export format or the user needs to use a different file layout, the user opens the settings screen, inspects the current settings and changes them for the import.

**Why this priority**: Automatic defaults must not prevent the user from correcting or changing the import configuration.

**Independent Test**: Start an import with saved settings, open the settings screen, change a mapping or format, successfully import a compatible file, and verify the changed setting is the default for the next import.

**Acceptance Scenarios**:

1. **Given** an account has saved settings, **When** the user selects the button to view and enter new settings, **Then** the settings screen shows the current values and allows them to be changed.
2. **Given** the user changes settings, **When** the import succeeds, **Then** the settings actually used replace that account's previous defaults for subsequent imports.
3. **Given** the user changes settings, **When** they cancel, leave, or the import fails before successful completion, **Then** the previously saved defaults remain unchanged.
4. **Given** saved settings cannot be applied or validated against the selected file, **When** the user proceeds with the import, **Then** an accessible message identifies that the settings need attention and provides an action to open and correct them; invalid transactions are not imported.

---

### User Story 3 - Keep settings safely associated with the account (Priority: P2)

The user expects settings to remain available for the correct account without exposing or retaining transaction contents as part of the settings.

**Why this priority**: Correct account isolation and a clear outcome when saving fails protect trust in recurring imports.

**Independent Test**: Import to two accounts with different settings, verify each account retains its own defaults, and verify an unsuccessful settings save is communicated without suggesting that defaults were saved.

**Acceptance Scenarios**:

1. **Given** a successful import to one account, **When** a user starts an import to a different account without saved settings, **Then** that account uses the existing settings entry flow rather than the first account's settings.
2. **Given** an import succeeds but its settings cannot be saved, **When** the outcome is presented, **Then** an accessible notification distinguishes successful transaction import from defaults-save failure, states that defaults were not saved, and any previously saved defaults remain unchanged.
3. **Given** a user lacks permission to import to an account, **When** they attempt to view or change its import settings, **Then** access is denied under the existing account access rules.

### Edge Cases

- A saved column selection no longer exists in a later file: identify the mapping problem and allow the user to adjust settings before proceeding.
- A file has a changed layout that still passes validation: the user can inspect and change settings, and the existing review remains available to detect incorrect interpretation before confirmation.
- A saved date, amount or direction convention does not match the file: retain existing validation and correction requirements; do not silently substitute a different convention.
- An import is canceled, rejected, or fails after settings are changed: do not create or replace saved defaults.
- A file is rejected or an import is canceled when no defaults exist: the account still has no saved defaults.
- An existing account has no saved settings when the feature becomes available: use the existing settings entry flow until a successful import saves defaults.
- If saved settings cannot be retrieved, show an accessible notification that retrieval failed and offer the existing settings entry flow rather than claiming defaults are in use.
- If transaction import succeeds but saving settings fails, report these outcomes separately and retain any previous defaults.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST save the settings actually used by a successful transaction CSV import as the defaults for its selected account.
- **FR-002**: The saved settings MUST include all user-selected import configuration needed to interpret subsequent files, including column mappings, date and amount formats, amount layout, and applicable direction or sign conventions. The complete configuration used for an import MUST be saved and restored together.
- **FR-003**: The system MUST retain one current set of default import settings per account across sessions and devices; accounts without a successful import using this feature start without defaults.
- **FR-004**: When an import starts for an account with saved defaults, the system MUST apply those defaults and indicate that default settings are being used, without showing the settings entry screen by default.
- **FR-005**: When defaults are in use, the import screen MUST provide a button to view the current settings and enter changes before proceeding.
- **FR-006**: The settings screen opened from saved defaults MUST show the current values and allow the user to change the settings supported by the existing import flow.
- **FR-007**: When an account has no saved defaults, the system MUST use the existing settings entry flow.
- **FR-008**: A successful import with changed settings MUST replace only the selected account's saved defaults with the settings used for that import; if multiple imports to the same account succeed, the import whose transaction-confirmation database commit occurs last MUST determine the defaults. The confirmation commit is the completion-ordering point, even if the separate defaults write finishes later.
- **FR-009**: Cancellation, abandonment, rejection, or failure before successful import completion MUST NOT create or modify saved defaults.
- **FR-010**: The system MUST apply settings only to the account to which they belong and enforce the existing account authorization rules when viewing or changing them.
- **FR-011**: Saved defaults MUST NOT bypass existing file and transaction validation, import review, duplicate warnings, confirmation, or import concurrency rules.
- **FR-012**: If saved settings cannot be applied or validated against a file, the system MUST show an accessible message identifying the settings problem and provide an action to open and correct settings before proceeding; it MUST NOT import invalid transactions.
- **FR-013**: If saved settings cannot be retrieved, the system MUST show an accessible notification that retrieval failed and offer the existing settings entry flow without claiming that defaults are being used.
- **FR-014**: If a successful import's settings cannot be saved, the system MUST show an accessible notification distinguishing successful transaction import from failure to save defaults, state that defaults were not saved, and leave any previous defaults unchanged.
- **FR-015**: Saved settings MUST contain configuration only, not imported transaction rows, transaction descriptions or values, unmapped file contents, or account and card identifiers.
- **FR-016**: The import flow and settings controls added or changed by this feature MUST support keyboard-only operation, responsive layouts, and the system light and dark themes, and MUST conform to WCAG 2.2 Level AA.

### Key Entities

- **Account**: The destination for imported transactions and owner of at most one current set of default import settings.
- **Import settings**: The account-associated configuration for interpreting a CSV, including field mappings, formats and direction conventions; replaced by settings used in the latest successful import.
- **Import**: An account-specific attempt to validate, review and confirm transactions from a selected CSV, using either saved or user-entered settings.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance tests, 100% of successful imports save the settings used as defaults for the selected account, unless a settings-save failure is explicitly reported.
- **SC-002**: In acceptance tests, 100% of later imports for accounts with retrievable defaults show the default-settings notice and change button without initially showing the settings entry screen.
- **SC-003**: In acceptance tests covering first imports, reuse, changed settings, cancellation, separate accounts and use on another device, 100% of cases use the expected account-specific settings.
- **SC-005**: In acceptance tests, 100% of incompatible settings, retrieval failures and save failures produce a clear user-visible outcome without silently claiming defaults were used or saved.
- **SC-006**: In acceptance tests, 100% of changed import-flow controls and failure notifications are operable and perceivable by keyboard, render in both system themes and supported responsive layouts, and meet WCAG 2.2 Level AA.

## Assumptions

- A successful import means the user confirmed the import and its transactions were saved under the existing import rules; merely reaching review is not success.
- The latest successful import determines the account's single set of defaults, whether settings were reused unchanged or edited.
- The existing import flow remains responsible for file selection, interpretation, validation, review, duplicate handling, confirmation and account access.
- Users remain responsible for reviewing interpreted transactions, because a changed file layout can sometimes be structurally valid but semantically different.
- This feature preserves the existing theme behavior: follow the operating-system light/dark preference, with no application override or theme persistence.
- This feature covers CSV transaction imports only; named profiles, sharing defaults across accounts, automatic bank connections and a separate settings-management page are outside scope.
