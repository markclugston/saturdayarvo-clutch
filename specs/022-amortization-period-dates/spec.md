# Feature Specification: Amortization Period Dates and End-of-Day Balances

**Feature Branch**: `022-amortization-period-dates`

**Created**: 2026-11-23

**Status**: Draft

**Input**: User description: "on the mortgage amortization screen. 1. the dates listed must be based on the disbursal date + the frequency. e.g. if the disbursal date is the 29/11/2023 then period one date must be 29/12/2023, period 2 must be 29/01/2024 and so on. 2. The mortgage account balance column (far right) must show the balance as at end of day for the date. if there are no transactions on that date, take the balance as the last transaction dated before that day."

<!--
  Builds on 016-mortgage-tracking (schedule rows 1 to Duration + 1, Date column currently "Not yet calculated")
  and 020-mortgage-account-balance-column (balance column, monthly fallback). Today period k starts
  k - 1 intervals after the Disbursal Date and its balance is read at the day before period k + 1 starts.
  This feature dates each row one interval later and reads the balance at the end of that date.
-->

## Clarifications

### Session 2026-11-23

- Q: Duration + 1 rows are shown today, so the last row would fall one interval after the final repayment. How many rows? → A: Show Duration rows only (1 to Duration); the last row is the final repayment.
- Q: After the account's latest balance-bearing transaction, should rows dated later (including past dates) carry that balance forward? → A: No. Only the first row dated on or after that transaction shows its balance; every later row is blank until more transactions are imported.
- Q: The code's final repayment date is the Disbursal Date plus Duration − 1 intervals (016 FR-019: period 1 on the Disbursal Date). Which is right? → A: Period 1 is the date the first payment is made, period 2 the second, and so on; no payment is made after the Duration count is reached. The first payment is one interval after the Disbursal Date, so the final repayment date is the Disbursal Date plus Duration intervals, and every rule that uses it follows (FR-007).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Each period shows its repayment date (Priority: P1)

As a signed-in user viewing a mortgage, I see in the Amortization Schedule's Date column the date of each period: the Disbursal Date plus that many payment intervals.

**Why this priority**: Dates are what make the schedule readable and comparable with the bank's statement.

**Independent Test**: Open a mortgage with Disbursal Date 29 Nov 2023 and Monthly frequency and confirm period 1 shows 29 Dec 2023, period 2 shows 29 Jan 2024 and period 3 shows 29 Feb 2024.

**Acceptance Scenarios**:

