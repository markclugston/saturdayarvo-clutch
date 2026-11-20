# Feature Specification: Mortgages Screen

**Feature Branch**: `016-mortgage-tracking`

**Created**: 2026-11-21

**Status**: Accepted

**Input**: User description: "Create a new nav tab 'Mortgages' above Categories. The page has a Loan details group (separate group like the add panel on Categories; Name, Starting Balance, Number of Periods, and multiple Interest Rate Changes of New Interest Rate and Effective Date; all saved; multiple mortgages), an Amortization Schedule group on the right (Period 1 to number of periods + 1, Date, Bank Schedule; display only, calculated from Loan details later), and a Burn Down chart fed from the schedule (like the attached Mortgage Burndown chart). Multiple mortgages are shown as tabs across the top under the header panel, labelled with the mortgage name. This spec covers screen layout and behaviour; calculations come later."

## Clarifications

### Session 2026-11-21

- Q: Is the Amortization Schedule user-entered? → A: No. It is display only, calculated later from Loan details.
- Q: Should deleting a mortgage be part of this feature? → A: Yes, with a confirmation prompt.
- Q: Which series does the Burn Down chart show? → A: Bank schedule only; Rapid repay series come in a later feature.
- Q: Where do repayment dates come from? → A: Add "First repayment date" and "Repayment frequency" (weekly, fortnightly or monthly) to Loan details.
- Q: Limits and auditing → A: No maximum Number of periods (Starting balance has an upper limit, set out below, so it is stored and shown exactly); interest rates allow up to 2 decimal places; mortgage changes are audited.
- Q: How many mortgages and interest rate changes can one user save? → A: Up to 20 mortgages per user and up to 60 interest rate changes per mortgage.
- Q: What happens when two saves of the same mortgage clash? → A: The later save is refused if the mortgage changed since it was opened; the user is told to reload and their entered values are kept.
- Q: Which dates are accepted for First repayment date and Effective date? → A: First repayment date is any valid storable date that is not in the future. Each Effective date must fall between the First repayment date and the final repayment date (First repayment date plus Number of periods − 1 frequency steps; e.g. 1 Jan 2000, 360 monthly periods → 1 Dec 2029). Interest rate changes can't be added until First repayment date, Number of periods and Repayment frequency are valid.
- Q: What happens when Number of periods would put the final repayment date after the latest storable date (31 Dec 9999)? → A: The save is refused and Number of periods is flagged with "The final repayment date would be later than 31 Dec 9999".
- Q: Do names differing only in letter case or leading/trailing spaces count as the same name? → A: Yes. Names are trimmed of leading and trailing spaces before saving and compared ignoring case for uniqueness.
- Q: What do the Amortization Schedule and Burn Down groups show while a new, unsaved mortgage is being entered? → A: Both groups are shown at their full screen allocation, each displaying the message "Please enter your mortgage details".
- Q: How is the loan's opening interest rate entered? → A: As an interest rate change effective on the loan's start date (the First repayment date). Saving requires at least one interest rate change, and the earliest must be effective on the First repayment date.
- Q: What does the screen show while saved mortgages are loading? → A: A progress indicator like the sign-in screen's: the same spinning circle icon with the text "Loading...".
- Q: What does the screen show if loading the saved mortgages fails? → A: A generic error message (no error details, per OWASP) with a Retry button replaces the tab strip and groups; no Loan details form is offered until a load succeeds.
- Q: What does the "Add mortgage" tab do once the user has 20 saved mortgages? → A: It stays visible but disabled, explaining "You can save up to 20 mortgages" on hover and to assistive technology; the save is still refused as a safety net.
- Q: Which buttons does the Loan details group have? → A: Save and Cancel. Cancel discards unsaved edits and restores the saved values (on a new mortgage, it clears the form). There is no Delete button in the group; a whole mortgage is deleted with a trash icon on its tab.
- Q: How is a successful save confirmed? → A: A toast pop-up ("Mortgage saved") in an out-of-the-way corner that still draws attention, announced to assistive technology and dismissing itself.
- Q: When must the user be warned about losing unsaved changes, and may edits be kept automatically? → A: A modal prompt appears in every case where unsaved changes could be lost (switching tabs, other navigation, signing out, an expired sign-in); refreshing or closing the browser shows the browser's own leave-page confirmation, as browsers allow no custom dialog there. Nothing is saved, drafted or restored unless the user chooses Save.
- Q: How does the user get the latest version after a save is refused because the mortgage changed elsewhere? → A: The conflict message has a "Reload" button. It shows the discard-or-stay modal, then replaces the form with the latest saved version, or shows the first tab if the mortgage was deleted elsewhere.
- Q: Which tab is selected after a mortgage is deleted? → A: Always the first mortgage tab, or the empty "Add mortgage" state if none remain.
- Q: How are First repayment date and Effective date entered? → A: With the browser's built-in date field (typed or picked from its calendar), shown in the user's local format; dates in messages read like "1 Jan 2000".
- Q: Is there any upper limit on Starting balance? → A: Up to 999,999,999,999.99, so it is stored and shown exactly; larger values are refused with "Enter a starting balance up to 999,999,999,999.99".
- Q: What happens when a mortgage request is rejected because the sign-in expired? → A: With unsaved Loan details changes, the session-expired modal is shown (FR-026). Otherwise, including while loading, the user is returned to the sign-in screen as on any expired session, with no prompt.

