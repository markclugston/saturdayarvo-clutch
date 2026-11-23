# Feature Specification: [FEATURE NAME]

**Feature Branch**: `[###-feature-name]`

**Created**: [DATE]

**Status**: Draft

**Input**: User description: "$ARGUMENTS"

<!--
  Clutch override. Be concise: one line per requirement or scenario, no repetition across
  sections. Behaviour already implemented in the code is settled (see docs/code-map.md):
  record it as an assumption, never as NEEDS CLARIFICATION.
-->

## User Scenarios & Testing *(mandatory)*

<!-- Prioritise stories (P1 most critical). Each must be independently testable and deliver value alone. -->

### User Story 1 - [Brief Title] (Priority: P1)

[The journey in 1–3 sentences]

**Why this priority**: [One sentence]

**Independent Test**: [One sentence]

**Acceptance Scenarios**:

1. **Given** [state], **When** [action], **Then** [outcome]

---

[Add more user stories as needed, each with a priority]

### Edge Cases

- [Boundary or error condition → expected behaviour]

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST [capability]

### Key Entities *(include if feature involves data)*

- **[Entity]**: [What it represents, key attributes]

### Constitution Scope

Tick each that applies, so plan can pick requirement IDs without rereading the spec:

- [ ] Stores, changes or deletes data (DOT-002, OPS-001 migrations)
- [ ] Creates or reads audit records (AUD-001)
- [ ] Adds or changes endpoints, auth or input handling (SEC-001, SEC-004)
- [ ] Handles personal, payment or financial data (SEC-003)
- [ ] Changes UI in clutch-web (WEB-001, style guide)

## Success Criteria *(mandatory)*

<!-- Measurable and technology-agnostic. -->

- **SC-001**: [Measurable outcome]

## Assumptions

- [Reasonable defaults chosen where the description was silent]
