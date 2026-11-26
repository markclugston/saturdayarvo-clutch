# Feature Specification: Forecast Balance

**Feature Branch**: `027-forecast-balance`

**Created**: 2026-11-26

**Status**: Draft

**Input**: User description: "on the mortgage amortization schedule add a new column for "Forecast Balance". In this column it is to show the calculated balance given the median reduction in actual balance of the trailing 12 months. that is: 1. go back 12 months and note the reduction in actual balance from the period before. 2. then do this for all 12 months leading to the most recent period. 3. calculate the median of these 12 values. 4. fill out the Forecast column starting from the next period that has no Actual Balance value. e.g. Last Actual Balance value minus the calculated reduction payment value equals the Forecast Balance value. 5. Complete this for all future values until the Forecast Balance value is at or below 0. The first value at or below 0 in this column is to show 0. All values after should not be calculated and be empty. just like the Actual value column is showing at this point. Once these values are in and correct, plot these values on the chart using a new colour scheme fo the line and area."

<!--
  Builds on 020-mortgage-account-balance-column (the Actual Balance column and its blank rules),
  023-amortization-schedule-calculation (schedule rows and Bank Schedule), 024-actual-balance-chart-line and
  026-mortgage-area-chart (chart series, legend, hover label, text alternative). Actual Balance and Bank
  Schedule values are unchanged by this feature; their colours and fills changed in the review session.
-->

## Clarifications

### Session 2026-11-26

- Q: Which reductions are used for Weekly and Fortnightly mortgages? → A: Every per-period reduction in the trailing 12 months.
- Q: What if less than 12 months of Actual Balance history exists? → A: Use as much as is available, up to a maximum of 12 months.
- Q: Does the most recent period count towards the median when it may be unfinished? → A: Yes. It cannot be told whether a period is finished, so if the data exists it is included.
- Q: Are rows added if the forecast is still above zero at the last schedule row? → A: No. The forecast stops at the last row.
- Q: Is the forecast shown when the Bank Schedule cannot be calculated? → A: Yes, in the table whenever it can be calculated from the Actual Balances. The chart still needs the Bank Schedule before it plots anything.
- Q: What is shown when no Actual Balance data is available? → A: No Forecast Balance values at all. The Bank Schedule is then the only forecast.
- Q: Where are the forecast calculations done? → A: All in the browser.
- Q: Is the Forecast Balance column shown or hidden when a linked account has no Actual Balance data? → A: Shown, with blank cells, whenever the Actual Balance column is shown.

### Session 2026-11-26 (review of the built chart)

- Q: Should the forecast line stay dashed? → A: No, it is solid.
- Q: Which colours does the forecast use? → A: Red, orange and yellow from the user's sample (255 0 45, 255 128 45, 255 255 45), in both themes, all three showing along every forecast.
- Q: May the card show white around the forecast? → A: No. The filled area leaves no white space under the line or where it meets the Actual Balance area, so the card-coloured outlines are removed.
- Q: Which colours do the other series use? → A: In both themes, Actual Balance green (17 255 0, 17 255 128, 17 255 255) and Bank Schedule blue (0 15 255, 128 15 255, 255 15 255), from the user's samples.
- Q: Where do each series' three colours run? → A: Top to bottom along that series' own line, so all three show on every line, with its area matching at each height. This replaces 026's "a colour means the same balance".
- Q: Is the Bank Schedule's striped fill clear enough in Dark? → A: No, the stripes are stronger in Dark.
- Q: Do the sample greens and the red to yellow forecast work? → A: No. Actual Balance is the single earlier green (22 163 74 in Light, 74 222 128 in Dark) and Forecast Balance the single orange 255 128 45 in both themes. Bank Schedule keeps its blues. (Final; replaces the colour answers above.)
- Q: The Light orange and the Dark blue and violet are below 3:1 on the card. Adjust them? → A: Yes. Light Forecast Balance is 233 108 7; Dark Bank Schedule starts 52 110 255 with 142 84 255 in the middle. Every series now reaches 3:1 on the card in both themes (FR-010 and SC-004 met).
- Q: Should the remaining accessibility findings be fixed? → A: No. Leave the chart as it is, as a permanent exception that is not to be revisited: for the Mortgage Burndown, 026 FR-004 (3:1 over the series fills, WCAG 2.2 SC 1.4.11) and 026 FR-002 (Actual Balance 30° in hue from the success colour) do not apply, and the legend samples may differ by colour alone (SC 1.4.1). The separate contrast fix is withdrawn.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Forecast the remaining balance (Priority: P1)

As a signed-in user with a Mortgage Account linked, I see a "Forecast Balance" column in the Amortization Schedule that projects my balance forward at my typical recent reduction, so I can see when the loan is likely to be paid off.