<!--
  Scope: layout, data entry, saving and screen behaviour. Amortization and burn-down calculations
  are a later feature; this one shows their structure with placeholder values.
-->

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open the Mortgages screen (Priority: P1)

As a signed-in user, I select "Mortgages" in the left navigation to open a screen dedicated to my mortgages.

**Why this priority**: Every other story happens on this screen.

**Independent Test**: Select Mortgages in the navigation and confirm the screen, its tab strip and its three groups appear.

**Acceptance Scenarios**:

1. **Given** the left navigation, **When** the user views it, **Then** a "Mortgages" destination appears directly above "Categories", with the same look and behaviour as the other destinations.
2. **Given** any screen, **When** the user selects Mortgages, **Then** the Mortgages screen opens and Mortgages is shown as the current destination.
3. **Given** the user's mortgages are still loading, **When** the Mortgages screen opens, **Then** a spinning circle icon like the sign-in screen's is shown with the text "Loading..." until loading finishes.
4. **Given** the Mortgages screen, **When** it has loaded, **Then** it shows, below the header panel, the mortgage tab strip, then the Loan details group, then the Burn Down chart and the Amortization Schedule group side by side, with the schedule on the right.

---

### User Story 2 - Add and save a mortgage (Priority: P1)

As a signed-in user, I enter a mortgage's loan details, including any interest rate changes, and save them so they are there next time.

**Why this priority**: Saved loan details are the input to everything the screen shows.

**Independent Test**: Add a mortgage with two interest rate changes, save, reload the app and confirm the values and its tab are still there.

**Acceptance Scenarios**:

1. **Given** no saved mortgages, **When** the user opens the screen, **Then** an empty Loan details group is ready for a first mortgage, and the Burn Down and Amortization Schedule groups are shown at their full screen allocation, each displaying "Please enter your mortgage details".
2. **Given** the tab strip, **When** the user selects "Add mortgage", **Then** an empty Loan details group is shown for a new mortgage, and the Burn Down and Amortization Schedule groups are shown at their full screen allocation, each displaying "Please enter your mortgage details" until the mortgage is saved.
3. **Given** the Loan details group, **When** the user enters Name, Starting balance, Number of periods, First repayment date and Repayment frequency, adds an interest rate change effective on the First repayment date (the opening rate), and saves, **Then** the mortgage is saved, a "Mortgage saved" toast appears and a tab labelled with its name appears and is selected.
4. **Given** First repayment date, Number of periods or Repayment frequency is missing or invalid, **When** the user views the Interest rate changes section, **Then** adding a row is unavailable and a hint explains that those three fields are needed first.
5. **Given** the Interest rate changes section, **When** the user adds a row, **Then** a new row with New interest rate and Effective date inputs appears; the user can add as many rows as needed and remove any row before saving.
6. **Given** interest rate changes are entered in any order, **When** the mortgage is saved and reopened, **Then** they are listed in effective-date order.
7. **Given** invalid or missing values, **When** the user saves, **Then** nothing is saved and each problem is shown next to its field.
8. **Given** the save fails, **When** the error is returned, **Then** the entered values are kept and a readable error is shown.

