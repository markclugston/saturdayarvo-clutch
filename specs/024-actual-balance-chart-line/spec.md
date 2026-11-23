# Feature Specification: Actual Balance Chart Line

**Feature Branch**: `024-actual-balance-chart-line`

**Created**: 2026-11-23

**Status**: Draft

**Input**: User description: "on the mortgage screen there is a column actual balance on the amortization schedule.  plot those values on the chart. use a different colour line to the bank schedule.  follow all the same rules and guidlines used for the bank schedule."

<!--
  Builds on 016-mortgage-tracking (Mortgage Burndown chart, FR-013, FR-014, FR-018), 019-loan-payoff-timeline
  (chart inside the Loan Payoff Timeline group), 020-mortgage-account-balance-column (the Actual Balance
  column, its per-period values and blank rules) and 023-amortization-schedule-calculation (the Bank Schedule
  line, FR-008, SC-005). This feature lifts 016 FR-018's single-series limit and 023's assumption that the
  Actual Balance is not plotted. The Actual Balance values themselves are unchanged.
-->

## Clarifications

### Session 2026-11-23

- Q: How should a sighted user tell the Actual Balance line from the Bank Schedule line without relying on colour alone? → A: Actual Balance is a dashed line of the same weight in a different colour, and its legend sample is dashed too.
- Q: Which theme colour should the dashed Actual Balance line use? → A: The `chart-navy` chart token (navy in Light, light blue in Dark); the Bank Schedule keeps `chart-primary`.
- Q: When the two lines overlap, which line should be drawn on top? → A: The dashed Actual Balance line is drawn on top of the solid Bank Schedule line.
- Q: Should the Actual Balance line show a dot at each plotted balance? → A: No; it is a plain dashed line with no dots, except a single dot in the line's colour when exactly one balance is plotted.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the actual balance against the bank schedule (Priority: P1)

As a signed-in user with a Mortgage Account linked, when the Loan Payoff Timeline shows the Mortgage Burndown, I see a dashed "Actual Balance" line in a different colour beside the Bank Schedule line, so I can see at a glance whether I am ahead of or behind the bank's schedule.

**Why this priority**: This is the whole feature: the chart view of the comparison the Actual Balance column already gives.

**Independent Test**: Open a mortgage with valid Details and a linked account whose transactions carry balances, show the Burndown and confirm a second, dashed line, in its own colour and named in the legend, passes through each non-blank Actual Balance at its row's date.

**Acceptance Scenarios**:

1. **Given** valid Details and a linked account, **When** the Burndown is shown, **Then** an "Actual Balance" series is plotted with one point at each schedule row's date for that row's non-blank Actual Balance, joined in date order.
2. **Given** the Actual Balance line is shown, **When** the user looks at the chart, **Then** it is dashed and uses a different colour from the solid Bank Schedule line, and the legend shows "Actual Balance" with a dashed sample in that colour beside "Bank Schedule".
3. **Given** a row whose Actual Balance cell is blank (before the account's first balance-bearing transaction, or after the period holding its latest one), **When** the Burndown is shown, **Then** no Actual Balance point is drawn for that row.
4. **Given** no linked account, or a selected account that is missing from the user's accounts list (it behaves as none, as in 020), **When** the Burndown is shown, **Then** the chart looks and behaves exactly as before: Bank Schedule line only, no Actual Balance legend entry.
5. **Given** both lines are shown, **When** a screen-reader user reaches the chart, **Then** its text alternative names both series and, for Actual Balance, states its first and last plotted balances and their dates.

---

### User Story 2 - The line stays current (Priority: P2)

As a signed-in user, the Actual Balance line changes whenever the Actual Balance column changes, without reloading the page.

**Why this priority**: A stale line would mislead; it depends on User Story 1.

**Independent Test**: With the Burndown shown, change the Mortgage Account, import transactions and delete a transaction, and confirm the line matches the column after each change without a reload.

**Acceptance Scenarios**:

1. **Given** the Burndown is shown, **When** the user picks a different Mortgage Account or "None" (saved or not), **Then** the line is redrawn for the new account or removed with its legend entry.
2. **Given** a linked account, **When** transactions are imported into or deleted from it, **Then** the line updates to the new balances without a manual reload (as 020 FR-011 does for the column).
3. **Given** a Detail changes in the form, **When** the Burndown is shown, **Then** both lines update with the new periods.

### Edge Cases

- Any calculation input invalid or incomplete (023 FR-002), including the monthly fallback of 020 FR-008 → the chart shows its existing message and no lines, exactly as for the Bank Schedule today, even though the table may show Actual Balances.
- Balances still loading → the Bank Schedule line shows at once and the legend lists both entries (FR-004); the Actual Balance line appears when the balances arrive.
- Balances fail to load → the Bank Schedule line shows as normal, the legend still lists both entries (FR-004), no Actual Balance line is drawn, the text alternative describes the Bank Schedule only, and the table's existing error message is the only message.
- Linked account with no balance-bearing transactions in the schedule's range → no Actual Balance line; the legend still lists "Actual Balance" and the text alternative says there are no actual balances to plot.
- Actual Balance exactly on the Bank Schedule → the dashed Actual Balance line lies over the solid Bank Schedule line and both remain visible.
- Only one non-blank Actual Balance → it is drawn as a single dot in the `chart-navy` colour, since one point makes no line.
- An Actual Balance above the Opening Balance → the balance axis grows to the next round value that holds the larger of the two series, so no point is drawn off the chart.
- A negative Actual Balance (the balance crossed zero, 020 FR-005b) → the balance axis extends below $0 to the next round value that holds it, with $0 still labelled, so no point is drawn off the chart.
- Very long schedules (up to 1,560 periods, 023) → every non-blank Actual Balance is plotted within the same time limit as the Bank Schedule.
- Light, Dark and System themes and narrow screens down to 320 CSS pixels → both lines and both legend entries remain legible and distinguishable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When a Mortgage Account is selected, the Mortgage Burndown chart MUST plot a second series, "Actual Balance", with one point per schedule row that has a non-blank Actual Balance, at that row's date and value as shown in the Amortization Schedule, joined in date order. This supersedes 016 FR-018's single-series limit.
- **FR-002**: The Actual Balance series MUST NOT add any point the column does not show: no point at the Disbursal Date unless a row with that date shows a balance, and no point for a blank cell.
- **FR-003**: The Actual Balance line MUST be dashed, with the same line thickness as the solid Bank Schedule line, and MUST use the `chart-navy` chart colour token, while the Bank Schedule keeps `chart-primary`, so the line is legible in Light, Dark and System themes. It MUST NOT use a status colour (success, warning, danger), which would imply ahead or behind. The dash and the colour together distinguish the lines, so colour is never the only cue (WCAG 2.2 SC 1.4.1). The Actual Balance line MUST be drawn on top of the Bank Schedule line, so where the two coincide the solid line shows through the dash gaps and both stay visible. Like the Bank Schedule line, the Actual Balance line MUST NOT draw a marker at each point; only when exactly one Actual Balance is plotted MUST it be drawn as a single dot in the `chart-navy` colour.
- **FR-004**: The legend MUST list "Actual Balance" with a dashed sample in its colour after "Bank Schedule" whenever a Mortgage Account is selected and found in the user's accounts list and the Bank Schedule is plotted, including while balances load, after they fail and when there are none to plot, and MUST NOT list it otherwise.
- **FR-005**: The Actual Balance series MUST follow the Bank Schedule's rules: the same date axis and currency balance axis, the same "Please enter your mortgage details" prompt and "not yet calculated" message, and no lines at all whenever the Bank Schedule is not plotted (023 FR-002, FR-008).
- **FR-006**: The balance axis MUST run from $0 (or, when any plotted Actual Balance is negative, the next round value below it) to the next round value at or above the largest plotted value of either series, so every point stays inside the chart.
- **FR-007**: The chart's text alternative MUST name both series when both are plotted and, for Actual Balance, state its first and last plotted balances with their dates, or that there are no actual balances to plot.
- **FR-008**: The Actual Balance line MUST reflect the current Mortgage Account selection, Details and transactions, updating without a page reload whenever the Actual Balance column does.
- **FR-009**: While balances load or after they fail to load, the chart MUST show the Bank Schedule line as normal and no Actual Balance line, and MUST NOT add a message of its own.
- **FR-010**: Users MUST only see their own account's balances on the chart (unchanged from 020 FR-010).

### Constitution Scope

Tick each that applies, so plan can pick requirement IDs without rereading the spec:

- [ ] Stores, changes or deletes data (DOT-002, OPS-001 migrations)
- [ ] Creates or reads audit records (AUD-001)
- [ ] Adds or changes endpoints, auth or input handling (SEC-001, SEC-004)
- [x] Handles personal, payment or financial data (SEC-003): displays existing account balances; no new data is read or stored
- [x] Changes UI in clutch-web (WEB-001, style guide): second chart series, legend entry and axis range

## Success Criteria *(mandatory)*

- **SC-001**: In 100% of checks where the Bank Schedule is plotted, every Actual Balance point on the Burndown equals the Actual Balance in the row with the same date, and every non-blank Actual Balance cell has a point.
- **SC-002**: In 100% of checks, mortgages without a linked account show a chart identical to before this feature, apart from the Bank Schedule's class changing from `text-primary` to `text-chart-primary`, which renders the same colour.
- **SC-003**: In 100% of checks across Light, Dark and System themes, the Actual Balance line and its legend sample use `chart-navy` and the Bank Schedule line `chart-primary`, the Actual Balance line is dashed and the Bank Schedule line solid, and each legend entry's colour and dash match its line.
- **SC-004**: The chart shows both lines within 500 milliseconds of the Actual Balance column showing its values, for schedules up to 1,560 periods.
- **SC-005**: In 100% of checks, no plotted point lies outside the chart's axes.

## Assumptions

- The Actual Balance values, their blank rules and their loading come from 020 and are unchanged; the chart only reads what the column shows.
- "Follow all the same rules" means the Actual Balance line appears only when the Bank Schedule line does; the chart does not plot Actual Balances in the monthly fallback or while Details are invalid.
- The Actual Balance line is dashed at the same weight as the solid Bank Schedule line; dash, colour and the legend label distinguish them, and the text alternative serves screen-reader users.
- The date axis keeps spanning the Disbursal Date to the final repayment date; Actual Balances always fall within it because they belong to schedule rows.
- No new data, endpoint or audit record is needed.
- Acceptance is verified through automated checks, not manual testing.
