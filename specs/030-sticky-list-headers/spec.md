# Feature Specification: Sticky List Headers

**Feature Branch**: `030-sticky-list-headers`

**Created**: 2026-11-28

**Status**: Draft

**Input**: User description: "update the account transactions list and the assets list so that the header stays visible when scrolling as the mortgages list does.  footers such as on the assets do not remain visible. Out of scope: changes outside of this change"

**Revised 2026-11-28** after review of the first build, which moved the column header to the top of the content area: "the group the list resides in should go to the top of the main content area with a margin above it.  it should then stay there while scrolling continues through the list until the end.  at that time the main content group can continue scrolling if there is extra content.  the list header should remain in its original position within the list group box at all times."

**Extended 2026-11-28**: "apply this same behaviour to the mortgages amortization schedule list".

In this document the **list group** is the box holding a list: its title (if it has one), the list, and anything below the list inside the same box. The **content area** is the page's main scrolling area.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Transactions Group Stays While Its List Scrolls (Priority: P1)

When the user scrolls an account page with a long list of transactions, the Transactions group moves up to the top of the content area and stays there while the rows scroll within it, so the title and column headers are always where the user last saw them.

**Why this priority**: The transactions list is the longest list, where losing the header hurts most.

**Independent Test**: Open an account with more transactions than fit on screen, keep scrolling down, and confirm the group stops near the top, its rows scroll to the last one, and any content after the group then scrolls into view.

**Acceptance Scenarios**:

1. **Given** an account whose Transactions group is taller than the content area, **When** the user scrolls down to it, **Then** the group stops with a margin between it and the top of the content area.
2. **Given** the group is stopped there, **When** the user keeps scrolling, **Then** the rows move through the list while the group, its title and its column header (Date, Description, Direction, Amount, Balance when shown, Actions) do not move.
3. **Given** the end of the list has been reached, **When** the user keeps scrolling, **Then** the content area scrolls on, carrying the group up, if there is content after it.
4. **Given** any of these positions, **When** the user scrolls back up, **Then** the same stages happen in reverse.

---

### User Story 2 - Assets Group Stays While Its List Scrolls, Totals at the End (Priority: P2)

A long assets list behaves the same way. The totals footer is part of the list: it is reached at the end and does not stay in view before that.

**Why this priority**: Same benefit as Story 1 on a list that is usually shorter.

**Independent Test**: Open the assets list with more assets than fit on screen, keep scrolling down, and confirm the group stops near the top with its column header in place, and the totals rows appear only at the end of the list.

**Acceptance Scenarios**:

1. **Given** an Assets group taller than the content area, **When** the user scrolls down, **Then** the group stops with a margin above it and its rows scroll while the column header (Name, Description, Valuation, Actions) does not move.
2. **Given** the same list, **When** the user scrolls, **Then** the totals rows stay after the last asset and are seen only when the user reaches the end of the list.

---

### User Story 3 - Amortization Schedule Group Stays While Its List Scrolls (Priority: P3)

On the mortgages page, the Amortization Schedule group behaves the same way while it shows the schedule list: its title, view switch and column header stay put while the periods scroll.

**Why this priority**: The schedule already keeps its column header in view; this brings it into line with the other lists.

**Independent Test**: Show the schedule of a long mortgage, keep scrolling down, and confirm the group stops near the top and every period can be reached.

**Acceptance Scenarios**:

1. **Given** the schedule view of a group taller than the content area, **When** the user scrolls down, **Then** the group stops with a margin above it and the periods scroll while the title, view switch and column header (Period, Date, Bank Schedule, and the balance columns when shown) do not move.
2. **Given** the group is stopped, **When** the user reaches the last period, **Then** that period is fully visible.
3. **Given** the burndown chart view, **When** the user scrolls, **Then** the group scrolls as it does today.

### Edge Cases

- Switching between the chart and the schedule: the stages apply to the schedule only, from the new layout.
- A schedule of the longest duration allowed: rows appear as they are reached, as today.
- List group that fits in the content area: no change in appearance or scrolling.
- Content area too short to show the group's title, column header and a few rows: the page scrolls normally and the group does not stop.
- Table wider than the screen: it still scrolls sideways, and the header stays aligned with its columns at every vertical position.
- Rows scrolling past the header must not show through or above it.
- More transactions loaded while the group is stopped: the rows on screen stay put and the new rows follow them.
- Window resized, or content above the group changing height: the stages above still apply from the new layout.
- Keyboard focus moving to a row control that is not visible in the stopped group: the control is brought fully into view and is not hidden by the header (WCAG 2.2 focus not obscured).
- Light and dark themes: the header keeps its raised background.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: On the account transactions list, the assets list and the mortgages amortization schedule list, a list group taller than the content area MUST stop moving when it reaches the top of the content area, leaving a margin above it.
- **FR-002**: While the group is stopped, further scrolling MUST move through the list from its first row to its end, and MUST NOT move the group.
- **FR-003**: Once the end of the list is reached, further scrolling MUST move the content area on whenever there is content after the group.
- **FR-004**: The column header MUST remain in its original position within the list group at all times, with its existing labels, alignment (numeric columns right aligned), background and column widths aligned with the rows.
- **FR-005**: Table footers, including the assets totals rows, and any control that follows the rows (Load More and its error message) MUST NOT be held in view; they are reached at the end of the list.
- **FR-006**: All three stages MUST come from one continuous scroll of the content area, wherever the pointer is within it, and reverse when scrolling back. The user MUST NOT need to operate a second vertical scrollbar.
- **FR-007**: Screen-reader output, keyboard navigation and sideways scrolling of the table MUST stay as they are today, and a control in the list that receives keyboard focus MUST be fully visible. Exception for the amortization schedule: where it is wider than the screen it scrolls sideways within its group, and its rows are a keyboard stop at every width, both as on the other two lists.
- **FR-008**: The burndown chart view of the Amortization Schedule group MUST be unchanged.

### Constitution Scope

- [ ] Stores, changes or deletes data (DOT-002, OPS-001 migrations)
- [ ] Creates or reads audit records (AUD-001)
- [ ] Adds or changes endpoints, auth or input handling (SEC-001, SEC-004)
- [ ] Handles personal, payment or financial data (SEC-003)
- [x] Changes UI in clutch-web (WEB-001, style guide)

## Success Criteria *(mandatory)*

- **SC-001**: At every scroll position between the group stopping and the end of its list, the group is in the same place with a margin above it, and its column header is in the same place within it (100% of positions checked).
- **SC-002**: Every row of all three lists can be reached by scrolling the content area alone, and the assets totals rows are visible only when the end of the list is reached.
- **SC-003**: Content after a list group can still be scrolled into view.
- **SC-004**: List groups that fit in the content area look unchanged from today.
- **SC-005**: All three lists still pass the existing accessibility and style-guide checks in light and dark themes.

## Out Of Scope

- Changes outside of this change: only the scrolling behaviour of the account transactions list, the assets list and the amortization schedule list changes.
- Holding footers, totals rows, or any column (such as the first column) in view.
- Changes to any other list, or to the burndown chart.

## Assumptions

- The margin above a stopped group is the same as the space the content area already leaves around its contents. A matching space is left below it.
- The Load More control and its error message belong to the end of the list, as a footer does.
- Page headings and other content before the list group scroll away as they do today.
- Theme tokens, focus ring and table styling are settled (`src/clutch-web/src/index.css`, `src/clutch-web/src/components/ui/`).