---

### User Story 3 - Switch between and edit mortgages (Priority: P1)

As a signed-in user with several mortgages, I switch between them with tabs and update their details.

**Why this priority**: Multiple mortgages are a stated requirement.

**Independent Test**: Save two mortgages, switch tabs and confirm each tab shows its own details; rename one and confirm its tab label changes.

**Acceptance Scenarios**:

1. **Given** saved mortgages, **When** the screen opens, **Then** one tab per mortgage is shown across the top, labelled with its name, followed by "Add mortgage", and the first mortgage is selected.
2. **Given** several tabs, **When** the user selects a tab, **Then** Loan details, the schedule and the chart show that mortgage.
3. **Given** a saved mortgage, **When** the user changes any loan detail or interest rate change and saves, **Then** the change is kept, and a changed name updates the tab label.
4. **Given** unsaved changes, **When** the user selects another mortgage tab or "Add mortgage", deletes another mortgage, uses the left navigation or signs out, **Then** a modal prompt asks them to discard the changes or stay, and nothing happens until they choose; refreshing or closing the browser shows the browser's own leave-page confirmation instead (FR-026).
5. **Given** a saved mortgage, **When** the user selects the trash icon on its tab and confirms, **Then** the mortgage and its interest rate changes are removed, its tab disappears and the first mortgage tab is selected (or, if none remain, the empty "Add mortgage" state is shown).
6. **Given** the delete confirmation, **When** the user cancels, **Then** nothing changes and focus returns to that tab's trash icon.
7. **Given** unsaved edits to a saved mortgage, **When** the user selects Cancel, **Then** the edits are discarded and the Loan details show the saved values again; on a new mortgage, Cancel clears the form.
8. **Given** more tabs than fit across the screen, **When** the user views the tab strip, **Then** every tab stays reachable by scrolling the strip, without the page scrolling horizontally.

---

### User Story 4 - See the amortization schedule layout (Priority: P2)

As a signed-in user, I see a read-only Amortization Schedule for the selected mortgage, shaped by its saved loan details.

**Why this priority**: Fixes where the calculated schedule will appear; values come in a later feature.

**Independent Test**: Save a mortgage with 360 periods and confirm the schedule lists periods 1 to 361 with Date and Bank schedule columns and no editable cells.

**Acceptance Scenarios**:

1. **Given** a saved mortgage with N periods, **When** it is selected, **Then** the schedule shows rows numbered 1 to N + 1 under the columns Period, Date and Bank schedule.
2. **Given** calculations are not yet available, **When** the schedule is shown, **Then** Date and Bank schedule cells show a "not yet calculated" placeholder.
3. **Given** the schedule, **When** the user interacts with it, **Then** no cell can be edited.
4. **Given** a long schedule, **When** the user scrolls it, **Then** it scrolls within its group and the column headings stay visible.
5. **Given** the number of periods is changed and saved, **When** the schedule redraws, **Then** its row count matches the new value.

---

### User Story 5 - See the burn down chart layout (Priority: P2)

As a signed-in user, I see a Burn Down chart for the selected mortgage that will plot the balance over time from the amortization schedule.

**Why this priority**: Fixes the chart's place and form; data arrives with the calculations.

**Independent Test**: Select a saved mortgage and confirm the chart's title, axes and legend are shown with a "not yet calculated" message.

**Acceptance Scenarios**:

