# Feature Specification: Mortgage Area Chart

**Feature Branch**: `026-mortgage-area-chart`

**Created**: 2026-11-24

**Status**: Draft

**Input**: User description: "change the mortgages chart to be like this area chart. https://reui.io/blocks/chart/area-chart I like the colours that change over time and that the area is coloured in. put the bank schedule and the actual balance on the chart. when you hover over a data point show a label of what the value is."

<!--
  Builds on 016-mortgage-tracking (Mortgage Burndown chart), 023-amortization-schedule-calculation (Bank
  Schedule line) and 024-actual-balance-chart-line (Actual Balance line, legend, axis range, text alternative).
  This feature changes how both series are drawn and adds hover labels. It supersedes 024 FR-003's single
  `chart-navy` colour and its "no markers" rule for hovered points. Which points are plotted, the axes, the
  messages and the data are unchanged.
  Reference (user screenshot of the reui.io area chart): a smooth line whose colour shifts from blue through
  purple to pink from left to right, the area beneath it filled in the same shifting colours, and a hover label
  with a vertical highlight band and a ring on the hovered point.
-->

## Clarifications

### Session 2026-11-24

- Q: Which colour scheme do the two series use? → A: Each series has its own: Bank Schedule shifts from blue to purple, Actual Balance from teal to green. (Revised 2026-11-24: Actual Balance shifts from teal to cyan, because teal→green passes through the success colour and fails FR-002.)
- Q: Which series are filled in? → A: Both, lightly, with the two fills overlapping.
- Q: When should screen readers read out the hover label's date and balances? → A: Whatever complies with WCAG 2.2 AA: read out when the label moves by keyboard, not on mouse hover.
- Q: On a touch screen, what should happen to the label when the user lifts their finger? → A: Not applicable; the chart is desktop only, so no touch behaviour is required.
- Q: When a keyboard user tabs onto the chart, should the label appear at once or only on an arrow key? → A: No label on focus; Right Arrow or Home shows the first date, Left Arrow or End the last, then keys move as FR-009.
- Q: Should keyboard users be able to jump a year at a time? → A: Yes; Page Down/Page Up move to the plotted date nearest one year later/earlier, stopping at the last/first date.
- Q: When mouse and keyboard are both used, which controls the hover label and when does it hide? → A: One shared label, last input wins: the pointer moves it to its date and keys continue from there; it hides when the pointer leaves the plot area (if the pointer moved it last), when the chart loses focus, or on Escape.
- Q: (Review of the built chart) How many colours should each series shift through? → A: Three, like the reference: Bank Schedule blue → violet → pink; Actual Balance teal → sky → indigo. Lines, fills, rings and legend samples all use the three-colour range.
- Q: Should the Actual Balance line stay dashed? → A: No, it is solid. So the series are still told apart without colour (WCAG 2.2 SC 1.4.1), the Actual Balance line is named "Actual Balance" in text at its last plotted point.
- Q: Where should the hover label sit? → A: It always follows the hovered date, beside the band, never jumping to the far side of the chart.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read the burndown as a coloured area chart (Priority: P1)

As a signed-in user viewing a mortgage's Loan Payoff Timeline, I see the Bank Schedule and the Actual Balance drawn as lines whose colour changes over time, with the area beneath each line coloured in, so the payoff reads at a glance.

**Why this priority**: This is the visual change the user asked for and the base the hover labels sit on.

**Independent Test**: Open a mortgage with valid Details and a linked account with balances and confirm both series are drawn with a colour that changes from the earliest to the latest date and a filled area beneath, and that the legend matches.

**Acceptance Scenarios**:

1. **Given** valid Details, **When** the Burndown is shown, **Then** the Bank Schedule line's colour changes continuously from the Disbursal Date to the final repayment date and the area between the line and the balance axis's $0 is filled in matching colours.
2. **Given** a linked account with Actual Balances, **When** the Burndown is shown, **Then** the Actual Balance series is drawn with the same treatment as FR-002 and FR-003 describe, and can be told apart from the Bank Schedule without relying on colour.
3. **Given** both series are shown, **When** they overlap, **Then** the Actual Balance line is drawn on top, both lines stay visible, and the filled areas do not hide either line or the horizontal guides.
4. **Given** no linked account, **When** the Burndown is shown, **Then** only the Bank Schedule series and its legend entry are drawn, in the new style.

---

### User Story 2 - Hover a point to see its value (Priority: P1)

As a signed-in user, when I point at the chart, a label shows the date and balances at the nearest plotted date, so I can read exact values without the table.

**Why this priority**: Explicitly requested; without it the chart only shows shape, not values.

