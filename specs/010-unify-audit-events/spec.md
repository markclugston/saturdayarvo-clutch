# Feature Specification: Unify Audit Events

**Feature Branch**: `not specified`

**Created**: 2026-11-15

**Status**: Draft

**Input**: User description: "Combine TransactionDeletionAudits and ImportAuditEvents into a table called Audit, following the ImportAuditEvents structure. Transaction deletes use EventCode TransactionDelete and a Description that describes the review of the deleted transaction. Do not retain identifiers for the deleted transaction or its review."

## Clarifications

### Session 2026-11-15

- Q: What should the deletion audit Description contain to describe the review after the transaction and review records are gone? → A: Include the transaction's duplicate-detection details when available and always include the account description; store the event date/time in `OccurredAtUtc`, not as a review date in Description, and do not include IDs.
- Q: Where should the human-readable account context for an audit event be stored? → A: Put it in `Description`; do not add a separate `AccountDescription` column.
- Q: Is an account description optional for Audit events? → A: No. Every account always has a nonblank description; include it in each related Audit record's `Description`.
- Q: Is `EventCode` optional? → A: No. Every Audit record must have a nonblank EventCode.
- Q: Which human-readable details should a new transaction-deletion Description include? → A: Include the duplicate-detection fingerprint fields (date, description, amount, and direction) when available, plus the account description; do not include a review outcome or review date, and omit IDs.
- Q: Should each Audit record have its own generated row ID, while excluding only the deleted transaction and review IDs? → A: Give each Audit row its own generated ID; omit TransactionId and ReviewId.
- Q: If consolidation is retried after an interruption, should every source event still appear exactly once in Audit? → A: Require exactly one Audit record per source event, including after a retry.
- Q: If consolidation fails partway through, what must happen before the system can safely retry it? → A: Make consolidation all-or-nothing; preserve source records on failure and allow a safe retry.
- Q: What should happen if an account is deleted while its Audit records still exist? → A: Do not store AccountId in Audit; retain a human-readable account name or description instead.
- Q: Should a transaction-deletion Description include a review outcome or review date? → A: No. `OccurredAtUtc` records the date and time the audit event happened; do not include a review outcome or review date.
- Q: Which transaction details are used to detect duplicates during import? → A: The source code compares transaction date, description, amount, and direction. Include those four values in new deletion descriptions when available, without adding transaction or account identifiers.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Review unified audit history (Priority: P1)

An audit reviewer needs to consult one history for transaction import events and transaction deletions so that activity is not split across separate audit records.

**Why this priority**: Combining both event types in one history is the core requested outcome and makes ongoing review consistent.

**Independent Test**: Confirm an import through the existing API workflow and verify that it appends an Audit record with nonblank EventCode and Description containing the account description, without retaining AccountId or ReviewId. The separate migration integration test verifies historical import and deletion backfill.

**Acceptance Scenarios**:

1. **Given** existing import events and transaction deletion audits, **When** the consolidated history is reviewed, **Then** it contains records for both event types in the Audit record structure.
2. **Given** an existing import event, **When** it is represented in the consolidated history, **Then** its ActingUserId, OccurredAtUtc, and nonblank EventCode are preserved, its account's nonblank human-readable description is included in Description, and AccountId and ReviewId are not retained.
3. **Given** an Audit record has been written, **When** a later change or correction is needed, **Then** the existing record remains unchanged and any additional information is recorded as a new Audit record.
4. **Given** consolidation is retried after an interruption, **When** it completes, **Then** each source event is represented by exactly one Audit record.
5. **Given** consolidation fails before completion, **When** the failure is handled, **Then** no partial consolidation is treated as complete, source records remain available, and a retry can safely produce exactly one Audit record per source event.
6. **Given** an account with existing Audit records is deleted, **When** the account is removed, **Then** its Audit records remain unchanged and retain the human-readable account context in Description.

---

### User Story 2 - Understand a deleted transaction event (Priority: P1)

An audit reviewer needs to understand that a transaction was reviewed and deleted even though the transaction no longer exists.

**Why this priority**: Deletion removes the transaction, so the audit history must retain useful context without depending on identifiers that no longer resolve.

**Independent Test**: Review a TransactionDelete audit record after its source transaction is unavailable; verify the reviewer can identify the deletion, its actor, human-readable account context, and event time without source-record IDs.

**Acceptance Scenarios**:

1. **Given** a transaction is deleted after review, **When** its audit record is written, **Then** EventCode is `TransactionDelete`, ActingUserId and OccurredAtUtc are recorded, and Description explains that the transaction was reviewed and deleted and includes its account's human-readable description.
2. **Given** a TransactionDelete audit record, **When** a reviewer reads it, **Then** its Description includes the transaction date, description, amount, and direction when available, plus the account's nonblank human-readable description; it omits IDs and review outcome/date, while OccurredAtUtc records when the audit event happened.
3. **Given** an older deletion record has no recoverable transaction details, **When** it is represented in the consolidated history, **Then** its Description states that the transaction was reviewed and deleted without inventing transaction details.

### Edge Cases