1. **Given** a selected mortgage, **When** the chart is shown, **Then** it has the title "Mortgage Burndown", a currency balance axis, a repayment date axis and a legend with the single series "Bank schedule".
2. **Given** no calculated schedule values, **When** the chart is shown, **Then** it shows a message that the burn down will appear once the schedule is calculated, instead of empty or misleading lines.
3. **Given** the chart, **When** a screen-reader user reaches it, **Then** it has a text alternative describing what it shows.

### Edge Cases

- Name already used by another of the user's mortgages, including one differing only in letter case or leading/trailing spaces (e.g. "Home loan" vs " home loan ") → save refused with "A mortgage with this name already exists".
- Name made up only of spaces → treated as empty and refused.
- Long names → tab label truncates with the full name available on hover and to assistive technology.
- Two interest rate changes with the same effective date → save refused, both rows flagged.
- User already has 20 mortgages → the "Add mortgage" tab is disabled with "You can save up to 20 mortgages" on hover and to assistive technology; a save of a 21st mortgage that still reaches the system is refused with the same message.
- Mortgage already has 60 interest rate changes → no further row can be added, and a save with more than 60 is refused with "A mortgage can have up to 60 interest rate changes".
- Interest rate change rows left completely empty → ignored on save (by the screen and by the system), and not counted toward the 60-row limit; partly filled rows → flagged.
- No interest rate change, or none effective on the First repayment date (including after the First repayment date is changed) → save refused with "Add the opening interest rate, effective on the first repayment date".
- Narrow screens (below 768 CSS pixels) → Burn Down and Amortization Schedule stack vertically (chart first) and everything stays reachable at 320 CSS pixels without page-level horizontal scroll.
- Light, Dark and System themes → tabs, groups, table and chart series remain legible.
- First repayment date in the future → save refused, field flagged.
- Number of periods so large that the final repayment date would be after 31 Dec 9999 → save refused, Number of periods flagged with "The final repayment date would be later than 31 Dec 9999".
- Effective date before the First repayment date or after the final repayment date → save refused, row flagged with the allowed date range.
- First repayment date, Number of periods or Repayment frequency changed so that saved interest rate changes fall outside the new range → save refused, out-of-range rows flagged.
- First repayment date, Number of periods or Repayment frequency cleared after rows were added → rows are kept but the save is refused until those fields are valid again.
- Same mortgage saved from two tabs or devices → the later save (or delete) is refused per FR-021; nothing is overwritten.
- Mortgage deleted elsewhere, then saved or deleted here → its tab is removed, the first tab selected (or the empty state shown) and a "This mortgage was deleted elsewhere" toast shown (FR-021).
- Reload after a conflict fails to fetch the latest version → form, conflict message and Reload stay, with "The latest version could not be loaded. Please try again." (FR-021).
- Background refresh while editing fails, or no longer includes the mortgage being edited → nothing on screen changes until the next save or delete (FR-024, FR-021).
- Loading the mortgages fails → generic "We couldn't load your mortgages. Please try again." message with Retry; no error details and no empty Loan details form (FR-024).
- Sign-in expires while editing → when the next save (or other request) is rejected because the sign-in has expired, a modal explains that the sign-in has expired and that signing in again will lose the unsaved changes, offering "Stay on this page" (values kept on screen, nothing saved) or "Sign in again" (changes discarded); nothing is saved or restored automatically (FR-026).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The left navigation MUST include a "Mortgages" destination positioned directly above "Categories", behaving like the existing destinations.
- **FR-002**: The Mortgages screen MUST show, below the header panel, a horizontal tab strip with one tab per saved mortgage (labelled with its name, in creation order) followed by an "Add mortgage" tab. When the user has 20 saved mortgages, the "Add mortgage" tab MUST stay visible but be disabled, with "You can save up to 20 mortgages" available on hover and to assistive technology.
- **FR-003**: The screen MUST show a Loan details group as a separate panel styled like the Categories "Add a group or category" panel, positioned at the top of the screen beneath the tab strip.
- **FR-004**: Loan details MUST capture Name, Starting balance, Number of periods, First repayment date, Repayment frequency (Weekly, Fortnightly or Monthly) and a list of one or more Interest rate changes, each with New interest rate and Effective date. The interest rate change effective on the First repayment date is the loan's opening rate; there is no separate opening rate field. First repayment date and each Effective date MUST use the browser's built-in date field (typed or picked from its calendar), displayed in the user's local format; no third-party date picker is used. Dates in messages (such as an allowed date range) MUST be written like "1 Jan 2000". Years below 1000 are written with four digits (e.g. "1 Jan 0001").
- **FR-005**: Users MUST be able to add and remove interest rate change rows before saving; adding a row MUST be unavailable until First repayment date, Number of periods and Repayment frequency are valid.
- **FR-006**: Saving MUST store the mortgage and its interest rate changes for the signed-in user only; saved mortgages MUST persist across sessions and never be visible to anyone else.
- **FR-007**: Validation MUST require: Name 1–100 characters after leading and trailing spaces are trimmed (the trimmed name is what is saved), unique among the user's mortgages ignoring letter case; Starting balance greater than 0 and at most 999,999,999,999.99, with up to 2 decimal places; Number of periods a whole number of at least 1 (a fractional, negative or unreadable value is refused with "Enter a whole number of 1 or more") with no fixed upper limit, but small enough that the final repayment date (FR-019) is on or before 31 Dec 9999; First repayment date a valid date the system can store and not later than today; Repayment frequency one of Weekly, Fortnightly or Monthly; New interest rate from 0 to 100 percent with up to 2 decimal places; Effective date a valid date, unique within the mortgage, on or after the First repayment date and on or before the final repayment date (FR-019); interest rate changes accepted only as FR-005 allows; at least one interest rate change, with one effective on the First repayment date (the opening rate); at most 20 mortgages per user; at most 60 interest rate changes per mortgage. Validation MUST be enforced on save by the system, not only on screen.
- **FR-008**: Validation errors MUST be shown next to the offending field and announced to assistive technology; a failed save MUST keep the entered values.
- **FR-009**: Users MUST be able to edit and save any loan detail of an existing mortgage; a renamed mortgage's tab label MUST update on save.
- **FR-010**: Selecting a tab MUST show that mortgage's Loan details, Amortization Schedule and Burn Down; switching away from unsaved changes MUST ask the user to discard or stay (FR-026).
- **FR-011**: The Amortization Schedule MUST be a read-only group to the right of the Burn Down chart (stacked below it under 768 CSS pixels) with columns Period, Date and Bank schedule and rows numbered 1 to Number of periods + 1.
- **FR-012**: Until calculations exist, Date and Bank schedule cells MUST show a "not yet calculated" placeholder; the schedule MUST scroll within its group with column headings kept visible.
- **FR-013**: The Burn Down group, headed "Mortgage Burndown", MUST show a line chart with a currency balance axis, a repayment date axis and a legend; its values will come from the Amortization Schedule. Until values exist it MUST show a "not yet calculated" message.
- **FR-014**: The chart MUST provide a text alternative; tabs MUST be operable by keyboard with the selected tab indicated.
- **FR-015**: Saving MUST give visible feedback within 500 milliseconds and confirm success or show the error. Success MUST be confirmed by a "Mortgage saved" toast shown in the bottom-right corner of the screen (bottom-centre under 768 CSS pixels), clear of the form, styled to stand out from the page, announced to assistive technology as a status, dismissible by the user and closing itself after 5 seconds (not while hovered or focused). Validation errors stay next to their fields (FR-008) and are not shown as toasts.
- **FR-016**: No amortization or burn-down values are calculated by this feature; the final repayment date used for validation (FR-019) is the only derived value.
- **FR-017**: Users MUST be able to delete a saved mortgage, with its interest rate changes, by selecting a trash icon on that mortgage's tab and confirming in a dialog; cancelling MUST change nothing. After a delete, the first remaining mortgage tab MUST be selected, or the empty "Add mortgage" state shown if none remain. The trash icon MUST be keyboard operable and named for assistive technology with the mortgage's name (e.g. "Delete Home loan"). The "Add mortgage" tab has no trash icon, and the Loan details group has no Delete button.
- **FR-018**: The Burn Down chart MUST show a single series, "Bank schedule"; other series (such as rapid repayment) are out of scope.
- **FR-019**: The schedule's Date column MUST be driven by First repayment date and Repayment frequency (period 1 on the first repayment date, each later period one frequency step on); calculating the dates belongs to the later calculation feature. The final repayment date is the date of period N (First repayment date plus N − 1 frequency steps; e.g. 1 Jan 2000, 360 monthly periods → 1 Dec 2029) and MUST be computed by this feature for validating Effective dates (FR-007).
- **FR-020**: Creating, updating and deleting a mortgage, including its interest rate changes, MUST each record an audit event for the acting user. Every successful save of an existing mortgage counts as an update, even if no value changed: it records one audit event and moves the version used by FR-021.
- **FR-021**: Updating or deleting a mortgage MUST be refused if it has changed since the user opened it; the user MUST see "This mortgage was changed elsewhere; reload to see the latest" with a "Reload" button, and their entered values MUST be kept. Selecting Reload MUST first show the discard-or-stay modal (FR-026); on discard, the form MUST show the latest saved version, or, if the mortgage was deleted elsewhere, its tab MUST be removed, the first mortgage tab selected (or the empty state shown if none remain), and the "This mortgage was deleted elsewhere" toast shown. Choosing stay keeps the entered values and the message. While the latest version is being fetched, the Reload button MUST show "Reloading…" and be disabled at once (within 500 milliseconds), and the form keeps its current values until the latest version arrives; if the fetch fails, the form, the conflict message and Reload MUST stay as they were, with the generic alert "The latest version could not be loaded. Please try again." (no error details), and the screen MUST NOT switch to the load-failure state (FR-024). If a save or delete finds the mortgage no longer exists (deleted elsewhere), its tab MUST be removed, the first mortgage tab selected (or the empty state shown), and a toast "This mortgage was deleted elsewhere" shown. If a delete is refused because the mortgage changed, the delete dialog MUST stay open showing the conflict message with "Reload"; Reload refreshes the mortgages, through the discard-or-stay modal (FR-026) if there are unsaved changes, showing "Reloading…" on the disabled Reload button while it runs and closing the dialog once the refreshed mortgages are shown; if the refresh fails, the dialog stays open with the generic alert "The latest version could not be loaded. Please try again." and Reload enabled again; choosing stay closes the dialog and keeps the entered values.
- **FR-022**: While a new mortgage is unsaved (no saved mortgages, or the "Add mortgage" tab is selected), the Burn Down and Amortization Schedule groups MUST still be shown at their full screen allocation, each displaying "Please enter your mortgage details" in place of the chart and table.
- **FR-023**: While the user's saved mortgages are loading, the screen MUST show a progress indicator styled like the sign-in screen's (the same spinning circle icon) with the text "Loading..." in place of the tab strip and groups, announced to assistive technology as a status; the Loan details form MUST NOT be offered until loading finishes.
- **FR-024**: If loading the user's mortgages fails, the screen MUST show the generic message "We couldn't load your mortgages. Please try again." with a Retry button in place of the tab strip and groups, announced to assistive technology; the message MUST NOT include error details, and the Loan details form MUST NOT be offered until a load succeeds. A load rejected because the sign-in expired is not a load failure; it follows the expired-session rule (FR-026). Once the mortgages have loaded, a background refresh (for example on returning to the window) MUST NOT replace the screen: if it fails, nothing on screen changes; if it succeeds, it MUST NOT reset a form with unsaved changes, and if the selected mortgage with unsaved changes is missing from the refreshed list, its tab and entered values stay until a save or delete finds it deleted elsewhere (FR-021).
- **FR-025**: The Loan details group MUST offer exactly two actions, Save and Cancel. Cancel MUST discard unsaved edits and restore the mortgage's saved values (on a new mortgage, it clears the form) without a prompt.
- **FR-026**: Whenever the Loan details have unsaved changes and an action would lose them, the user MUST first be shown a modal prompt to discard the changes or stay; choosing stay MUST leave the screen and values unchanged. This covers selecting another mortgage tab or "Add mortgage", deleting another mortgage, the left navigation, signing out, and an expired sign-in. Deleting the selected mortgage needs only the delete confirmation (FR-017), which discards its unsaved changes. Refreshing or closing the browser MUST show the browser's own leave-page confirmation (browsers do not allow a custom dialog there). Unsaved edits MUST NOT be saved, kept as drafts or restored by the system; only Save stores them. An untouched form (including a cleared or cancelled one) counts as having no unsaved changes. An expired sign-in with no unsaved changes returns the user to the sign-in screen without a prompt.

