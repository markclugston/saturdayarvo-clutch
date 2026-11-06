# Feature Specification: Import Bank Transactions

**Feature Branch**: `main` (no feature branch created)

**Created**: 2026-11-07

**Status**: Draft

**Input**: User description: "Import transactions from bank CSV exports in different formats, with a date, description and amount and clear incoming or outgoing direction. Support multiple accounts, each with a description and a currency such as Australian Dollars (AUD). Prevent entry of account numbers, BSB/account numbers and card numbers."

**Standards note**: Before producing a plan, tasks, or implementation for this feature, read
`standards/README.md` and load every standard whose trigger matches. The plan's Constitution Check
and task/implementation records MUST identify applicable standards by ID and repo-root-relative
path, and state how the work complies. The constitution takes precedence; flag conflicts rather
than silently resolving them.

## Clarifications

### Session 2026-11-07

- Q: How strictly should account descriptions and imported transaction descriptions be checked for possible bank account numbers? → A: Reject standalone 6–10 digit sequences even when unlabelled, in addition to the other specified identifier patterns.
- Q: Who should be able to access an account and its imported transactions? → A: Initially, only the account's Family owner; the earlier per-account sharing decision is superseded by the Family model below.
- Q: What should users who are granted access be allowed to do with a shared account? → A: Member access is outside this feature; the earlier equal-permissions decision is superseded by the Family model below.
- Q: Should the import support a separate column that says whether each amount is incoming or outgoing? → A: Yes; users map its values to incoming and outgoing.
- Q: How should the import interpret amounts when banks use different decimal and thousands separators? → A: Use the account currency's expected format; if an import differs, confirm the account currency and ask for the file's format. If the currency's format is ambiguous, ask how to read it.
- Q: How should overlapping imports and the account's last-import information be handled? → A: Allow only one import per account at a time, ensure the user has an up-to-date transaction list before importing, and show the last imported date on the account information page.
- Q: Should the account's “last imported date” mean when the most recent import completed or the newest transaction date included in that import? → A: Show the completion date and time of the most recent successful import, stored in UTC and displayed using the viewing user's regional settings, with minute-level precision.
- Q: Should the account and import flows meet WCAG 2.2 AA, a widely used accessibility standard, or should the spec require a narrower accessibility target? → A: WCAG 2.2 AA for account and import flows.
- Q: Should this feature have its own availability and recovery targets, or inherit the existing application's service targets? → A: Inherit existing application availability and recovery targets.
- Q: Should transaction dates and amounts also use the viewing user's regional settings, or should regional formatting apply only to the last-import timestamp? → A: Display transaction dates using the viewing user's regional settings; format amounts using the selected account's currency settings.
- Q: Should transaction imports inherit the application's existing rate and file-size limits, or define feature-specific limits? → A: Inherit existing application limits.
- Q: What operational information should the system record about transaction imports without recording account or transaction descriptions or values? → A: Record per-import user and account audit events, but no transaction contents.
- Q: How should account and import flows select and persist their theme? → A: Follow the operating system's light or dark preference, default to that preference, and provide no application-level override or saved theme choice.
- Q: How should transaction-import size and rate limits work when the application has no existing limits? → A: Provide an authenticated administrator settings page to enter shared runtime limits, with defaults of 10 MiB per file, 10,000 transaction rows per import and five import attempts per authenticated user per minute.
- Q: How should Families and account access work? → A: For this feature, an authenticated user can create one Family and becomes its owner; only the owner is supported. Every account belongs to that Family, and its owner can view and edit every account and import its transactions. Invitations, other members, and account-access management are outside this feature. In a future sharing feature, the Family owner will control separate view and edit access per account for each member; a user may belong to multiple Families, and joining another Family will not move existing accounts. The Family owner cannot be removed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create described currency accounts (Priority: P1)

An authenticated user creates one Family as its owner, then creates one or more accounts in that Family with recognizable descriptions and a specified currency, without entering bank or card identifiers.

**Why this priority**: An account and its currency give imported transactions a meaningful, safe destination.

**Independent Test**: Create two accounts with different descriptions and currencies, then check they remain distinguishable and retain their selected currencies.

**Acceptance Scenarios**:

1. **Given** a user has no accounts, **When** they create an account with a non-empty description and select Australian Dollars (AUD), **Then** the account appears with that description and currency.
2. **Given** an existing account, **When** the user creates another with a different description and currency, **Then** both accounts are available separately with their own details.
3. **Given** an account description contains a recognizable bank or card identifier, **When** the user attempts to save it, **Then** the account is not saved and the user is told to remove the sensitive information without the identifier being repeated.
4. **Given** an account exists, **When** the user changes its description to a valid one, **Then** the updated description is shown and its currency and transactions remain unchanged.
5. **Given** a description contains an unlabelled standalone sequence of six to ten digits, **When** the user attempts to save it, **Then** the description is rejected without repeating the sequence.
6. **Given** an authenticated user with no Family, **When** they create a Family, **Then** they become its owner and can create accounts belonging to it.
7. **Given** a user already owns a Family, **When** they attempt to create another, **Then** the request is rejected and the existing Family remains unchanged.
8. **Given** an account in a Family, **When** its owner views or imports transactions or changes its description, **Then** the action is permitted; another user cannot access that Family, account, transactions or import reviews.
9. **Given** an account has a successful import, **When** an authorized user views its account information page, **Then** the page shows the completion date and time of the account's most recent successful import to the minute, displayed using that user's regional settings.

---

### User Story 2 - Import and review transactions (Priority: P1)

A user selects an account and imports a bank-exported CSV, mapping its fields and interpreting dates and amounts so every saved transaction has a clear direction.

**Why this priority**: Reliable transaction import is the main benefit of the feature.

**Independent Test**: Import a representative CSV into an existing account and compare the saved dates, descriptions, amounts and directions with the source.

**Acceptance Scenarios**:

1. **Given** an account and a CSV with date, description and signed amount columns, **When** the user maps the columns, confirms the date format and sign convention, reviews the results and confirms the import, **Then** each transaction is saved to that account with its source date and description, a non-negative amount, and an incoming or outgoing direction matching the confirmed convention.
2. **Given** a CSV with separate incoming and outgoing amount columns, **When** the user maps both columns, confirms the date format, reviews and imports it, **Then** each saved transaction has the direction and magnitude indicated by its positive amount column.
3. **Given** an account containing imported transactions, **When** the user views them, **Then** each shows its date, description, amount, account currency and clearly labeled incoming or outgoing direction.
4. **Given** an import review, **When** the user cancels or leaves without confirming, **Then** no transactions from that import are saved.
5. **Given** a CSV with an invalid, ambiguous or sensitive mapped value, **When** the user reviews the import, **Then** the issue and affected row are identified without displaying sensitive values, and no transaction is saved until the source or mapping is corrected and the entire import passes validation.
6. **Given** a CSV with positive amounts and a separate direction column, **When** the user maps the amount and direction columns, maps distinct direction values to incoming and outgoing, confirms the date format and imports, **Then** each transaction has the mapped direction and the source amount.
7. **Given** an AUD account and an amount formatted as `1,234.56`, **When** the user reviews the import, **Then** the amount is interpreted as one thousand two hundred thirty-four Australian dollars and fifty-six cents.
8. **Given** a file's amount format does not match the account currency's expected format, **When** the user reviews it, **Then** the user is asked to confirm the account currency and, if it is correct, specify the file's amount format before importing.

---

### User Story 3 - Avoid accidental duplicate imports (Priority: P2)

A user is warned when a proposed import may contain transactions already in the selected account or repeated within the file, and can decide whether to continue.

**Why this priority**: Bank exports often cover overlapping periods; warnings help users avoid overstating their finances without discarding legitimate identical transactions.

**Independent Test**: Import a file, prepare the same file again for the same account, and verify that the user can cancel or explicitly confirm importing the flagged transactions.

**Acceptance Scenarios**:

1. **Given** an account already contains a transaction with the same date, description, amount and direction as a proposed transaction, **When** the user reviews the import, **Then** the proposed transaction is flagged as a possible duplicate.
2. **Given** a file contains two transactions with matching date, description, amount and direction, **When** the user reviews the import, **Then** both are flagged as possible duplicates.
3. **Given** possible duplicates are flagged, **When** the user cancels, **Then** nothing is saved; **When** the user explicitly confirms despite the warning, **Then** all valid rows, including flagged rows, are saved.
4. **Given** a matching transaction exists only in another account, **When** the user imports into the selected account, **Then** that other account's transaction does not trigger a duplicate warning.
5. **Given** an import is in progress for an account, **When** the owner attempts another import into that account, including from another session, **Then** the second import is not allowed until the first is complete or canceled, and each allowed import uses an up-to-date transaction list for duplicate checking.