- Existing import or deletion records must remain represented even if transaction context is unavailable; every related account has a nonblank description that is included in the Audit Description.
- A missing historical transaction must not prevent its deletion audit record from being reviewed.
- If an old deletion record contains only identifiers and event metadata, its description must use generic review-and-deletion wording rather than fabricate details or include identifiers.
- If a historical source account row cannot be resolved, or an import event has a blank EventCode, consolidation must fail atomically and leave all source rows available for a safe retry.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The audit history MUST represent both import events and transaction deletion events as records in one Audit collection.
- **FR-002**: Every Audit record MUST have a nonblank EventCode and a nonblank Description, and MUST use ActingUserId and OccurredAtUtc. Every account MUST have a nonblank human-readable description, which MUST be included in Description. Audit records MUST NOT contain AccountId. Values from DeletedAtUtc MUST map to OccurredAtUtc.
- **FR-003**: Import event records MUST preserve their ActingUserId, OccurredAtUtc, and nonblank EventCode values and include the account's nonblank human-readable description in Description, instead of retaining AccountId.
- **FR-004**: A transaction deletion record MUST use the nonblank EventCode `TransactionDelete`.
- **FR-005**: A transaction deletion record MUST include a nonblank Description that communicates the transaction was reviewed and deleted. When transaction details are available, it MUST include the duplicate-detection fingerprint fields: transaction date, description, amount, and direction. It MUST also include the account's nonblank description, omit IDs, and MUST NOT include a review outcome or review date; `OccurredAtUtc` MUST record when the audit event happened.
- **FR-006**: Audit records MUST have their own generated record identifier and MUST NOT retain TransactionId, ReviewId, or AccountId. ActingUserId MUST remain available as specified in the mapped fields.
- **FR-007**: Consolidation MUST preserve every source import and deletion audit event and its mapped values exactly once, including when consolidation is retried after interruption. An unavailable transaction or review MUST NOT cause the corresponding deletion audit event to be omitted.
- **FR-008**: Once consolidation is complete, the audit history MUST be represented by Audit rather than separate active TransactionDeletionAudits and ImportAuditEvents collections.
- **FR-009**: Audit records MUST be immutable after creation. They MUST NOT be updated or deleted; corrections or subsequent information MUST be recorded as new Audit records without altering existing records.
- **FR-010**: Consolidation MUST be all-or-nothing. If a historical source account row cannot be resolved or an import EventCode is blank, consolidation MUST fail before commit and leave source records available. Retrying after the cause is resolved MUST result in exactly one Audit record per source event.
- **FR-011**: Every account MUST have a nonblank human-readable description, and every related Audit record MUST include that description in Description instead of retaining AccountId, so account deletion does not require updating or deleting Audit records.

### Key Entities *(include if feature involves data)*

- **Audit**: An immutable, append-only record of an import or transaction deletion event, with its own generated record identifier, ActingUserId, required nonblank EventCode, OccurredAtUtc, and required nonblank Description. Description includes the account's required human-readable description. A new transaction deletion Description includes the transaction's date, description, amount, and direction when available, without IDs or review outcomes/dates. `OccurredAtUtc` records when the audit event happened. It has no TransactionId, ReviewId, or AccountId.
- **Transaction deletion event**: An audit event identified by EventCode `TransactionDelete`; its description communicates the review and deletion without depending on removed records.
- **Import event**: An audit event whose actor, occurrence time, and nonblank event code are preserved; its account's nonblank human-readable description is included in Description, and AccountId and ReviewId are not retained.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After consolidation, exactly one Audit record represents each source import and transaction deletion event, including after a retry.
- **SC-002**: 100% of consolidated records preserve the mapped actor and occurrence time, have a nonblank EventCode, include the related account's nonblank description in Description, and do not retain AccountId.
- **SC-003**: 100% of Audit records have a nonblank EventCode and Description; transaction deletion records use `TransactionDelete`, include a description of review and deletion, and contain no TransactionId or ReviewId.
- **SC-004**: Reviewers can determine that a transaction was reviewed and deleted from its audit record without access to the deleted transaction or review in every defined acceptance scenario.
- **SC-005**: 100% of Audit records remain unchanged and undeleted after creation; any corrections or later details appear as additional records.
- **SC-006**: 0% of Audit records retain AccountId; every record includes its account's nonblank human-readable description in Description.
- **SC-007**: In the warmed API and SQL Server integration-test environment, each measured import-confirmation and transaction-deletion request returns within 500 milliseconds in at least five measured requests per action; application startup and one warm-up request per action are excluded.

## Assumptions

- ActingUserId remains a structured audit field. AccountId, TransactionId, and ReviewId are not retained in Audit; every related account description is included in Description.
- Historical deletion records without recoverable transaction details use a generic description such as "Transaction reviewed and deleted"; no unavailable details are inferred.
- EventCode and Description are required and nonblank for every Audit event. Descriptions exclude IDs and review outcomes/dates; they include the related account's required description. New transaction deletion descriptions include the transaction date, description, amount, and direction when available. The event date/time is stored in `OccurredAtUtc`.
- Existing audit retention requirements continue to apply to the unified history.