**Why this priority**: The calculated values are the feature's purpose, and the chart depends on them.

**Independent Test**: Link an account with known balances and confirm each Forecast Balance cell equals the hand-calculated value, ending at the first zero.

**Acceptance Scenarios**:

1. **Given** at least 13 consecutive monthly Actual Balances (12 reductions) on a monthly mortgage, **When** the schedule is shown, **Then** the first row after the last Actual Balance shows that balance minus the median of the last 12 period-to-period reductions.
2. **Given** a forecast row, **When** the next row is shown, **Then** it shows the previous Forecast Balance minus the same median.
3. **Given** a calculation that reaches zero or less, **When** the schedule is shown, **Then** that row shows zero and every later Forecast Balance cell is blank.
4. **Given** a row with an Actual Balance, or any row before it, **When** the schedule is shown, **Then** its Forecast Balance cell is blank.
5. **Given** no linked account, **When** the schedule is shown, **Then** there is no Forecast Balance column.
6. **Given** transactions are imported or deleted, or the Mortgage Account or Details change, **When** the Actual Balance column updates, **Then** the forecast is recalculated without a page reload.
7. **Given** at least two Actual Balances but fewer reductions than the 12-month window holds, **When** the schedule is shown, **Then** the forecast uses the median of all the reductions available.
8. **Given** complete Details and enough Actual Balances but a Bank Schedule that cannot be calculated, **When** the schedule is shown, **Then** the Forecast Balance values are shown.
9. **Given** a linked account with no Actual Balance data, **When** the schedule is shown, **Then** the Forecast Balance column is shown with every cell blank.

---

### User Story 2 - See the forecast on the chart (Priority: P2)

As a signed-in user, I see the forecast on the Mortgage Burndown as its own line and filled area in a new colour scheme, continuing from my Actual Balance, so I can compare the projected payoff with the Bank Schedule.

**Why this priority**: Requested to follow once the column values are correct.

**Independent Test**: Open the Burndown for a mortgage with forecast values and confirm a new series passes through every Forecast Balance at its row's date.

**Acceptance Scenarios**:

1. **Given** forecast values exist and the Bank Schedule is plotted, **When** the Burndown is shown, **Then** a "Forecast Balance" line and area in a colour of its own run from the last Actual Balance point through every forecast value to the last one.
2. **Given** the series is shown, **When** the user looks at the legend, **Then** "Forecast Balance" is listed with a sample of its colours.
3. **Given** a forecast date, **When** the user hovers or moves to it by keyboard, **Then** the label shows the date, Bank Schedule and Forecast Balance, matching the table.
4. **Given** the series is shown, **When** a screen-reader user reaches the chart, **Then** its text alternative states the first and last Forecast Balances and their dates.
5. **Given** there are no forecast values, **When** the Burndown is shown, **Then** the chart looks and behaves as it does today.

### Edge Cases