---

### User Story 4 - Configure import limits (Priority: P1)

An authenticated administrator configures shared import file-size, row-count and request-rate limits at runtime; defaults protect the application before custom values are entered.

**Why this priority**: Import limits are required to protect availability, and the application currently has no existing limits for this feature to inherit.

**Independent Test**: Verify the defaults apply, change each limit as an administrator without redeploying, and verify an ordinary user cannot view or change the settings.

**Acceptance Scenarios**:

1. **Given** no administrator has changed the import settings, **When** an authenticated user imports, **Then** the application enforces a 10 MiB file limit, a 10,000-row limit and five import attempts per authenticated user per minute.
2. **Given** an administrator enters valid new limits, **When** the settings are saved, **Then** the new shared limits are persisted and enforced without restarting or redeploying the application.
3. **Given** a non-administrator attempts to view or change import limit settings, **When** the request is made, **Then** access is denied.
4. **Given** an import exceeds a configured limit, **When** it is submitted, **Then** it is rejected before transaction persistence with a clear error that does not disclose sensitive file contents.

---

### Edge Cases

- An empty, unreadable, malformed or non-CSV file, or a file with no transaction rows, is rejected with a helpful message and no saved transactions.
- A file with missing required mappings, empty required values, an invalid date or amount, or an unresolvable date is rejected before confirmation; affected rows or mappings are identified.
- A date that can be interpreted in more than one way is interpreted only using the user's confirmed date format; a value inconsistent with that format is rejected.
- A signed amount of zero is rejected. For separate amount columns, exactly one must contain a positive amount and the other must be empty or zero; otherwise the row is rejected.
- For a separate direction column, the amount must be positive and each row's direction value must match exactly one of the user's distinct incoming and outgoing mappings; otherwise the row is rejected.
- If an account currency has multiple expected amount-format conventions or no single expected convention, the user confirms how the file's amounts should be read before review. If the account currency is wrong, the user must select an account with the correct currency instead of importing to the wrong account.
- Quoted fields, embedded delimiters and line breaks in valid CSV values are treated as part of the relevant field, not as additional columns or transactions.
- A currency indicated in a mapped amount value that conflicts with the selected account currency causes rejection; the import does not perform currency conversion.
- Only one import may be in progress for an account at a time; an import cannot proceed using a stale transaction list.
- Sensitive identifiers in mapped descriptions or account descriptions are rejected without echoing the values. Unmapped columns are not imported, displayed in transaction previews, or retained.
- An ordinary reference consisting of a standalone six-to-ten-digit sequence is also rejected; the user must remove it from the account description or source transaction description before saving or importing.
- Distinct legitimate transactions can have identical details; a possible-duplicate warning is not proof of duplication and does not automatically remove rows.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow a Family owner to create multiple accounts in their Family, each with a required, non-blank description and a required currency selected at creation.
- **FR-002**: The currency selector MUST present standard currency names with their three-letter codes, for example "Australian Dollars (AUD)", and save the selected currency with the account.
- **FR-003**: The system MUST display each account's description and currency and allow its description to be edited subject to the same validation as account creation.
- **FR-004**: An account's currency MUST remain unchanged after creation; changing a description MUST NOT change its currency or transactions.
- **FR-005**: The user MUST select the destination account and a local CSV file before importing transactions; an import MUST affect only the selected account.
- **FR-006**: The system MUST allow users to map source columns to transaction date and description and choose one of: one signed amount column; separate incoming and outgoing amount columns; or one positive amount column and a separate direction column. Mapping MUST work regardless of source column order or header names.
- **FR-007**: The system MUST require the user to confirm the date format and, for signed amounts, which sign represents incoming transactions; the opposite sign represents outgoing transactions.
- **FR-008**: Each saved transaction MUST contain the source transaction date and description, a non-negative monetary magnitude, an incoming or outgoing direction, and its association with the selected account and its currency.
- **FR-009**: The system MUST display each saved transaction's date, description, amount, account currency and explicit incoming or outgoing direction. Transaction dates MUST use the viewing user's regional settings; transaction amounts MUST use the selected account currency's display format.
- **FR-010**: Before confirmation, the system MUST provide an import review showing the destination account, currency, number of rows to import, and interpreted date, description, amount and direction for each valid row.
- **FR-011**: The system MUST validate the entire import before saving: invalid or missing required values, malformed files, inconsistent amount direction, conflicting currency indicators and dates inconsistent with the confirmed format MUST prevent the entire import and produce actionable errors identifying affected rows or mappings. Signed amounts MUST be non-zero; for separate amount columns, exactly one MUST contain a positive amount and the other MUST be empty or zero. For a separate direction column, amounts MUST be positive and every direction value MUST match exactly one of the user's distinct incoming and outgoing mappings.
- **FR-012**: The system MUST save no transaction until the user explicitly confirms a valid import; cancellation or validation failure MUST leave the account's existing transactions unchanged.
- **FR-013**: In account descriptions and imported transaction descriptions, the system MUST reject recognizable bank account numbers, BSBs, combined BSB/account numbers and card numbers, including identifiers separated by spaces or punctuation. Validation MUST be enforced on every save, not solely in the user interface.
- **FR-014**: At minimum, recognizable identifiers MUST include standalone sequences of six to ten digits, whether labelled or not, including sequences separated by spaces or punctuation; BSBs in six-digit or `NNN-NNN` form; and card numbers of 13 to 19 digits, with optional spaces or hyphens, when labelled as card numbers or passing the Luhn check. A standalone sequence is not part of a longer digit sequence, including one separated by spaces or punctuation. A rejected value MUST NOT be saved, echoed in an error or review, or recorded in diagnostics.
- **FR-015**: The system MUST validate mapped transaction descriptions before displaying them in a review or saving them; it MUST ignore unmapped source columns and MUST NOT retain the original uploaded file after processing.
- **FR-016**: The system MUST flag possible duplicates using exact matching on date, description, amount and direction against transactions in the selected account and other rows in the same import.
- **FR-017**: The review MUST identify possible duplicates and require explicit confirmation to import them; cancellation MUST leave all rows unsaved and confirmation MUST import all valid rows, including flagged rows.
- **FR-018**: The system MUST interpret amounts in the selected account's currency and MUST NOT convert currencies during import.
- **FR-019**: The system MUST restrict Family, account, transaction and import-review access to the authenticated owner of the account's Family. That owner MUST be able to view accounts and transactions, import transactions, and edit account descriptions. Other users MUST NOT access them. Family member invitations and per-account access grants are outside this feature.
- **FR-020**: For an import using a separate direction column, the system MUST require the user to map distinct source values to incoming and outgoing before review.
- **FR-021**: The system MUST use a version-controlled application currency-format registry, keyed by ISO 4217 currency code, to interpret imported values. The registry MUST define the expected grouping and decimal separators and whether the currency has one or multiple expected conventions; its entries MUST record their reference and version. For AUD, the default convention is a comma grouping separator and a period decimal separator. The system MUST strictly validate values against the selected convention and MUST NOT infer import separators from display locale settings. If the registry lists multiple conventions, or a value is valid under more than one convention, the user MUST choose the file's amount format before review.
- **FR-022**: If imported values do not conform to the selected account currency's registered expected format, the system MUST ask the user to confirm the account currency. If the currency is correct, the user MUST select the file's amount format from the supported registry conventions and values MUST be validated against it; if it is incorrect, the import MUST NOT proceed into that account and the user may select an account with the correct currency.
- **FR-023**: The system MUST acquire a database-coordinated per-account import lease before creating an import review and allow no more than one active import per account at a time. Duplicate checking MUST use the account's latest committed transactions when preparing the review and MUST be repeated against current state before confirmation; a stale transaction snapshot MUST NOT be used to proceed.
- **FR-024**: The account information page MUST display the completion date and time of the account's most recent successful import, with minute-level precision. The system MUST store this timestamp in UTC and display it using the viewing user's regional settings.
- **FR-025**: Transaction dates MUST be formatted using the viewing user's regional settings, and transaction amounts MUST be formatted using the selected account currency's display settings.
- **FR-026**: Transaction imports MUST be subject to the application's shared rate, file-size and row-count limits and corresponding limit-exceeded behavior.
- **FR-027**: The system MUST record an audit event for each import, identifying the acting user, account, time and outcome. Audit events MUST NOT contain account or transaction descriptions, transaction values, or rejected sensitive identifiers.
- **FR-028**: Account and import flows MUST follow the operating system's light or dark color-scheme preference, update when that preference changes, and MUST NOT provide or persist an application-level theme override.
- **FR-029**: The system MUST provide an authenticated administrator interface to set shared import file-size, maximum-row-count and per-authenticated-user import-attempt rate limits at runtime. Until changed by an administrator, the system MUST enforce defaults of 10 MiB per file, 10,000 transaction rows per import and five import attempts per user per minute. Valid changes MUST persist and take effect without redeployment. Non-administrators MUST NOT view or change these settings.
- **FR-030**: The system MUST allow an authenticated user to create one Family, make that user its owner, and reject attempts by that user to create another Family. An account MUST belong to that owner's Family; the Family owner MUST have non-revocable access to all accounts in that Family.