**Independent Test**: Move the pointer across the chart and confirm a label follows the nearest plotted date, showing the date, the Bank Schedule balance and, where the row has one, the Actual Balance, each matching the Amortization Schedule.

**Acceptance Scenarios**:

1. **Given** the Burndown is plotted, **When** the pointer is over the plot area, **Then** the nearest plotted date is highlighted with a vertical band, each series' point at that date is marked with a ring in that series' colour, and a label shows the date, "Bank Schedule" and its balance, and "Actual Balance" and its balance when that row has a non-blank Actual Balance.
2. **Given** the label was last moved by the pointer, **When** the pointer leaves the plot area, **Then** the label, band and rings disappear.
3. **Given** a keyboard user, **When** they Tab to the chart, **Then** no label is shown; **When** they then press Right Arrow, Home or Page Down, **Then** the label shows the first plotted date, and Left Arrow, End or Page Up shows the last; further Left or Right Arrow presses (Home and End for the first and last dates, Page Up and Page Down for about a year earlier or later) move the label between plotted dates exactly as hover does, and Escape hides it.
4. **Given** a date near either edge of the chart, **When** its label is shown, **Then** the whole label stays inside the chart.
5. **Given** the chart has focus and the pointer has moved the label to a date, **When** the user presses an arrow key, **Then** the label moves on from that date; **Given** the label was last moved by keyboard, **When** the pointer leaves the plot area, **Then** the label stays; **When** the chart loses focus, **Then** the label, band and rings disappear.

### Edge Cases

