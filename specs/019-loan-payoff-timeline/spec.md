# Feature Specification: Loan Payoff Timeline Group

**Feature Branch**: `019-loan-payoff-timeline`

**Created**: 2026-11-22

**Status**: Draft

**Input**: User description: "currently on the mortgage screen the amortization schedule and the burn down are side by side.  put them in the one group that allows you to switch is showing.  default to showing the burndown but have a little button top right of the group that allows to switch between the two.  save this value under the user and reload it every time the user logs in.  every time the page is loaded adhere to the preference.  The title of the group should be "Loan Payoff Timeline""

<!--
  Builds on 016-mortgage-tracking, which places the "Mortgage Burndown" group and the
  "Amortization Schedule" group side by side (stacked, chart first, below 768px). This feature
  replaces those two groups with one "Loan Payoff Timeline" group that shows one view at a time.
  The chart and table contents themselves are unchanged. The per-user preference follows the
  pattern of 003-theme-selector and 018-persist-nav-state.
-->

## Clarifications

### Session 2026-11-22

- Q: When the user switches the Loan Payoff Timeline view, should every switch be saved straight away, even when the user switches several times in a row? → A: Yes. Every switch starts a save straight away. No switch is skipped, delayed or merged, and if saves overlap the last view the user chose is the one that ends up saved.
- Q: What should the switch button look like, and how should it tell users which view is showing? → A: A small icon-only button, the same size as the trash can (delete) icon buttons used across the app, showing the familiar circular arrows "switch" icon. Its accessible name and tooltip say which view it will show. It has no pressed state; a visually hidden status line tells screen readers which view is showing.

### Session 2026-11-22 (convergence)

- Q: The working tree makes the Loan Payoff Timeline group fill the page height (shared content area becomes a flex column; the schedule scrolls with the page instead of in its own box). Keep it? → A: Keep it, and record it as FR-013.

### Session 2026-11-22 (implementation review)

- Q: Should a failed save of the view show the error toast? → A: No. Toasts are only for when the user saves data. A failed view save shows nothing; the chosen view stays for the visit.
- Q: Aborting the saved-view request at exactly 2 seconds puts the chart on screen a few milliseconds after 2 seconds. Keep 2 seconds or shorten the wait? → A: Keep 2 seconds. The chart then shows as soon as it renders.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One group, switchable view (Priority: P1)

As a signed-in user on the Mortgages screen, I see a single "Loan Payoff Timeline" group showing the burndown chart by default, and a small button at its top right switches it to the amortization schedule and back.

**Why this priority**: This is the layout change itself and gives the selected view the full width of the screen.

**Independent Test**: Open the Mortgages screen, confirm one "Loan Payoff Timeline" group shows the burndown chart, press the switch button and confirm the schedule replaces the chart, press it again and confirm the chart returns.

**Acceptance Scenarios**:

1. **Given** the Mortgages screen has loaded, **When** the user views it, **Then** below the Details group there is one group titled "Loan Payoff Timeline" in place of the separate Mortgage Burndown and Amortization Schedule groups, spanning the full width they used to share.
2. **Given** a user with no saved preference, **When** the screen loads, **Then** the group shows the burndown chart.
3. **Given** the group shows the burndown chart, **When** the user activates the switch button at the group's top right, **Then** the group shows the amortization schedule instead, and activating it again shows the chart.
4. **Given** either view is shown, **When** a screen reader or keyboard user reaches the switch button, **Then** it is reachable by keyboard, its accessible name says which view it will show ("Show Amortization Schedule" or "Show Burndown Chart"), and a visually hidden status line announces which view is currently shown.
5. **Given** a view is shown, **When** the user switches mortgage tabs or selects "Add mortgage", **Then** the same view stays selected.
6. **Given** a new, unsaved mortgage, **When** either view is selected, **Then** the group shows "Please enter your mortgage details" across the group's full width, and the switch button still works.

---

### User Story 2 - Remember my view (Priority: P1)

As a signed-in user, the view I last chose is saved against my account, so every time I sign in, reload or open the Mortgages screen, the group shows that view.

**Why this priority**: The user explicitly asked that the choice persist per user and be honoured on every page load.

**Independent Test**: Switch to the schedule, reload and confirm the schedule shows; sign out and back in and confirm the schedule shows; switch back to the chart, reload and confirm the chart shows.

**Acceptance Scenarios**:

1. **Given** a user switched to the schedule, **When** they reload, navigate away and back, or sign out and in again, **Then** the group shows the schedule.
2. **Given** a user switched back to the chart, **When** they return, **Then** the group shows the chart.
3. **Given** the saved view is the schedule, **When** the group first appears, **Then** it shows the schedule without first showing the chart and then swapping.
4. **Given** user A saved the schedule and user B saved the chart, **When** each signs in on the same device, **Then** each sees their own view.
5. **Given** a user saves a view on one device, **When** they next sign in or reload on another device, **Then** that view is shown; when two devices save different views, the most recent save wins. A visit already open on the other device keeps the view last chosen in that visit until it is reloaded.
6. **Given** the Mortgages screen is open, **When** the user switches the view (once or several times in a row) and then reloads immediately, **Then** each switch was saved as it happened and the group shows the last view chosen.

### Edge Cases

