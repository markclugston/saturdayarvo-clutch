# Feature Specification: Single-Person Data Access

**Feature Branch**: `agents/remove-multi-user-support`

**Created**: 2026-11-10

**Status**: Draft

**Input**: User description: "currently there is a requirement to support multiple people with access to the same accounts, etc. remove that requirement and any code that is in place to support it. this application will only ever support single person access to user data."

## Clarifications

### Session 2026-11-10

- Q: How should existing account ownership be preserved when the obsolete grouping is removed? → A: Preserve each account's current designated owner and do not add membership or shared access. Retain any account without a resolvable owner but keep it inaccessible until ownership is resolved.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Access Personal Data (Priority: P1)

As an individual using the application, I want my financial accounts and associated transaction and import data to be accessible only to me, so that another person cannot view or change that data.

**Why this priority**: Single-person access is the defining product constraint and the primary reason for this change.

**Independent Test**: Sign in as two individual users with separate financial data, then verify each can access their own data and cannot view or change the other's data.

**Acceptance Scenarios**:

1. **Given** an individual with financial accounts and associated transaction or import data, **When** they access the application, **Then** they can view and manage their own data.
2. **Given** financial data belonging to one individual, **When** a different individual attempts to access or change it, **Then** that individual is denied access and the data remains unchanged.
3. **Given** an individual using the application on more than one device, **When** they access their account from either device, **Then** both sessions represent the same individual and do not grant another person access.
4. **Given** an individual with a saved theme preference, **When** they enter the application without the Family setup flow, **Then** their saved theme preference and the existing theme choices remain available.

---

### User Story 2 - Manage Multiple Personal Accounts (Priority: P2)

As an individual with multiple financial accounts, I want to manage them under my own access, so that supporting multiple accounts does not require sharing my data with another person.

**Why this priority**: Removing access sharing must not prevent an individual from using multiple accounts of their own.

**Independent Test**: Use one individual account to access and manage more than one financial account, and verify another individual cannot access those accounts or their related data.

**Acceptance Scenarios**:

1. **Given** one individual with multiple financial accounts, **When** they use the application, **Then** they can access the accounts and related data associated with their own identity.
2. **Given** those financial accounts and related data, **When** another individual uses the application, **Then** they cannot access them through a shared membership or invitation.

---

### User Story 3 - Preserve Data When the Grouping Is Removed (Priority: P2)

As an individual whose financial data is already in the application, I want the removal of its obsolete grouping to preserve my data and ownership, so that the structural change does not erase or expose my information.

**Why this priority**: Removing an unnecessary grouping must not cause loss of the data or change who is authorized to access it.

**Independent Test**: Migrate existing one-owner account data and verify the designated owner retains access, related records remain intact, and no other individual gains access.

**Acceptance Scenarios**:

1. **Given** an existing account associated with a one-owner Family, **When** the obsolete grouping is removed, **Then** the current owner retains access and account-linked data remains intact.
2. **Given** an existing account whose Family owner reference does not resolve to an Identity user in an inconsistent legacy database, **When** the obsolete grouping is removed, **Then** the account and its data are retained without an assigned owner and remain inaccessible until an authorized out-of-band data repair resolves its owner; after repair, only that owner can access it.

### Edge Cases

- An individual has more than one financial account; all remain manageable by that individual without inviting another person.
- A person attempts to use a former sharing or invitation path; it does not grant access to another person's data.
- An existing account references a Family whose owner identifier does not resolve to an Identity user in an inconsistent legacy database; it and its related data are retained but remain inaccessible until an authorized out-of-band data repair resolves ownership. No user-facing owner-resolution workflow is introduced by this feature.
- Two different individuals use the same device; each can access only data belonging to their own identity.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: For this feature, the application MUST treat financial accounts and their associated transaction and import data as personal user data with one authorized individual owner.
- **FR-002**: An individual MUST be able to view and manage their own financial accounts and associated transaction and import data, and MUST NOT be able to view or change another individual's data.
- **FR-003**: The application MUST NOT provide a way to invite another individual, grant them access, or manage shared access to financial accounts or their associated data.
- **FR-004**: An individual MUST be able to manage multiple financial accounts under their own identity without granting another person access.
- **FR-005**: When the obsolete Family grouping is removed, the individual designated as each account's owner MUST retain access and account-linked data MUST NOT be deleted or reassigned.
- **FR-006**: An existing account whose Family owner identifier does not resolve to an Identity user MUST be retained with its associated data, migrated with no assigned owner, and remain inaccessible until an authorized out-of-band data repair resolves its owner; after repair, only that owner may access it. This feature MUST NOT add a user-facing owner-resolution workflow.
- **FR-007**: Removing the Family grouping MUST NOT prevent an individual from accessing their own financial data from multiple devices or sessions.
- **FR-008**: Removing the Family setup flow MUST NOT change theme behavior: the available choices remain Light, Dark, and System; Light is the default while a saved preference is loading; a signed-in individual's saved selection persists; and System follows the operating system's color-scheme changes.

### Key Entities

- **Individual**: A single person who uses the application and is the sole authorized owner of their user data.
- **User data in scope**: Financial accounts and associated transaction and import data. Authentication identities and unrelated user preferences are not changed by this feature.
- **Financial account**: An account an individual manages through the application; an individual may have more than one.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In all access-verification scenarios, the owner can access their data and a different individual cannot view or change it.
- **SC-002**: The application provides zero supported flows for inviting another person or granting another person access to financial user data.
- **SC-003**: All existing accounts with a resolvable owner and their associated data remain available to that owner after the Family grouping is removed; no account or associated data is deleted or reassigned solely due to the change.
- **SC-004**: Individuals can create multiple accounts. For any account they own, they can list, read, and update its description; read transaction pages; retrieve import settings; create import reviews from CSV files; and confirm or cancel import reviews, without granting another person access.

## Assumptions

- "Single-person access" limits who can access a person's data; it does not limit that person to one financial account, device, or session.
- Existing user authentication remains available for individuals to access their own data.
- Each existing Family has one designated owner; its accounts retain that same owner when the Family grouping is removed. No membership or shared-access records currently exist to migrate. If an inconsistent legacy database contains a Family owner identifier that does not resolve to an Identity user, its accounts are preserved without an assigned owner and remain inaccessible until an authorized out-of-band data repair resolves ownership. This feature adds no user-facing resolution workflow.