- Details invalid, incomplete, or the monthly fallback (023 FR-002, 020 FR-008) → the existing message and empty frame, no fill and no hover label.
- Balances loading, failed, or none in range → Bank Schedule drawn in the new style with hover labels showing Bank Schedule only; legend and text alternative behave as 024 FR-004, FR-007, FR-009.
- Exactly one Actual Balance → drawn as a single dot (024), with no fill; hovering its date shows its value.
- A negative Actual Balance (axis extends below $0, 024 FR-006) → the Actual Balance area is filled between the line and $0, above and below it.
- Very long schedules (up to 1,560 periods, points closer than a pixel apart) → hover still picks the single nearest plotted date and the label shows its exact values.
- Light, Dark and System themes (System resolves to Light or Dark, so checking those two covers it), and desktop viewports down to 320 CSS pixels wide (browser zoom, WCAG 2.2 SC 1.4.10) → every part of each line and the label meet contrast requirements and the label stays readable.
- User prefers reduced motion → the label, band and rings appear and move without animation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Mortgage Burndown MUST keep plotting the same points as today (023 and 024): the Bank Schedule from the Opening Balance at the Disbursal Date through each row's closing balance, and the Actual Balance at each row with a non-blank Actual Balance, on the same date and balance axes.
- **FR-002**: Each line's colour MUST change continuously along the date axis through three colours, from the start of the chart to its end, in both themes: the Bank Schedule from blue at the Disbursal Date through violet at the middle to pink at the final repayment date, and the Actual Balance from teal through sky to indigo over the same date span (so a colour always means the same point in time). These are new chart colours; every colour along the Actual Balance line MUST be distinct from the app's success status colour, differing from it in hue by at least 30° in each theme, so it never implies being ahead of schedule (024 FR-003).
- **FR-003**: The areas between each line and $0 MUST both be filled, each with its line's changing colour at reduced strength (at most 20% opacity), overlapping where both series are drawn. The horizontal guides and both lines MUST be drawn above both fills.
- **FR-004**: Every colour used for a line MUST have at least 3:1 contrast with the chart background along its whole length in Light and Dark themes (WCAG 2.2 SC 1.4.11), where the background includes any series fill and the hover band drawn beneath the line (the card alone, either or both fills, with or without the band); the same applies to the hover rings and the single Actual Balance dot, and the two series MUST stay distinguishable without colour: both lines are solid, and the Actual Balance line is named "Actual Balance" in text beside its last plotted point (or its single dot), kept inside the plot area, with at least 4.5:1 contrast against what it sits on (supersedes 024 FR-003's dash).
- **FR-005**: Lines MUST pass through every plotted point. Any smoothing MUST NOT overshoot a point or draw a balance that no row has (for example, rising between two falling points).
- **FR-006**: The legend MUST show each series' name with a sample showing that series' full colour range, start to end, drawn as a solid line, and follow 024 FR-004 for when "Actual Balance" is listed.
- **FR-007**: When the pointer is over the plot area, the chart MUST highlight the plotted date nearest the pointer's horizontal position with a vertical band, mark each series' point at that date with a ring, and show a label with the date in the app's display format and each series' balance at that date with cents, each in the same format as its Amortization Schedule column: the Bank Schedule as the schedule's closing balance and the Actual Balance in the linked account's currency. Balances MUST be right aligned (WEB-001) and match the Amortization Schedule exactly; at the Disbursal Date, which has no schedule row, the label shows the Bank Schedule's Opening Balance from Details in the same format and no Actual Balance.
- **FR-008**: The label MUST omit "Actual Balance" for dates whose row has a blank Actual Balance, and MUST NOT show for dates that are not plotted.
- **FR-009**: The label MUST be reachable by keyboard (the chart takes focus; Left/Right Arrow move between plotted dates, Home/End go to the first/last, Page Down/Page Up go to the plotted date nearest one year after/before the current one, moving at least one plotted date unless already at the last/first, where it stays, Escape hides it), with a visible focus indicator. Focusing the chart MUST NOT show the label; while no label is shown, Right Arrow, Home or Page Down MUST show it at the first plotted date and Left Arrow, End or Page Up at the last. When the label moves by keyboard, its contents MUST be announced to screen-reader users (WCAG 2.2 SC 4.1.3); mouse hover MUST NOT trigger announcements.
- **FR-009a**: Pointer and keyboard MUST share one label, band and set of rings, moved by whichever input was used last: pointer movement over the plot area moves it to the nearest plotted date, and keyboard navigation (FR-009) continues from the date it shows. It MUST hide when the pointer leaves the plot area if the pointer moved it last, when the chart loses focus, or on Escape; a keyboard-moved label MUST NOT hide when the pointer leaves.
- **FR-010**: The label MUST follow the hovered date at all times: it sits beside the band, to the right of it (or to the left when there is no room on the right), at the height of the hovered points; only when neither side has room does it overlap the date, then above or below the rings. It MUST stay inside the chart's box (its container, including axis labels), MUST NOT block the pointer from reaching other dates, and MUST respect the user's reduced-motion preference.
- **FR-011**: The chart's text alternative, messages, empty frame and update behaviour MUST stay as 024 defines them (FR-005, FR-007, FR-008, FR-009).
- **FR-012**: The chart MUST NOT gain the reference's other parts (header totals, period selector, display menu, refresh, expand or "updated" footer).

### Constitution Scope

Tick each that applies, so plan can pick requirement IDs without rereading the spec:

- [ ] Stores, changes or deletes data (DOT-002, OPS-001 migrations)
- [ ] Creates or reads audit records (AUD-001)
- [ ] Adds or changes endpoints, auth or input handling (SEC-001, SEC-004)
- [x] Handles personal, payment or financial data (SEC-003): shows existing balances in hover labels; no new data is read or stored
- [x] Changes UI in clutch-web (WEB-001, style guide): new chart colour treatment (new chart tokens, code first), filled areas, hover label with keyboard access

## Success Criteria *(mandatory)*

- **SC-001**: In 100% of checks, every hover label's Bank Schedule and Actual Balance values equal the Amortization Schedule row with the same date, and the Disbursal Date's label equals the Opening Balance in Details.
- **SC-002**: In 100% of checks across Light and Dark themes, every line, ring and dot colour meets 3:1 contrast with the chart background (FR-004), and every label's text meets 4.5:1 with the label background.
- **SC-003**: The hover label follows the pointer to the nearest plotted date within 100 milliseconds, measured in the browser from pointer move to label shown, for schedules up to 1,560 periods.
- **SC-004**: A keyboard-only user can reach the first, last and any intermediate plotted date's values without a pointer, in 100% of checks.
- **SC-005**: In 100% of checks, no plotted point or fill lies outside the chart's axes, no label lies outside the chart's box (FR-010), and the plotted points are the same as before this feature.

## Assumptions

- "Like this area chart" means the reference's line colour that shifts over time, the filled area beneath and its hover label with highlight band and point ring; its header, controls and footer are out of scope (FR-012).
- The blue-violet-pink and teal-sky-indigo colours become new chart colour tokens defined in code for both themes, per the style guide's "code first" rule, and the style guide's chart guidance is updated in the same change; the reference's hatched texture is a styling choice the plan may adopt within FR-003.
- Hover picks the nearest plotted date on the date axis (the Disbursal Date and every schedule row), not the nearest point in two dimensions, so both series' values at that date show together, as in the reference.
- Both lines are solid; the Actual Balance line's end-of-line name keeps the series from being told apart by colour alone.
- No new data, endpoint or audit record is needed; the chart reads only what the schedule and the Actual Balance column already show.
- The chart is used on desktop only, with a mouse or keyboard; touch interaction is out of scope.
- Acceptance is verified through automated checks, not manual testing.