### Key Entities

- **Family**: A grouping owned by its creator and containing that owner's accounts. Only the owner is supported in this feature.
- **Account**: A transaction destination belonging to one Family, with a description, a currency name and code, its own transactions, and the UTC timestamp of its most recent successful import.
- **Transaction**: An entry belonging to one account, with a date, description, non-negative amount and incoming or outgoing direction, denominated in the account's currency.
- **Import review**: A temporary representation of a selected file's mapped and validated rows, including errors and possible-duplicate warnings, awaiting confirmation or cancellation.
- **Currency**: A standard currency identified by its name and three-letter code.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of participants in a usability test can create two differently described accounts with different currencies within three minutes without assistance.
- **SC-002**: At least 90% of participants can map, review and import a valid 100-row bank CSV into the intended account within five minutes without assistance.
- **SC-003**: In acceptance tests covering signed amounts, separate incoming/outgoing amounts and separate direction-column formats, 100% of imported rows retain the expected date, description, magnitude, direction and account currency.
- **SC-004**: In a test set covering every identifier pattern in FR-014, 100% of affected descriptions are rejected without saving or revealing the identifier in the review, errors or diagnostics.
- **SC-005**: In acceptance tests, 100% of invalid or cancelled imports leave existing transactions unchanged, and 100% of matching rows described in FR-016 are flagged before confirmation.
- **SC-006**: At least 90% of usability-test participants correctly identify incoming versus outgoing transactions in the transaction view without assistance.
- **SC-007**: All account and import flows meet WCAG 2.2 AA conformance criteria.
- **SC-008**: In acceptance tests across differing user regional settings and account currencies, 100% of transaction dates and amounts are displayed using the specified regional and account-currency formats respectively.