- No Actual Balance data → the column is shown blank and nothing is plotted for the forecast; the Bank Schedule is the only forecast.
- Only one Actual Balance → no reduction can be noted, so there are no Forecast Balance values and no forecast is plotted.
- Less than 12 months of Actual Balance history → every available reduction is used, even if only one.
- Median is zero or negative (the balance is not falling) → the column is blank and no forecast is plotted.
- A period where the balance rose or did not change → its negative or zero reduction counts towards the median.
- Repayments less frequent than the schedule (for example a Weekly schedule with monthly repayments) → periods without a new transaction repeat the balance and count as zero reductions; when more than half of the window's reductions are zero, the median is zero, so the column is blank and no forecast is plotted.
- Forecast still above zero at the final schedule row → it stops there; no rows are added and no zero is forced.
- Last Actual Balance already zero or negative, with a positive median → the next row shows zero and later rows are blank.
- Last Actual Balance on the final schedule row → no forecast.
- Balances loading or failed, or monthly fallback → Forecast Balance cells are blank; the chart keeps its existing behaviour and messages.
- Bank Schedule not calculable → the table still shows the forecast; the chart plots nothing and keeps its existing message.
- Schedules up to 1,560 periods, Light and Dark themes, and widths down to 320 CSS pixels → the page does not scroll sideways; the Forecast Balance header and cells can be scrolled into view within the content panel, unclipped and not overlapping other columns; the forecast line, area and legend entry stay inside the chart with legend entries not overlapping; the hover label stays inside the chart; contrast (FR-010) holds. Chart text scales with the chart as it does today.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When the Actual Balance column is shown, the Amortization Schedule MUST show a read-only "Forecast Balance" column immediately to its right, formatted and right aligned like Actual Balance. The column stays shown when all its cells are blank, including when there is no Actual Balance data.
- **FR-002**: A reduction MUST be the previous row's Actual Balance minus the row's Actual Balance, only where both are non-blank.
- **FR-003**: The forecast reduction MUST be the median of the per-period reductions in the 12 months ending at the last row with an Actual Balance; an even count takes the mean of the two middle values, rounded half up to the currency's minor unit.
- **FR-004**: Those 12 months MUST be the last 12 (Monthly), 26 (Fortnightly) or 52 (Weekly) reductions, or all of them when fewer exist.
- **FR-005**: The first Forecast Balance MUST be on the row after the last non-blank Actual Balance and equal that balance minus the forecast reduction; each later row MUST subtract it again from the previous Forecast Balance.
- **FR-006**: The first result at or below zero MUST show as zero, and every later cell MUST be blank. A forecast still above zero at the last schedule row MUST stop there, with no added rows and no forced zero.
- **FR-007**: All other Forecast Balance cells MUST be blank, including when the forecast reduction is zero or negative or cannot be calculated. With no Actual Balance data, no Forecast Balance value is shown or plotted and nothing is substituted for it: the Bank Schedule is then the only forecast.
- **FR-007a**: The forecast MUST NOT depend on the Bank Schedule: with complete Details, the table shows it even when the Bank Schedule cannot be calculated.
- **FR-008**: The forecast MUST stay current with the Actual Balance column and the schedule, without a page reload.
- **FR-008a**: All forecast calculations (reductions, median and Forecast Balances) MUST be done in the browser from the Actual Balance values it already holds, with no server calculation or additional request.
- **FR-009**: When the Bank Schedule is plotted, the Burndown MUST plot "Forecast Balance" at each non-blank forecast row's date and value, joined in date order from the last Actual Balance point, on the existing axes.
- **FR-010**: The series MUST have a line and filled area in one orange of its own, distinct from both existing series and from status colours, in each theme. The area fades downward beneath the guides and lines as existing areas do, with no card-coloured gap under the line or against the Actual Balance area. The line, rings and legend sample have at least 3:1 contrast with the chart card. Contrast between series lines where they cross or overlap is not required.
- **FR-011**: The forecast line MUST be solid. The legend and hover label name the series; the legend samples differ only by colour (accepted exception, Clarifications).
- **FR-012**: The legend MUST list "Forecast Balance" with a solid sample in its colours only when forecast values are plotted.
- **FR-013**: The hover and keyboard label, rings, announcements and text alternative MUST include Forecast Balance on forecast dates, with values matching the table (026 FR-007 to FR-009a).

### Key Entities *(include if feature involves data)*

- **Forecast reduction**: Derived, not stored: the median recent fall in Actual Balance per period.
- **Forecast Balance**: Derived, not stored: the projected balance for a schedule row after the last Actual Balance.

### Constitution Scope

- [ ] Stores, changes or deletes data (DOT-002, OPS-001 migrations)
- [ ] Creates or reads audit records (AUD-001)
- [ ] Adds or changes endpoints, auth or input handling (SEC-001, SEC-004)
- [x] Handles personal, payment or financial data (SEC-003): derives figures from balances already shown; nothing new is read or stored
- [x] Changes UI in clutch-web (WEB-001, style guide): new table column, chart series, colour tokens, legend and label entries

## Success Criteria *(mandatory)*

- **SC-001**: In 100% of checks, every Forecast Balance cell equals the value hand-calculated from the Actual Balance column, with exactly one zero and blanks after it when the forecast reaches zero.
- **SC-002**: In 100% of checks where the Bank Schedule is plotted, every non-blank forecast cell has a chart point and label value equal to it, and no other forecast point is drawn.
- **SC-003**: Forecast values and the chart series appear within 500 milliseconds of the Actual Balance values, for schedules up to 1,560 periods.
- **SC-004**: In 100% of checks across Light and Dark themes, the forecast line, rings and legend sample have at least 3:1 contrast with the chart card behind them (FR-010; crossings between series lines excluded).
- **SC-005**: Mortgages without a linked account look and behave exactly as before.

## Assumptions

- The forecast uses the Actual Balance column's values, including its sign and blank rules (020), and is calculated for display only; no data, endpoint or audit record is added.
- The most recent period is the last row with an Actual Balance. Whether a period is finished cannot be told, so every period with data counts, including that one.
- Forecast rows are the existing schedule rows; the forecast ignores interest rates and the Bank Schedule.
- Colours are code-first tokens in `src/clutch-web/src/index.css`, as chosen in the review session (Clarifications).
- The chart remains desktop only, with mouse or keyboard (026).
- Acceptance is verified through automated checks, not manual testing.
- The separate Burndown contrast and style guide fix, once a dependency, is withdrawn (Clarifications). Actual Balance and Bank Schedule drawing changed only as the review session decided.
