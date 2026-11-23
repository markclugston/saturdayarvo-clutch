# Feature Specification: Amortization Schedule Calculation

**Feature Branch**: `023-amortization-schedule-calculation`

**Created**: 2026-11-23

**Status**: Draft

**Input**: User description: "on the mortgage screen in the amortization schedule list.  run the calculations to produce a period by period amortization schedule.  source all the data from the details section, including changing interest rates based on the date.  in this instance assume principal and interest payments are expected."

<!--
  Builds on 016-mortgage-tracking (schedule group; Bank Schedule cells show "Not yet calculated";
  Burndown chart "not yet calculated"; 016 FR-016 deferred all amortization values to this feature),
  017/021 (interest rate changes, opening rate on the Disbursal Date), 019 (Loan Payoff Timeline
  group), 020 (Actual Balance column) and 022 (Duration rows, period k dated Disbursal Date + k
  intervals). This feature fills the Bank Schedule column and the Burndown chart's Bank Schedule
  series with calculated principal and interest (P&I) balances. Period dates, the Actual Balance
  column and validation are unchanged.
-->

## Clarifications

### Session 2026-11-23

- Q: A rate change effective between two period dates: apply it from the next period, or split that period's interest by days at each rate? → A: Split that period's interest by days at each rate.
- Q: Show only the Bank Schedule balance, or also Interest Rate, Repayment, Interest and Principal columns? → A: Only the Bank Schedule balance; no new columns.
- Q: Should the Mortgage Burndown chart also plot the calculated balances in this feature? → A: Yes.
- Q: Where should the amortization schedule be calculated: in the browser only, or also on the server? → A: Browser only: a pure TypeScript calculation in clutch-web, with no new endpoint.
- Q: When a saved mortgage has unsaved edits that make its Details invalid, what should the Bank Schedule cells and Burndown chart show? → A: "Not yet calculated" (and the chart's existing message) while any calculation input is invalid; other fields such as Name are ignored.
- Q: When a mid-period rate rise makes that period's interest exceed the repayment it kept, what should happen? → A: Allow it; that period's balance may rise, and the repayment is recalculated from the next period.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Calculated bank schedule balance per period (Priority: P1)

As a signed-in user viewing a mortgage, I see in each Amortization Schedule row's Bank Schedule cell the loan balance the bank's principal and interest schedule expects after that period's repayment, calculated from my Details.

**Why this priority**: It is the core value: a schedule to compare with the Actual Balance and the bank's statement.

**Independent Test**: Save a mortgage of $500,000.00, 360 Monthly periods, one rate of 6.00% and confirm period 1 shows $499,502.25, period 2 shows $499,002.01 and period 360 shows $0.00.

**Acceptance Scenarios**:

1. **Given** Opening Balance $500,000.00, Duration 360, Monthly, a single rate of 6.00%, **When** the schedule is shown, **Then** period 1's Bank Schedule is $499,502.25 (repayment $2,997.75, interest $2,500.00), period 2's is $499,002.01, and period 360's is $0.00.
2. **Given** Weekly or Fortnightly frequency, **When** the schedule is shown, **Then** the periodic rate is the annual rate divided by 52 or 26, and the last period's balance is $0.00.
3. **Given** a rate of 0.00%, **When** the schedule is shown, **Then** the balance falls by an equal repayment each period to $0.00.
4. **Given** an unsaved mortgage whose Details are all valid in the form, **When** the schedule is shown, **Then** values follow the form and update as it changes.
5. **Given** any calculation input (FR-002) is incomplete or invalid in the form, including unsaved edits to a saved mortgage, **When** the schedule is shown, **Then** the Bank Schedule cells show "Not yet calculated"; an invalid Name alone does not hide the values.

---

### User Story 2 - Interest rate changes take effect by date (Priority: P1)

As a signed-in user with several interest rate changes, I see the schedule switch to each new rate from its Effective Date, with the repayment recalculated so the loan still ends on the final repayment date.

**Why this priority**: Variable rates are the norm; a schedule using only the opening rate would be wrong after the first change.

**Independent Test**: Add a rate change part-way through the loan and confirm balances before it follow the old rate, the period containing it blends both rates by days, later periods follow the new rate with a recalculated repayment, and the last period's balance is $0.00.

**Acceptance Scenarios**:

1. **Given** an opening rate of 6.00% and a change to 5.50% effective on the date of period 24, **When** the schedule is shown, **Then** periods 1–24 accrue interest at 6.00% only, and from period 25 interest is at 5.50% with the repayment recalculated over the 336 remaining periods from period 24's balance.
2. **Given** Monthly frequency, a period running 29 Dec 2023 to 29 Jan 2024 (31 days) and a change from 6.00% to 5.00% effective 8 Jan 2024, **When** the schedule is shown, **Then** that period's interest is the opening balance × (6.00% ÷ 12 × 10/31 + 5.00% ÷ 12 × 21/31), rounded to the cent.
3. **Given** several rate changes, including two within one period, **When** the schedule is shown, **Then** each takes effect from its Effective Date, the period's interest blends every rate by its days, and the last period's balance is $0.00.
4. **Given** a rate change is added, edited or removed in the form, **When** the schedule is shown, **Then** it reflects the change without saving.

---

### User Story 3 - Burndown chart plots the bank schedule (Priority: P2)

As a signed-in user, when I switch the Loan Payoff Timeline to the Mortgage Burndown, I see the Bank Schedule line falling from the Opening Balance to $0.00 over the repayment dates.

**Why this priority**: The chart is the at-a-glance view of the same values; it depends on User Stories 1 and 2.

**Independent Test**: Open a mortgage with valid Details, show the Burndown and confirm the line starts at the Opening Balance on the Disbursal Date, passes through each period's Bank Schedule balance on its date, and ends at $0.00 on the final repayment date.

**Acceptance Scenarios**:

1. **Given** valid Details, **When** the Burndown is shown, **Then** the "Bank Schedule" series has a point at the Disbursal Date for the Opening Balance and one at each period's date for its Bank Schedule balance.
2. **Given** valid Details, **When** the Burndown is shown, **Then** its text alternative names the series and states the Opening Balance, Disbursal Date, final repayment date and that the balance reaches $0.00.
3. **Given** any calculation input (FR-002) is incomplete or invalid in the form, saved or not, **When** the Burndown is shown, **Then** it shows its existing message as today.
4. **Given** a Detail changes in the form, **When** the Burndown is shown, **Then** the line updates with the schedule.

### Edge Cases

- Rounding leaves a residual at the end → the last period's repayment is adjusted so its balance is exactly $0.00.
- Duration of 1 → one row; balance $0.00.
- Very long Duration (up to 022's limit of a final repayment date in 9999, over 1,560 periods) → every row and chart point is calculated; SC-004's 500 ms applies up to 1,560 periods.
- Rate change inside period 1 → period 1's repayment uses the rate in effect on the Disbursal Date (FR-006); period 1's interest is blended; the repayment is recalculated from the first period wholly at the new rate.
- Very small Opening Balance over many periods (e.g. $1.80, 360 periods, 0%) → a rounded-up repayment may repay the loan early; balances stop at $0.00 and never go negative (FR-007).
- Rate change effective on a period's date → applies from the next period entirely (that day starts the next period).
- Rate change effective on the final repayment date → no later period exists to use it; schedule unaffected.
- High rate (up to 100%) with long Duration → a recalculated level repayment always covers interest, so the balance never rises in a period without a mid-period rate change.
- Mid-period rate rise large enough that the period's interest exceeds the repayment it kept (FR-006) → that period's closing balance is higher than its opening balance; the rise is not limited and the kept repayment is not raised, and the repayment is recalculated from the next period.
- Calculation cannot be completed → Bank Schedule cells show "Not yet calculated" and the chart its existing message; no error details shown.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When Details are complete and valid, each period's Bank Schedule cell MUST show the calculated closing loan balance after that period's repayment, in the existing currency format, replacing "Not yet calculated" (016 FR-012, FR-016). No other columns are added.
- **FR-002**: All inputs MUST come from the Details: Opening Balance, Disbursal Date, Duration, Payment Frequency and the Interest Rate changes (the calculation inputs); the saved values for a saved mortgage with no unsaved changes, otherwise the form's current values. While any calculation input in the form is incomplete or invalid, whether or not the mortgage is saved, the Bank Schedule cells MUST show "Not yet calculated" and the Burndown its existing message; saved values are never used as a fallback. Fields that are not calculation inputs (such as Name or the linked Account) do not affect the schedule.
- **FR-003**: Period k MUST cover the days from the previous period's date (the Disbursal Date for period 1) up to the day before period k's date (022 FR-001).
- **FR-004**: Repayments MUST be principal and interest: a level repayment that repays the balance over the remaining periods at the periodic rate (annual rate ÷ 12 Monthly, ÷ 26 Fortnightly, ÷ 52 Weekly); at 0% it is the balance ÷ remaining periods.
- **FR-005**: Each period's interest MUST be its opening balance × the periodic rate, where a rate change takes effect from its Effective Date; when the rate changes within a period, the periodic rate is each rate's periodic rate weighted by its share of the period's days. Closing balance = opening balance + interest − repayment; period 1 opens at the Opening Balance.
- **FR-006**: Period 1's repayment MUST be the level repayment over Duration periods from the Opening Balance at the rate in effect on the Disbursal Date, even when a rate change falls inside period 1. The repayment MUST be recalculated over the remaining periods, from the opening balance of the first period that accrues wholly at a new rate, at that rate; a period with a mid-period change keeps the repayment it started with, even if its interest then exceeds that repayment and its balance rises. The final repayment date is unchanged.
- **FR-007**: Repayment and interest MUST be rounded to the cent (half away from zero); the last period's repayment MUST be adjusted so its closing balance is exactly $0.00. A repayment MUST NOT exceed its period's opening balance + interest, so no balance falls below $0.00; once a balance reaches $0.00 (possible only when a very small level repayment rounds up), later repayments and balances are $0.00.
- **FR-008**: The Mortgage Burndown chart's single "Bank Schedule" series (016 FR-018) MUST plot the Opening Balance at the Disbursal Date and each period's Bank Schedule balance at its date, using the existing currency balance axis, date axis and legend, replacing its "not yet calculated" message when Details are valid; its text alternative MUST describe the plotted values (016 FR-014).
- **FR-009**: Period, Date and Actual Balance columns, row count, the monthly fallback view, the Loan Payoff Timeline toggle, scrolling and layout MUST stay as specified in 016, 019, 020 and 022.
- **FR-010**: Calculated values MUST be read-only and not stored; they are recalculated whenever an input changes.
- **FR-011**: The schedule MUST be calculated in the web app (clutch-web) only, from the Details shown on screen; no server calculation or new endpoint is added.

### Key Entities *(include if feature involves data)*

- **Scheduled period** (derived, not stored): Period number, date (022), opening balance, rates in effect and their days, repayment, interest, closing balance (shown as Bank Schedule).

### Constitution Scope

Tick each that applies, so plan can pick requirement IDs without rereading the spec:

- [ ] Stores, changes or deletes data (DOT-002, OPS-001 migrations)
- [ ] Creates or reads audit records (AUD-001)
- [ ] Adds or changes endpoints, auth or input handling (SEC-001, SEC-004): no; the calculation runs in clutch-web only (FR-011) and its inputs are already validated by 016
- [x] Handles personal, payment or financial data (SEC-003): loan balances
- [x] Changes UI in clutch-web (WEB-001, style guide): Bank Schedule values (right-aligned currency) and Burndown chart series

## Success Criteria *(mandatory)*

- **SC-001**: For any valid mortgage, the last period's Bank Schedule balance is exactly $0.00 and no balance is below $0.00; an earlier balance is $0.00 only when a level repayment rounded up repays the loan early (FR-007); every period without a mid-period rate change has a balance no higher than the period before.
- **SC-002**: For a single-rate mortgage, every balance matches a standard amortization calculator's level P&I schedule to the cent.
- **SC-003**: For a mortgage with rate changes, 100% of periods' interest matches FR-005, including periods blended by days.
- **SC-004**: The schedule and chart show calculated values within 500 milliseconds of opening a mortgage or changing a Detail, for Durations up to 1,560 weekly periods (30 years).
- **SC-005**: Every point on the Burndown equals the Bank Schedule balance in the row with the same date.
- **SC-006**: Mortgages with incomplete Details, and the Actual Balance column, look and behave exactly as before.

## Assumptions

- Principal and interest repayments only (per the request); interest-only periods, extra repayments, offsets, fees and redraws are out of scope.
- Periodic rate is the nominal annual rate ÷ periods per year (12, 26, 52); day weighting applies only within a period that contains a rate change.
- Period dates and row count come from 022 (`src/Clutch.API/Domain/Mortgages/RepaymentDates.cs`, `src/clutch-web/src/features/mortgages/repaymentDates.ts`); this feature does not change them.
- The opening rate is always effective on the Disbursal Date (021), so every period has a rate.
- The Burndown chart plots the Bank Schedule only; plotting the Actual Balance is out of scope (016 FR-018).
- Input validation limits are those of 016/017/021; no new inputs are added.