## Assumptions

- Users export their own CSV files from their banks; direct bank connections, automatic synchronization and file formats other than CSV are outside this feature.
- Users know the appropriate date format and, for signed amounts, the bank's sign convention. A file represents transactions for one selected account and its currency.
- Standard currency names and codes are provided by a maintained currency reference; selecting a currency does not perform exchange-rate conversion.
- A maintained currency-format reference provides expected amount conventions and identifies currencies without a single convention; currency and formatting conventions are distinct, and the user resolves cases without a unique convention.
- Financial identifier detection is necessarily pattern-based: unlabelled account numbers can be indistinguishable from ordinary references, so the chosen rule deliberately rejects some legitimate descriptions. FR-014 defines the minimum detectable set rather than a guarantee that every possible account number is recognizable.
- Importing only mapped fields avoids retaining unrelated bank-export columns; users remain responsible for choosing appropriate source columns and reviewing their transactions.
- Authentication is required. Family invitations, additional Family members, member access grants, belonging to multiple Families, account deletion, currency changes, transaction editing and automatic duplicate removal are outside this feature. A future sharing feature is intended to give the owner separate view and edit grants per account and allow users to join multiple Families without moving existing accounts; it is not implemented here.
- The feature inherits the existing application's availability and recovery targets; it introduces no separate service-level commitment.
- Import limits are shared application settings managed at runtime by an authenticated administrator; the configured defaults apply until changed.
- Import audit events record the actor, account, time and outcome without transaction contents or sensitive identifiers.