### Key Entities *(include if feature involves data)*

- **Mortgage**: A loan owned by the signed-in user. Name, starting balance, number of periods, first repayment date, repayment frequency, creation order, and a version used to detect clashing saves (FR-021).
- **Interest rate change**: Belongs to one mortgage. New interest rate (percent), effective date. Each mortgage has at least one; the one effective on the First repayment date is the opening rate.
- **Amortization schedule row** (displayed, not stored or entered): Period number, repayment date, bank schedule balance; produced by a later calculation feature.

### Constitution Scope

Tick each that applies, so plan can pick requirement IDs without rereading the spec:

- [x] Stores, changes or deletes data (DOT-002, OPS-001 migrations)
- [x] Creates or reads audit records (AUD-001)
- [x] Adds or changes endpoints, auth or input handling (SEC-001)
- [x] Handles personal, payment or financial data (SEC-003)
- [x] Changes UI in clutch-web (WEB-001, style guide)

## Success Criteria *(mandatory)*

- **SC-001**: A user can add a mortgage with two interest rate changes and save it in under 2 minutes.
- **SC-002**: 100% of saved mortgages and interest rate changes reappear unchanged after signing out and back in.
- **SC-003**: With 5 saved mortgages, switching tabs shows the selected mortgage's details within 1 second in 100% of checks.
- **SC-004**: For any saved number of periods N, the schedule shows exactly N + 1 rows numbered 1 to N + 1.
- **SC-005**: Every invalid value listed in FR-007 is rejected with a field-level message, and no invalid mortgage is stored.
- **SC-006**: At 320 CSS pixels and at desktop widths, in all three themes, all groups and tabs are reachable with no page-level horizontal scroll and no accessibility violations.
- **SC-007**: A user can never see another user's mortgages.
- **SC-008**: 100% of mortgage creates, updates and deletes produce exactly one audit event each.