- Saving fails (network or server error): the chosen view stays in effect for the current session, nothing blocks the screen, and no message is shown; the previously saved view applies next visit.
- Loading the saved view fails or takes longer than 2 seconds: the group shows the burndown chart and keeps it for that visit unless the user switches; a late-arriving saved view is not applied, and leaving the Mortgages screen and returning in the same visit does not request the saved view again.
- Rapid repeated switching: every switch is saved straight away (none skipped, delayed or merged), and when saves overlap the last view the user chose is the one that ends up saved, even if an earlier save finishes later.
- Narrow viewports (below 768 CSS pixels): the group still spans the content width, the switch button stays at the top right and visible, and everything remains reachable at 320 CSS pixels without page-level horizontal scroll.
- No saved mortgages: the group shows "Please enter your mortgage details" in the selected view, as in 016 FR-022.
- Sign-out followed by a different user signing in: the previous user's view is not shown.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Mortgages screen MUST replace the separate Mortgage Burndown and Amortization Schedule groups with one group titled "Loan Payoff Timeline", placed below the Details group and spanning the full width the two groups shared (supersedes the side-by-side layout of 016 FR-011 and the narrow-screen stacking in 016 Edge Cases).
- **FR-002**: The group MUST show exactly one view at a time: the burndown chart or the amortization schedule. Each view's content (chart series, axes, legend, table columns, rows and messages) MUST be unchanged from 016.
- **FR-003**: The group MUST have a switch button at its top right, aligned with the title, that toggles between the two views. It MUST be icon-only, the same size as the trash can (delete) icon buttons used across the app, and show a circular arrows "switch" icon.
- **FR-004**: The switch button MUST be keyboard operable, have an accessible name naming the view it will show ("Show Amortization Schedule" or "Show Burndown Chart"), and show a tooltip with the same wording on hover and focus. It MUST NOT use a pressed state; instead a visually hidden status line MUST tell screen readers which view is currently shown, and announce the new view after each switch.
- **FR-005**: With no saved preference, or when the saved preference cannot be loaded within 2 seconds, the group MUST show the burndown chart.
- **FR-006**: Every time the user switches the view, the system MUST immediately start saving the chosen view against the signed-in user. No switch may be skipped, delayed or merged with another switch before its save reaches the server. When saves overlap, the view the user chose last MUST be the one that ends up saved; the server MAY therefore discard a save that arrives after a later switch from the same page has already been stored.
- **FR-007**: Every time the Mortgages screen loads (after sign-in, reload or navigation) the group MUST show the user's saved view, and MUST NOT show the other view first and then swap.
- **FR-008**: The saved view MUST belong to the signed-in user only. On any device, the most recently saved value MUST apply the next time the user signs in or reloads there. Within a visit already in progress, navigating back to the Mortgages screen MUST show the view last chosen in that visit; saves from other devices are not pushed live.
- **FR-009**: The selected view MUST be one setting for the user, applying to every mortgage tab and to "Add mortgage", not one per mortgage.
- **FR-010**: A failure to save MUST NOT block the screen and MUST NOT show a message (toasts are only for saving data); the chosen view MUST remain in effect for the current session.
- **FR-011**: The saved preference MUST only accept the values Burndown or Schedule; any other value MUST be rejected.
- **FR-012**: The switch button MUST change the view visibly within 500 milliseconds of activation, regardless of how long saving takes.
- **FR-013**: The Loan Payoff Timeline group MUST grow to fill the height left in the content area below the Details group. The burndown chart fills the group; the amortization schedule scrolls with the content area (not in a separate scroll box) and keeps its header row, columns and rows unchanged (FR-002). The shared content area change MUST NOT alter the layout of other screens.

### Key Entities *(include if feature involves data)*

- **Loan payoff timeline preference**: A signed-in user's chosen view for the Loan Payoff Timeline group (Burndown or Schedule) and when it was last saved; one per user.

### Constitution Scope

Tick each that applies, so plan can pick requirement IDs without rereading the spec:

- [x] Stores, changes or deletes data (DOT-002, OPS-001 migrations)
- [ ] Creates or reads audit records (AUD-001)
- [x] Adds or changes endpoints, auth or input handling (SEC-001)
- [ ] Handles personal, payment or financial data (SEC-003)
- [x] Changes UI in clutch-web (WEB-001, style guide)

## Success Criteria *(mandatory)*

- **SC-001**: In 100% of checks the Mortgages screen shows one "Loan Payoff Timeline" group and never both views at once.
- **SC-002**: Users with no saved preference see the burndown chart in 100% of loads.
- **SC-003**: In 100% of return visits (reload, sign out/in, sign-in or reload on another device) the group shows the user's most recently saved view, and in 100% of navigations back within a visit it shows the view last chosen in that visit, with no visible swap from the other view in either case.
- **SC-004**: In 100% of checks one user's saved view is never applied to another user.
- **SC-005**: Users switch views in one action, and the view changes within 500 milliseconds in 100% of checks, including when saving fails.
- **SC-006**: When loading the saved view is slow, the system waits 2 seconds for it and then shows the burndown chart within 250 milliseconds; when it fails sooner, the chart shows at once; in 100% of checks.
- **SC-007**: In 100% of checks, every view switch starts a save, and after any sequence of switches (including one followed immediately by a reload) the saved view equals the last view the user chose.

## Assumptions

- "Burndown" is the existing "Mortgage Burndown" chart group and "amortization schedule" is the existing "Amortization Schedule" group from 016; only their container and placement change.
- The two former group headings are replaced by the single "Loan Payoff Timeline" title; the visible content shows sighted users which view is on screen, and the hidden status line tells screen reader users.
- The preference is synced per account like the theme (003) and navigation (018) preferences: applied on next sign-in or reload, last save wins (across devices, "most recent save" means the save the server stored last), not pushed live to other already-open devices, and not re-read when navigating within an open visit.
- While the saved view loads, the Mortgages screen stays in its existing loading state (waiting at most 2 seconds for the saved view, alongside the mortgages themselves) rather than showing a default view first.
- Preference changes are not audit events, consistent with the theme and navigation preferences.
- Acceptance is verified through automated checks, not manual testing.
