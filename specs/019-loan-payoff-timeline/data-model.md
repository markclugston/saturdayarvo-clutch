# Data Model: Loan Payoff Timeline Group

## LoanPayoffTimelineView (domain enum, `Domain/Preferences/LoanPayoffTimelineView.cs`)

| Value | Meaning |
|---|---|
| `Burndown` | Group shows the burndown chart. Default when no row exists. |
| `Schedule` | Group shows the amortization schedule. |

## UserLoanPayoffTimelinePreference (entity, table `UserLoanPayoffTimelinePreferences`)

| Column | Type | Rules |
|---|---|---|
| `UserId` | nvarchar(450) | PK; FK → `AspNetUsers.Id`, `ON DELETE CASCADE` |
| `View` | varchar(16) | Required; enum string; `CK_UserLoanPayoffTimelinePreferences_View`: `[View] IN ('Burndown', 'Schedule')` |
| `ClientId` | uniqueidentifier | Required; page-load ID of the last applied save (R3) |
| `ClientSequence` | bigint | Required; `CK_UserLoanPayoffTimelinePreferences_ClientSequence`: `[ClientSequence] >= 1` |
| `UpdatedAtUtc` | datetimeoffset | Required; from `TimeProvider` on every applied save |

- One row per user; created on first save, then updated (serializable upsert, as 018).
- No row → read returns `Burndown`.
- Not an audit event (AUD-001 N/A); not personal or financial data.

## State transitions

```text
(no row) --PUT(view, c, n)--> row(view, c, n)
row(v, c, n) --PUT(view', c, n') with n' > n--> row(view', c, n')     # newer switch, same page
row(v, c, n) --PUT(view', c, n') with n' <= n--> unchanged; "superseded" # older switch arrived late
row(v, c, n) --PUT(view', c', n') with c' != c--> row(view', c', n')   # other page/device: last commit wins
row --user deleted--> (cascade delete)
```

## Migration

- `AddLoanPayoffTimelinePreferences`: creates the table, PK, FK and both check constraints only.
- Rollback: `Down` drops the table. No backfill: existing users read `Burndown`.

## Client state (clutch-web, not persisted locally)

| State | Source | Changes on |
|---|---|---|
| shown view | Query cache `['loanPayoffTimelinePreference', userId]`, seeded from GET (`Burndown` on error/2 s timeout; a failed load is not re-requested within the visit) | Switch button only (written synchronously); removed on sign-out with all non-session queries |
| `clientId` | Random GUID, once per page load, held in module scope with `clientSequence` | Never (survives leaving and returning to Mortgages) |
| `clientSequence` | Counter, starts at 1 per page load, held in module scope with `clientId` | +1 per switch; never reset while the page is loaded |