1. **Given** Disbursal Date 29 Nov 2023 and Monthly frequency, **When** the schedule is shown, **Then** period 1 is dated 29 Dec 2023, period 2 is 29 Jan 2024 and each later period is one further month on.
2. **Given** Disbursal Date 31 Jan 2024 and Monthly frequency, **When** the schedule is shown, **Then** period 1 is 29 Feb 2024, period 2 is 31 Mar 2024 and period 3 is 30 Apr 2024 (day kept from the Disbursal Date, clamped to the month's last day).
3. **Given** Weekly or Fortnightly frequency, **When** the schedule is shown, **Then** period k is dated 7 × k or 14 × k days after the Disbursal Date.
4. **Given** an unsaved mortgage whose Duration, Disbursal Date and Payment Frequency are valid in the form, **When** the schedule is shown, **Then** dates follow the form's values and update as they change.
5. **Given** Details are incomplete (monthly fallback view), **When** the schedule is shown, **Then** the Date column stays blank as today.
6. **Given** a Duration of 360 Monthly periods disbursed 29 Nov 2023, **When** the schedule is shown, **Then** it has exactly 360 rows and the last, period 360, is dated 29 Nov 2053.

---

### User Story 2 - Account balance as at end of the period's date (Priority: P1)

As a signed-in user with a Mortgage Account linked, I see in the far-right balance column the account's balance at the end of the day shown in that row's Date.

**Why this priority**: The balance must line up with the date beside it, or the comparison with the bank schedule is wrong.

**Independent Test**: Link an account with balance-bearing transactions on and around the period dates and confirm each row shows the balance of the last transaction on or before that row's date.

**Acceptance Scenarios**:

1. **Given** transactions dated on a row's date, **When** the balance is shown, **Then** it is the balance of the last of them in the Transactions list order (date, then transaction Id), the end-of-day balance.
2. **Given** no transaction on a row's date, **When** the balance is shown, **Then** it is the balance of the last transaction dated before that day.
3. **Given** a transaction dated the day after a row's date, **When** the balance is shown, **Then** it does not affect that row.
4. **Given** a row dated before the account's first balance-bearing transaction, **When** the balance is shown, **Then** the cell is blank.
5. **Given** the account's latest balance-bearing transaction is dated between period 3 and period 4, **When** the balance is shown, **Then** period 4 shows that balance and periods 5 onward are blank.

### Edge Cases

- Several transactions on a row's date → the last in the Transactions list order (date, then transaction Id) is used, as in 020.
- Transactions without a balance value → skipped.
- Rows after the account's latest balance-bearing transaction → FR-005: no carrying forward past the first row dated on or after it (per the clarification).
- Duration so large that the final repayment date (Disbursal Date plus Duration intervals) would be after 31 Dec 9999 → save refused as today, Duration flagged with "The final repayment date would be later than 31 Dec 9999"; every shown row therefore has a date.
- A saved mortgage valid under the old rule whose new final repayment date passes 31 Dec 9999 → shown as saved: a row whose date would pass 31 Dec 9999 shows a blank Date, the server refuses its period balance request with the Duration message (FR-007) so the balance column shows its existing error message, and Duration is flagged on its next save.
- Interest rate Effective Date on or after the Disbursal Date and on or before the new final repayment date (one interval later than before) → accepted.
- Monthly fallback view (Details incomplete) → unchanged from 020: blank dates, monthly balances from the account's first balance-bearing transaction.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Date of period k MUST be the Disbursal Date plus k payment intervals: k months (Monthly, keeping the Disbursal Date's day, clamped to the month's last day), 7 × k days (Weekly) or 14 × k days (Fortnightly). Period 1 is therefore one interval after the Disbursal Date.
- **FR-002**: When Details are complete, the schedule MUST show exactly Duration rows, numbered 1 to Duration, so the last row is dated on the final repayment (Disbursal Date plus Duration intervals). This replaces the Duration + 1 rows rule of 016 (016 FR-011 and 016 SC-004) for the mortgage's own periods; the monthly fallback view keeps its own row count (020).
- **FR-003**: Dates MUST be shown in the mortgage screens' existing display date format (day, three-letter month, four-digit year, e.g. "29 Dec 2023") and be read-only; Bank Schedule is unchanged.
- **FR-004**: Each balance cell that FR-005 does not blank MUST show the balance of the last balance-bearing transaction dated on or before the row's Date (end of that day), replacing 020's rule of the day before the next period starts.
- **FR-005**: A row dated before the account's first balance-bearing transaction MUST be blank; the first row dated on or after the account's latest balance-bearing transaction MUST show that balance, and every later row MUST be blank, even when its date is in the past.
- **FR-006**: Balance sign orientation, currency formatting, ownership, refresh after import or delete, and the monthly fallback view MUST stay as specified in 020.
- **FR-007**: The final repayment date MUST be the date of period Duration: the Disbursal Date plus Duration payment intervals (e.g. 29 Nov 2023, 360 Monthly → 29 Nov 2053). This replaces 016 FR-019's definition (period 1 on the Disbursal Date, Disbursal Date plus Duration − 1 steps) everywhere it is used: the Duration limit (31 Dec 9999) and the interest rate Effective Date range (016 FR-007). Both MUST be enforced in the UI and on the server (SEC-004); messages are unchanged.

### Key Entities *(include if feature involves data)*

- **Period date**: Derived, not stored: Disbursal Date plus k payment intervals.
- **Period balance**: Derived, not stored: the account's end-of-day balance on the period date.

### Constitution Scope

Tick each that applies, so plan can pick requirement IDs without rereading the spec:

- [ ] Stores, changes or deletes data (DOT-002, OPS-001 migrations)
- [ ] Creates or reads audit records (AUD-001)
- [x] Adds or changes endpoints, auth or input handling (SEC-001, SEC-004): the period balance endpoint's period calculation changes; the final repayment date bound on Duration and Effective Date moves one interval later (FR-007); auth unchanged
- [x] Handles personal, payment or financial data (SEC-003): account balances, as in 020
- [x] Changes UI in clutch-web (WEB-001, style guide)

## Success Criteria *(mandatory)*

- **SC-001**: For a mortgage disbursed 29 Nov 2023, Monthly, 100% of rows show the 29th of each following month (or the month's last day when shorter), starting 29 Dec 2023.
- **SC-002**: For an account with balance-bearing transactions on, before and after period dates, 100% of shown balances equal the balance of the last balance-bearing transaction dated on or before the row's date.
- **SC-003**: No shown balance reflects a transaction dated after that row's date.
- **SC-004**: Mortgages without a linked account show the new dates and Duration rows, and otherwise look and behave as before.
- **SC-005**: For any saved Duration N, the schedule shows exactly N rows and the last is dated on the final repayment.
- **SC-006**: The UI and the server accept and refuse the same values at the new final repayment date boundary: the largest Duration whose final repayment date is on or before 31 Dec 9999 is accepted and the next Duration refused; an Effective Date one day before or on the final repayment date is accepted and one day after it refused.

## Assumptions

- Monthly dates are anchored on the Disbursal Date's day, not chained from the previous row (31 Jan → 29 Feb → 31 Mar), matching the existing repayment date rule in `src/Clutch.API/Domain/Mortgages/RepaymentDates.cs` and `src/clutch-web/src/features/mortgages/repaymentDates.ts`.
- A saved mortgage uses its saved values; an unsaved one uses the form's valid values (as in 020).
- The monthly fallback view is out of scope and unchanged.
- No payment falls on the Disbursal Date; the first is one interval later. The final repayment date validation keeps its rules and messages but uses the FR-007 date.