## Assumptions

- Sign-in, ownership of data by the signed-in user, error format and data fetching follow the existing implementation (`src/Clutch.API/Infrastructure/DependencyInjection.cs`, `src/Clutch.API/Api/ProblemDetails/`, `src/clutch-web/src/lib/api/`).
- Mortgage audit events use the existing Audit table and event pattern (`src/Clutch.API/Domain/Audit/Audit.cs`, as used by `src/Clutch.API/Application/Transactions/TransactionService.cs`); audit descriptions do not include balances or rates.
- Starting balances up to 999,999,999,999.99 and very large period counts are accepted; the schedule stays usable by scrolling within its group.
- Currency is the user's single currency (AUD formatting, as elsewhere in the app); no multi-currency support.
- First repayment date is the loan's start date (period 1). Weekly and fortnightly steps are 7 and 14 days; monthly steps keep the same day of the month, falling back to the month's last day when that day doesn't exist. "Today" is the user's local date.
- The system's "not later than today" check uses the latest date anywhere in the world (UTC+14), so it never refuses a date that is today for the user; the screen checks against the user's local date.
- The opening rate (an interest rate change effective on the First repayment date) is required at save time; later interest rate changes are optional.
- The first saved mortgage tab is selected on open; the selected tab is not remembered between visits.
- Content panel width, navigation expansion behaviour and the bottom/side panel styling follow 011, 014 and 015 and the style guide.
- Chart data, rounding and repayment amounts are out of scope until the calculation feature.
